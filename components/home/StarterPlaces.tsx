"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { friendlyError } from "@/lib/supabase/errors";
import type { LocationType } from "@/lib/household";
import { PlacePhoto } from "@/components/art/PlacePhoto";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { IconCheck, IconPlus } from "@/components/ui/icons";
import { placeType } from "./placeTypes";

/** The places most homes have, offered on a new household's first visit. */
export const STARTERS: LocationType[] = ["freezer", "fridge", "pantry", "wardrobe", "bookshelf", "attic", "garage", "shed"];

/**
 * A new household picks the places it has from photos, and lands on a home that already looks
 * like theirs. Each starts with the plain name of its kind ("Freezer"), which can be changed later.
 */
export function StarterPlaces({ householdId, onAdded, onOwn }: { householdId: string; onAdded: () => void; onOwn: () => void }) {
  const [picked, setPicked] = useState<LocationType[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (t: LocationType) => setPicked((p) => (p.includes(t) ? p.filter((x) => x !== t) : [...p, t]));

  async function add() {
    setError(null);
    setBusy(true);
    // Added in the order shown, so Home lists them the same way.
    const rows = STARTERS.filter((t) => picked.includes(t)).map((type) => ({ household_id: householdId, name: placeType(type).label, type }));
    const { error } = await supabase().from("storage_locations").insert(rows);
    setBusy(false);
    if (error) return setError(friendlyError(error));
    onAdded();
  }

  return (
    <section aria-labelledby="starter-h" className="flex flex-col gap-4 rounded-[24px] border border-line bg-card p-4 shadow-[var(--shadow-card)] sm:p-6">
      <div>
        <h3 id="starter-h" className="font-serif text-[1.75rem] leading-tight font-semibold">
          Which of these do you have?
        </h3>
        <p className="mt-1 text-mute">Pick the places you want to keep track of. You can rename them, or add others, any time. The shopping list and wish lists for presents and books are under Lists.</p>
      </div>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4" role="group" aria-label="Places to add">
        {STARTERS.map((t) => {
          const on = picked.includes(t);
          const label = placeType(t).label;
          return (
            <button
              key={t}
              type="button"
              onClick={() => toggle(t)}
              aria-pressed={on}
              className={`relative block w-full overflow-hidden rounded-2xl border text-left transition active:scale-[0.98] ${on ? "border-go ring-2 ring-go" : "border-line"}`}
            >
              <span className="block aspect-[4/3]">
                <PlacePhoto type={t} eager />
              </span>
              <span className="block bg-card px-3 py-2 text-[14px] font-semibold">{label}</span>
              <span
                aria-hidden="true"
                className={`absolute top-2 right-2 grid size-7 place-items-center rounded-full transition ${on ? "bg-go text-on-go" : "bg-white/85 text-transparent"}`}
              >
                <IconCheck className="size-4" />
              </span>
            </button>
          );
        })}
      </div>
      {error ? <Notice>{error}</Notice> : null}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Button busy={busy} disabled={picked.length === 0} onClick={add} className="max-sm:w-full">
          {picked.length === 0 ? "Pick your places" : picked.length === 1 ? `Add ${placeType(picked[0]!).label}` : `Add ${picked.length} places`}
        </Button>
        <button type="button" onClick={onOwn} className="inline-flex min-h-11 items-center gap-1.5 text-[15px] font-semibold text-leaf max-sm:mx-auto">
          <IconPlus className="size-4" /> Add one with its own name
        </button>
      </div>
    </section>
  );
}

/** Shown once a household has places but nothing in them yet: where adding things starts. */
export function FirstThingsTip() {
  return (
    <p className="rounded-2xl border border-line bg-card px-4 py-3.5 text-[15px]">
      <b>Next, add what&apos;s in them.</b> Tap the green scan button and photograph a label, a barcode or a whole shelf. Or open a place and tap <b>Add</b>.
    </p>
  );
}
