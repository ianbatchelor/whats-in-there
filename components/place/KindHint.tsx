"use client";

import { useState } from "react";
import type { LocationType } from "@/lib/household";
import { supabase } from "@/lib/supabase/client";
import { friendlyError } from "@/lib/supabase/errors";
import { aKind, kindFromName } from "@/lib/domain/kindFromName";
import { KEYS, readLocal, writeLocal } from "@/lib/storage";
import { IconX } from "@/components/ui/icons";

function hidden(): string[] {
  try {
    const v = JSON.parse(readLocal(KEYS.kindHint) ?? "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/**
 * "Book shelf sounds like a bookshelf": a place made before its kind existed shows the wrong
 * picture and misses that kind's extras. One tap switches it; ✕ hides the offer on this phone.
 */
export function KindHint({ place, onSwitched }: { place: { id: string; name: string; type: LocationType }; onSwitched: (type: LocationType) => void }) {
  const better = kindFromName(place.name, place.type);
  const [gone, setGone] = useState(() => hidden().includes(`${place.id}:${better}`));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!better || gone) return null;

  async function switchKind() {
    setBusy(true);
    setError(null);
    const { error } = await supabase().from("storage_locations").update({ type: better }).eq("id", place.id);
    setBusy(false);
    if (error) return setError(friendlyError(error));
    onSwitched(better!);
  }

  function notNow() {
    writeLocal(KEYS.kindHint, JSON.stringify([...hidden(), `${place.id}:${better}`].slice(-50)));
    setGone(true);
  }

  return (
    <div role="note" className="flex items-start gap-3 rounded-2xl bg-check px-4 py-3 ring-1 ring-check-line">
      <div className="min-w-0 flex-1">
        <p className="text-[14.5px] leading-snug">
          <b>{place.name}</b> sounds like {aKind(better)}. Make it one to get{" "}
          {better === "bookshelf" ? "the bookshelf picture and book covers" : "its picture and suggestions"}.
        </p>
        {error ? <p className="mt-1 text-[13.5px] text-warn">{error}</p> : null}
        <button onClick={switchKind} disabled={busy} className="mt-2 min-h-10 rounded-xl bg-go px-4 text-[14.5px] font-semibold text-on-go disabled:opacity-60">
          {busy ? "Changing…" : `Make it ${aKind(better)}`}
        </button>
      </div>
      <button onClick={notNow} aria-label="Not now" className="-mt-1 -mr-2 grid size-10 shrink-0 place-items-center rounded-full text-mute hover:text-fg">
        <IconX className="size-[18px]" />
      </button>
    </div>
  );
}
