"use client";

import { useEffect, useState } from "react";
import { KEYS, readLocal, writeLocal } from "@/lib/storage";
import { bookQuery } from "@/lib/domain/covers";

/**
 * Book covers from Open Library, the free public library catalogue the barcode lookup already uses.
 * A book's title and author are looked up once per device; the answer (a cover number, or "none")
 * is remembered, so a shelf of books is only asked about the first time it's shown.
 */

type Answer = number; // Open Library cover id, or 0 for "no cover found"
const MAX_REMEMBERED = 800;
const AT_ONCE = 2;

let remembered: Map<string, Answer> | null = null;
const listeners = new Map<string, ((id: Answer) => void)[]>();
const queue: { key: string; title: string; author: string | null }[] = [];
let running = 0;

function memory(): Map<string, Answer> {
  if (remembered) return remembered;
  remembered = new Map();
  try {
    const raw = JSON.parse(readLocal(KEYS.covers) ?? "[]") as [string, number][];
    for (const [k, v] of raw) if (typeof k === "string" && typeof v === "number") remembered.set(k, v);
  } catch {
    /* start afresh */
  }
  return remembered;
}

function remember(key: string, id: Answer) {
  const m = memory();
  m.delete(key);
  m.set(key, id);
  while (m.size > MAX_REMEMBERED) m.delete(m.keys().next().value!);
  writeLocal(KEYS.covers, JSON.stringify([...m]));
}

async function lookUp(title: string, author: string | null): Promise<Answer | null> {
  const params = new URLSearchParams({ title, fields: "cover_i", limit: "1" });
  if (author) params.set("author", author);
  try {
    const res = await fetch(`https://openlibrary.org/search.json?${params}`, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const data = (await res.json()) as { docs?: { cover_i?: unknown }[] };
    const id = data.docs?.[0]?.cover_i;
    return typeof id === "number" && id > 0 ? id : 0;
  } catch {
    // Offline or blocked: don't remember, so it's tried again another time.
    return null;
  }
}

function pump() {
  while (running < AT_ONCE && queue.length > 0) {
    const job = queue.shift()!;
    running++;
    lookUp(job.title, job.author).then((id) => {
      running--;
      if (id !== null) remember(job.key, id);
      for (const done of listeners.get(job.key) ?? []) done(id ?? 0);
      listeners.delete(job.key);
      pump();
    });
  }
}

export function coverUrl(id: number, size: "M" | "L" = "M"): string {
  return `https://covers.openlibrary.org/b/id/${id}-${size}.jpg`;
}

/** The cover picture for a book, or null while looking or when there isn't one. Pass null for things that aren't books. */
export function useBookCover(book: { title: string; author: string | null } | null): string | null {
  const q = book ? bookQuery(book.title, book.author) : null;
  const known = q ? memory().get(q.key) : undefined;
  const [found, setFound] = useState<{ key: string; id: Answer } | null>(null);

  useEffect(() => {
    if (!q || known !== undefined) return;
    let active = true;
    const done = (id: Answer) => active && setFound({ key: q.key, id });
    const waiting = listeners.get(q.key);
    if (waiting) waiting.push(done);
    else {
      listeners.set(q.key, [done]);
      queue.push(q);
      pump();
    }
    return () => {
      active = false;
    };
  }, [q?.key, known]); // eslint-disable-line react-hooks/exhaustive-deps

  const id = known ?? (found && q && found.key === q.key ? found.id : 0);
  return id ? coverUrl(id) : null;
}
