"use client";

import { useEffect, useState } from "react";
import type { StockItem } from "@/lib/domain/stock";
import { formatMonth } from "@/lib/domain/dates";
import { fromStock } from "@/lib/domain/shopping";
import { wineTitle } from "@/lib/domain/wine";
import { addToList } from "@/lib/shopping";
import { addWineNote, loadWineNotes, removeWineNote, type WineNote } from "@/lib/wineNotes";
import { friendlyError } from "@/lib/supabase/errors";
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { IconStar } from "@/components/ui/icons";

/** Five stars to tap. Tapping the chosen star again clears it. */
function StarPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex gap-1" role="radiogroup" aria-label="How many stars">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={n === 1 ? "1 star" : `${n} stars`}
          onClick={() => onChange(value === n ? 0 : n)}
          className="grid size-11 place-items-center rounded-xl transition active:scale-90"
        >
          <IconStar className={`size-8 ${n <= value ? "fill-[#e9b949]! stroke-[#c8962a]!" : "text-mute/40"}`} />
        </button>
      ))}
    </div>
  );
}

function Stars({ n }: { n: number }) {
  return (
    <span className="inline-flex shrink-0 gap-px" aria-label={`${n} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <IconStar key={i} className={`size-3.5 ${i <= n ? "fill-[#e9b949]! stroke-[#c8962a]!" : "text-mute/40"}`} />
      ))}
    </span>
  );
}

/**
 * After a bottle is opened: how was it? Stars and a note are kept with the wine for next time, and
 * "Buy again" puts it on the shopping list. Everything is optional; Skip closes it.
 */
export function WineRating({
  item,
  householdId,
  left,
  onDone,
}: {
  item: StockItem;
  householdId: string;
  /** Bottles left after this one. */
  left: number;
  onDone: () => void;
}) {
  const [stars, setStars] = useState(0);
  const [note, setNote] = useState("");
  const [again, setAgain] = useState(left === 0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const name = wineTitle(item.productName, item.vintage);

  async function save() {
    setError(null);
    setBusy(true);
    try {
      if (stars || note.trim()) await addWineNote(householdId, item.productName, item.vintage, stars || null, note);
      if (again) await addToList(householdId, fromStock(item)).catch(() => false);
      onDone();
    } catch (err) {
      setError(friendlyError(err));
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-[var(--radius-card)] border border-line bg-card p-4">
      <div>
        <p className="font-display text-[19px] font-bold">Opened one. How was it?</p>
        <p className="text-sm text-mute">{left === 0 ? `That was the last ${name}.` : `${left === 1 ? "1 bottle" : `${left} bottles`} of ${name} left.`}</p>
      </div>
      <StarPicker value={stars} onChange={setStars} />
      <label className="flex flex-col gap-1.5">
        <span className="sr-only">A note about it</span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={500}
          rows={2}
          placeholder="Optional, e.g. Lovely with the Sunday roast"
          className="w-full rounded-2xl border border-line bg-card px-4 py-3 text-base placeholder:text-mute/80 focus:border-leaf focus:ring-4 focus:ring-leaf/15 focus:outline-none"
        />
      </label>
      <label className="flex min-h-11 cursor-pointer items-center gap-3 text-[15px]">
        <input type="checkbox" checked={again} onChange={(e) => setAgain(e.target.checked)} className="size-5 accent-[var(--color-go)]" />
        <span>
          Buy again <span className="block text-[13px] text-mute">Adds it to the shopping list</span>
        </span>
      </label>
      {error ? <Notice>{error}</Notice> : null}
      <div className="flex gap-2">
        <Button className="flex-1" busy={busy} onClick={save}>
          {stars || note.trim() ? "Save note" : again ? "Add to shopping list" : "Done"}
        </Button>
        <Button variant="ghost" onClick={onDone} disabled={busy}>
          Skip
        </Button>
      </div>
    </div>
  );
}

/** "How it's been": what the household thought of this wine each time one was opened. */
export function WineNotesList({ item, householdId, names }: { item: StockItem; householdId: string; names: Map<string, string> }) {
  const [notes, setNotes] = useState<WineNote[] | null>(null);
  const [me, setMe] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    supabase()
      .auth.getSession()
      .then(({ data }) => live && setMe(data.session?.user.id ?? null))
      .catch(() => {});
    loadWineNotes(householdId, item.productName, item.vintage)
      .then((n) => live && setNotes(n))
      .catch(() => live && setNotes([]));
    return () => {
      live = false;
    };
  }, [householdId, item.productName, item.vintage]);

  if (!notes || notes.length === 0) return null;
  return (
    <section aria-labelledby="wine-notes-h" className="flex flex-col gap-2">
      <h3 id="wine-notes-h" className="text-[13px] font-semibold text-mute">
        How it&apos;s been
      </h3>
      <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card">
        {notes.map((n) => (
          <li key={n.id} className="flex items-start gap-2 px-3.5 py-2.5 text-sm">
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-x-2">
                {n.stars ? <Stars n={n.stars} /> : null}
                {n.note ? <span>{n.note}</span> : null}
              </p>
              <p className="text-[12.5px] text-mute">{[(n.notedBy && names.get(n.notedBy)) || null, formatMonth(n.notedAt.slice(0, 10))].filter(Boolean).join(" · ")}</p>
            </div>
            {me && n.notedBy === me ? (
              <button
                onClick={() => removeWineNote(n.id).then(() => setNotes((all) => (all ?? []).filter((x) => x.id !== n.id))).catch(() => {})}
                className="min-h-9 shrink-0 text-[13px] font-semibold text-mute"
                aria-label="Remove this note"
              >
                Remove
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
