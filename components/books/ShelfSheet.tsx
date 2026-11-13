"use client";

import { useMemo, useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Notice } from "@/components/ui/Notice";
import { IconChevronRight } from "@/components/ui/icons";
import { placeType } from "@/components/home/placeTypes";
import { friendlyError } from "@/lib/supabase/errors";
import type { Place } from "@/lib/household";
import type { WishIdea } from "@/lib/domain/presents";

/**
 * "Got it": the book has arrived, so it comes off the wish list and goes onto a shelf. Bookshelves
 * come first, then everywhere else, with boxes and shelves under the place they sit in.
 */
export function ShelfSheet({
  book,
  places,
  onClose,
  onPut,
}: {
  book: WishIdea | null;
  places: Place[];
  onClose: () => void;
  onPut: (book: WishIdea, place: Place) => Promise<void>;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const ordered = useMemo(() => {
    const byName = new Map(places.map((p) => [p.id, p]));
    const label = (p: Place) => (p.parentId && byName.get(p.parentId) ? `${byName.get(p.parentId)!.name} › ${p.name}` : p.name);
    const shelves = places.filter((p) => p.type === "bookshelf" || (p.parentId && byName.get(p.parentId)?.type === "bookshelf"));
    const rest = places.filter((p) => !shelves.includes(p));
    const sort = (a: Place, b: Place) => label(a).localeCompare(label(b));
    return { shelves: shelves.sort(sort), rest: rest.sort(sort), label };
  }, [places]);

  async function put(place: Place) {
    if (!book) return;
    setBusy(place.id);
    setError(null);
    try {
      await onPut(book, place);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(null);
    }
  }

  const row = (p: Place) => {
    const { Icon } = placeType(p.type);
    return (
      <li key={p.id}>
        <button
          onClick={() => put(p)}
          disabled={busy !== null}
          className="flex min-h-12 w-full items-center gap-3 rounded-2xl border border-line bg-card px-3.5 text-left transition hover:bg-sunk disabled:opacity-60"
        >
          <Icon className="size-5 shrink-0 text-leaf" />
          <span className="min-w-0 flex-1 truncate font-semibold">{ordered.label(p)}</span>
          {busy === p.id ? <span className="text-[13px] text-mute">Putting it there…</span> : <IconChevronRight className="size-4 shrink-0 text-mute" />}
        </button>
      </li>
    );
  };

  return (
    <Sheet open={!!book} onClose={onClose} title="Where's it going?">
      <div className="-mx-1 flex max-h-[70dvh] flex-col gap-3 overflow-y-auto px-1 pb-1">
        <p className="text-[15px] text-mute">
          {book ? <b className="text-fg">{book.title}</b> : null} comes off the wish list and goes on the shelf you pick, so you can always find it.
        </p>
        {error ? <Notice>{error}</Notice> : null}
        {ordered.shelves.length ? <ul className="flex flex-col gap-2">{ordered.shelves.map(row)}</ul> : null}
        {ordered.rest.length ? (
          <>
            {ordered.shelves.length ? <p className="pt-1 text-[13px] font-semibold text-mute">Somewhere else</p> : null}
            <ul className="flex flex-col gap-2">{ordered.rest.map(row)}</ul>
          </>
        ) : null}
        {places.length === 0 ? <p className="text-mute">Add a place on Home first, such as a bookshelf.</p> : null}
      </div>
    </Sheet>
  );
}
