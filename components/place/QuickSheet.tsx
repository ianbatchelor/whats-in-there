"use client";

import { useEffect, useState } from "react";
import type { LocationType } from "@/lib/household";
import type { StockItem } from "@/lib/domain/stock";
import { moveItem, searchItems } from "@/lib/stock";
import { friendlyError } from "@/lib/supabase/errors";
import { Sheet } from "@/components/ui/Sheet";
import { Notice } from "@/components/ui/Notice";
import { ItemList, ItemRow } from "@/components/stock/ItemRow";
import { IconChevronLeft, IconMinus, IconMove, IconPlus, IconSearch } from "@/components/ui/icons";

type Mode = "choose" | "out" | "moved";

/**
 * What opens when someone taps a place's sticker or scans its QR label: the two or three things
 * people actually do standing at the fridge or the shelf, as big buttons, before the full page.
 */
export function QuickSheet({
  open,
  onClose,
  place,
  items,
  keep,
  placeName,
  onPutIn,
  onTakeOne,
  taking,
  onOpenItem,
  onMoved,
}: {
  open: boolean;
  onClose: () => void;
  place: { id: string; name: string; type: LocationType; householdId: string };
  items: StockItem[] | null;
  /** A place things are kept in (shelves, boxes) rather than used up from (fridge, freezer). */
  keep: boolean;
  /** Names of other places, for showing where a found thing is now. */
  placeName: (locationId: string) => string | undefined;
  onPutIn: () => void;
  onTakeOne: (item: StockItem) => void;
  taking: string | null;
  onOpenItem: (item: StockItem) => void;
  onMoved: (item: StockItem, movementId: string | null) => void;
}) {
  const [mode, setMode] = useState<Mode>("choose");
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<StockItem[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Each time it opens, start from the choice again.
  useEffect(() => {
    if (!open) return;
    /* eslint-disable react-hooks/set-state-in-effect */
    setMode("choose");
    setQuery("");
    setFound(null);
    setError(null);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [open]);

  // "Something moved here": look for it everywhere else in the house as they type.
  useEffect(() => {
    if (mode !== "moved") return;
    const q = query.trim();
    if (q.length < 2) {
      setFound(null); // eslint-disable-line react-hooks/set-state-in-effect
      return;
    }
    let live = true;
    const t = setTimeout(() => {
      searchItems(place.householdId, q)
        .then((r) => live && setFound(r.filter((i) => i.locationId !== place.id)))
        .catch((e) => live && setError(friendlyError(e)));
    }, 200);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [mode, query, place.householdId, place.id]);

  async function moveHere(item: StockItem) {
    setBusy(item.id);
    setError(null);
    try {
      const { item: moved, movementId } = await moveItem(item, place.id);
      onMoved(moved, movementId);
      onClose();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(null);
    }
  }

  const q = query.trim().toLowerCase();
  const here = (items ?? []).filter((i) => !q || `${i.productName} ${i.brand ?? ""} ${i.category ?? ""}`.toLowerCase().includes(q));

  const back = (
    <button onClick={() => setMode("choose")} className="-ml-1 flex min-h-11 w-fit items-center gap-1 pr-3 font-display font-semibold text-leaf">
      <IconChevronLeft className="size-5" /> Back
    </button>
  );
  const search = (label: string, placeholder: string) => (
    <label className="flex min-h-12 items-center gap-3 rounded-xl border border-line bg-card px-4 focus-within:ring-2 focus-within:ring-leaf/40">
      <IconSearch className="size-5 shrink-0 text-mute" />
      <input
        id={`quick-${mode}`}
        type="search"
        autoFocus
        aria-label={label}
        placeholder={placeholder}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-mute"
      />
    </label>
  );

  return (
    <Sheet open={open} onClose={onClose} title={place.name}>
      {mode === "choose" ? (
        <div className="flex flex-col gap-3">
          <p className="-mt-1 text-mute">What are you doing?</p>
          {keep ? (
            <Choice Icon={IconMove} title="Something moved here" sub="Find it in another place and move it here" onClick={() => setMode("moved")} primary />
          ) : null}
          <Choice
            Icon={IconPlus}
            title={keep ? "Put something new in" : "Put something in"}
            sub="Scan the label or type it"
            onClick={() => {
              onClose();
              onPutIn();
            }}
            primary={!keep}
          />
          <Choice
            Icon={IconMinus}
            title={keep ? "Took something away" : "Took something out"}
            sub={
              items && items.length === 0
                ? "Nothing is recorded in here yet"
                : keep
                  ? "Move it, lend it or take it off the list"
                  : "Pick it from what's in here"
            }
            onClick={() => setMode("out")}
            disabled={!items || items.length === 0}
          />
          {!keep ? (
            <Choice Icon={IconMove} title="Something moved here" sub="Find it in another place and move it here" onClick={() => setMode("moved")} />
          ) : null}
          <button onClick={onClose} className="mt-1 min-h-11 text-[15px] font-semibold text-leaf">
            Just looking: see everything in here
          </button>
        </div>
      ) : mode === "out" ? (
        <div className="flex flex-col gap-3">
          {back}
          {(items?.length ?? 0) > 6 ? search(`Search ${place.name}`, "Search in here") : null}
          {here.length > 0 ? (
            <ItemList>
              {here.map((item, i) => (
                <ItemRow
                  key={item.id}
                  index={i}
                  item={item}
                  placeType={place.type}
                  keep={keep}
                  highlight={query}
                  onOpen={(it) => {
                    onClose();
                    onOpenItem(it);
                  }}
                  onTakeOne={onTakeOne}
                  taking={taking === item.id}
                />
              ))}
            </ItemList>
          ) : (
            <p className="text-mute">Nothing matches &ldquo;{query.trim()}&rdquo; in here.</p>
          )}
          <p className="text-[13.5px] text-mute">
            {keep ? "Tap a thing to move it, lend it or take it off the list." : "Tap − to take one out, or tap a thing to choose how much."}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {back}
          {search("What moved here?", "What did you put here?")}
          {error ? <Notice>{error}</Notice> : null}
          {found === null ? (
            <p className="text-[14px] text-mute">Type a couple of letters and it&apos;ll look in all your other places.</p>
          ) : found.length === 0 ? (
            <p className="text-[14px] text-mute">Nothing called that in your other places. Use Put something in to add it here instead.</p>
          ) : (
            <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card">
              {found.map((item) => (
                <li key={item.id}>
                  <button
                    onClick={() => moveHere(item)}
                    disabled={busy !== null}
                    aria-label={`Move ${item.productName} here from ${placeName(item.locationId) ?? "another place"}`}
                    className="flex min-h-14 w-full items-center gap-3 px-3.5 py-2.5 text-left transition hover:bg-sunk/70 active:bg-sunk disabled:opacity-50"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-semibold">{item.productName}</span>
                      <span className="block truncate text-[13px] text-mute">Now in {placeName(item.locationId) ?? "another place"}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1 rounded-xl bg-go px-3 py-2 text-[14px] font-semibold text-on-go">
                      <IconMove className="size-4" /> {busy === item.id ? "Moving…" : "Move here"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Sheet>
  );
}

function Choice({
  Icon,
  title,
  sub,
  onClick,
  primary,
  disabled,
}: {
  Icon: (p: { className?: string }) => React.ReactNode;
  title: string;
  sub: string;
  onClick: () => void;
  primary?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex min-h-[72px] w-full items-center gap-4 rounded-2xl border px-4 py-3 text-left transition active:scale-[0.99] disabled:opacity-50 ${
        primary ? "border-go bg-go text-on-go shadow-[var(--shadow-card)]" : "border-line bg-card hover:bg-sunk/70"
      }`}
    >
      <span className={`grid size-11 shrink-0 place-items-center rounded-xl ${primary ? "bg-on-go/15" : "bg-sunk text-leaf"}`}>
        <Icon className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-display text-[17px] leading-snug font-bold">{title}</span>
        <span className={`block text-[14px] leading-snug ${primary ? "text-on-go/80" : "text-mute"}`}>{sub}</span>
      </span>
    </button>
  );
}
