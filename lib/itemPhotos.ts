"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

const BUCKET = "item-photos";
const LIFETIME_S = 60 * 60;
/** Signed links are reused until ten minutes before they run out. */
const REUSE_MS = (LIFETIME_S - 10 * 60) * 1000;

/** Where the small list picture of a label photo lives: beside it, e.g. `x.webp` → `x.thumb.webp`. */
export function thumbPath(path: string): string {
  const dot = path.lastIndexOf(".");
  return dot > path.lastIndexOf("/") ? `${path.slice(0, dot)}.thumb${path.slice(dot)}` : `${path}.thumb`;
}

/** A request for the full-size photo rather than the small copy is keyed with this prefix. */
const FULL = "full:";

type Entry = { url: string | null; at: number };
const cache = new Map<string, Entry>();
const waiting = new Map<string, ((url: string | null) => void)[]>();
let timer: ReturnType<typeof setTimeout> | null = null;

/**
 * The bucket is private, so every picture needs a signed link. Lists ask for many at once, so requests
 * made in the same moment are signed in one call. Each item asks for its small picture and its full
 * photo together, and uses the small one when it exists (photos from before thumbnails have none).
 */
async function flush() {
  timer = null;
  const batch = new Map(waiting);
  waiting.clear();
  const paths = [...batch.keys()];
  const signed = new Map<string, string | null>();
  try {
    const all = [...new Set(paths.flatMap((p) => (p.startsWith(FULL) ? [p.slice(FULL.length)] : [thumbPath(p), p])))];
    const { data } = await supabase().storage.from(BUCKET).createSignedUrls(all, LIFETIME_S);
    for (const row of data ?? []) if (row.path && row.signedUrl && !row.error) signed.set(row.path, row.signedUrl);
  } catch {
    /* no pictures this time; the letter tiles stay */
  }
  for (const [path, resolvers] of batch) {
    const url = path.startsWith(FULL) ? (signed.get(path.slice(FULL.length)) ?? null) : (signed.get(thumbPath(path)) ?? signed.get(path) ?? null);
    cache.set(path, { url, at: Date.now() });
    for (const done of resolvers) done(url);
  }
}

function request(path: string): Promise<string | null> {
  return new Promise((resolve) => {
    const list = waiting.get(path) ?? [];
    list.push(resolve);
    waiting.set(path, list);
    timer ??= setTimeout(flush, 30);
  });
}

function fresh(path: string | null | undefined): Entry | undefined {
  if (!path) return undefined;
  const hit = cache.get(path);
  return hit && Date.now() - hit.at < REUSE_MS ? hit : undefined;
}

/**
 * A signed link to a stored photo (the small copy where there is one, or the full photo when
 * `full` is set), or null while loading or if there's none.
 */
export function useItemPhoto(stored: string | null | undefined, full = false): string | null {
  const path = stored ? (full ? FULL + stored : stored) : stored;
  // Links fetched for this component, by path. A cached link is used straight away, without an effect.
  const [loaded, setLoaded] = useState<{ path: string; url: string | null } | null>(null);
  const hit = fresh(path);
  useEffect(() => {
    if (!path || fresh(path)) return;
    let live = true;
    void request(path).then((url) => live && setLoaded({ path, url }));
    return () => {
      live = false;
    };
  }, [path]);
  if (!path) return null;
  if (hit) return hit.url;
  return loaded?.path === path ? loaded.url : null;
}

/** Forget a cached link, e.g. after a photo is replaced. */
export function forgetItemPhoto(path: string) {
  cache.delete(path);
  cache.delete(FULL + path);
}
