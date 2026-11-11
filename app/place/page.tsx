"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthGate } from "@/components/AuthGate";
import { supabase } from "@/lib/supabase/client";
import { friendlyError } from "@/lib/supabase/errors";
import { useQueryParam } from "@/lib/hooks/useQueryParam";
import { loadMembers, loadPlace, type LocationType } from "@/lib/household";
import type { StockItem } from "@/lib/domain/stock";
import { formatQuantity } from "@/lib/domain/quantity";
import { loadItems, loadPlaceLastActivity } from "@/lib/stock";
import { countThings } from "@/lib/domain/places";
import { itemStatus, needsAttention } from "@/lib/domain/status";
import { AppShell, SectionLabel } from "@/components/AppShell";
import { Screen, Splash } from "@/components/ui/Screen";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { Toast } from "@/components/ui/Toast";
import { IconChevronLeft, IconPencil, IconPlus, IconSearch, IconStack, IconSticker } from "@/components/ui/icons";
import { PlacePhoto } from "@/components/art/PlacePhoto";
import { timeAgo } from "@/lib/domain/dates";
import { placeType } from "@/components/home/placeTypes";
import { ItemList, ItemListSkeleton, ItemRow } from "@/components/stock/ItemRow";
import { useUndoToast } from "@/components/stock/useUndoToast";
import { useQuickTake } from "@/components/stock/useQuickTake";
import { AddItemSheet } from "@/components/stock/AddItemSheet";
import { AddManySheet } from "@/components/stock/AddManySheet";
import { groupByCategory, looksLikeBooks } from "@/lib/domain/manyItems";
import { TakeOutSheet } from "@/components/stock/TakeOutSheet";
import { EditPlaceSheet } from "@/components/stock/EditPlaceSheet";
import { StickerSheet } from "@/components/stickers/StickerSheet";
import { useCollapsingHeader } from "@/components/common/useCollapsingHeader";

/** Places where the order is "use first" (by date), not sections. */
const USE_FIRST_PLACES: LocationType[] = ["freezer", "fridge", "pantry", "wine", "garden"];

type PlaceInfo = { id: string; name: string; type: LocationType; householdId: string; imagePath?: string | null };

export default function PlacePage() {
  return <AuthGate>{() => <Place />}</AuthGate>;
}

function Place() {
  const id = useQueryParam("id");
  const router = useRouter();
  const [place, setPlace] = useState<PlaceInfo | null>(null);
  const [items, setItems] = useState<StockItem[] | null>(null);
  const [names, setNames] = useState<Map<string, string>>(new Map());
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [adding, setAdding] = useState(false);
  const [many, setMany] = useState(false);
  const [editing, setEditing] = useState(false);
  const [sticker, setSticker] = useState(false);
  const [open, setOpen] = useState<StockItem | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [last, setLast] = useState<{ actor: string | null; at: string } | null>(null);
  const { header: heroHeader, bar: heroBar, big: heroBig, small: heroSmall, shade: heroShade } = useCollapsingHeader(place !== null);

  const refresh = useCallback(async (locationId: string) => {
    try {
      const [list, latest] = await Promise.all([loadItems(locationId), loadPlaceLastActivity(locationId).catch(() => null)]);
      setItems(list);
      setLast(latest);
    } catch (e) {
      setError(friendlyError(e));
    }
  }, []);

  useEffect(() => {
    if (id === undefined) return;
    if (!id) {
      router.replace("/");
      return;
    }
    let active = true;
    (async () => {
      try {
        const p = await loadPlace(id);
        if (!active) return;
        if (!p) return setMissing(true);
        setPlace(p);
        const [members] = await Promise.all([loadMembers(p.householdId), refresh(p.id)]);
        if (active) setNames(new Map(members.map((m) => [m.userId, m.displayName])));
      } catch (e) {
        if (active) setError(friendlyError(e));
      }
    })();
    return () => {
      active = false;
    };
  }, [id, router, refresh]);

  // Someone else in the household adds or takes something out: refresh this list.
  useEffect(() => {
    if (!place) return;
    const channel = supabase()
      .channel(`place:${place.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "stock_items", filter: `location_id=eq.${place.id}` }, () => refresh(place.id))
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "storage_locations", filter: `id=eq.${place.id}` }, async () => {
        const p = await loadPlace(place.id).catch(() => null);
        if (p) setPlace(p);
        else setMissing(true);
      })
      .subscribe();
    return () => {
      supabase().removeChannel(channel);
    };
  }, [place?.id, refresh]); // eslint-disable-line react-hooks/exhaustive-deps

  const categories = useMemo(() => {
    const set = new Set((items ?? []).map((i) => i.category?.trim()).filter((c): c is string => !!c));
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [items]);

  const shown = useMemo(() => {
    if (!items) return null;
    const q = filter.trim().toLowerCase();
    return items.filter(
      (i) =>
        (!category || i.category?.trim() === category) &&
        (!q || [i.productName, i.brand, i.category, i.notes].some((v) => v?.toLowerCase().includes(q))),
    );
  }, [items, filter, category]);

  // Shelves, rails and boxes read best in sections (Fiction, Coats…) in A to Z order; food stays
  // in use-first order. Sections show only when nothing is being searched or filtered.
  const sections = useMemo(() => {
    if (!place || !items || USE_FIRST_PLACES.includes(place.type) || filter.trim() || category) return null;
    const cats = items.map((i) => i.category?.trim() ?? "").filter(Boolean);
    if (new Set(cats).size < 2) return null;
    return groupByCategory(items, (i) => ({ name: i.productName, detail: i.brand ?? "", category: i.category?.trim() || "Other" }), looksLikeBooks(cats));
  }, [place, items, filter, category]);

  const { toast, clear, announce } = useUndoToast(() => {
    if (place) refresh(place.id);
  });

  const { taking, takeOne } = useQuickTake(announce, () => {
    if (place) refresh(place.id);
  });

  if (missing) {
    return (
      <Screen className="justify-center">
        <h1 className="font-display text-2xl font-bold">This place isn&apos;t available</h1>
        <p className="text-mute">It may have been removed, or it belongs to a household you&apos;re not in.</p>
        <Link href="/" className="font-bold text-go">
          Go to your places
        </Link>
      </Screen>
    );
  }
  if (error && !place) {
    return (
      <Screen className="justify-center">
        <Notice>{error}</Notice>
        <Button variant="ghost" onClick={() => window.location.reload()}>
          Try again
        </Button>
      </Screen>
    );
  }
  if (!place) return <Splash />;

  const info = placeType(place.type);
  const count = items?.length ?? 0;
  const filtering = filter.trim() !== "" || category !== null;
  const due = (items ?? []).filter((i) => needsAttention(i));
  const lateHere = due.filter((i) => itemStatus(i)?.tone === "late").length;
  const soonHere = due.length - lateHere;
  const summary = [
    // "Kitchen fridge · Fridge" says it twice, and "Something else" says nothing, so the kind is left out then.
    place.type === "other" || place.name.toLowerCase().includes(info.label.toLowerCase()) ? null : info.label,
    items ? countThings(count) : null,
    lateHere > 0 ? `${lateHere} past ${lateHere === 1 ? "its date" : "a date"}` : null,
    soonHere > 0 ? `${soonHere} to use soon` : null,
    last ? `updated ${timeAgo(last.at)}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const catCount = (c: string) => (items ?? []).filter((i) => i.category?.trim() === c).length;

  return (
    <AppShell wide>
      <div
        ref={heroHeader}
        className="reveal relative z-20 -mx-4 -mt-[max(16px,env(safe-area-inset-top))] overflow-hidden max-sm:sticky max-sm:top-0 max-sm:shadow-[0_10px_24px_-18px_rgba(0,0,0,0.5)] sm:mx-0 sm:mt-0 sm:rounded-[24px]"
      >
        <div className="h-56 sm:h-64 lg:h-72">
          <PlacePhoto type={place.type} imagePath={place.imagePath} variant="wide" eager className="reveal-img" />
        </div>
        <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-black/0 to-black/70" aria-hidden="true" />
        {/* Darkens the photo as the header shrinks, so the small title stays readable. */}
        <div ref={heroShade} className="pointer-events-none absolute inset-0 bg-black/45 opacity-0" aria-hidden="true" />
        <div ref={heroBar} className="absolute inset-x-0 top-0 z-10 flex items-center justify-between gap-3 px-4 pt-[max(12px,env(safe-area-inset-top))] will-change-transform sm:p-4">
          <Link href="/" aria-label="Back to My Places" className="grid size-11 place-items-center rounded-full bg-[#fffdf8]/92 text-[#17242a] shadow-[var(--shadow-card)] backdrop-blur transition hover:bg-[#fffdf8]">
            <IconChevronLeft className="size-5" />
          </Link>
          <span ref={heroSmall} aria-hidden="true" className="min-w-0 flex-1 truncate font-display text-[17px] font-bold text-[#fffdf8] opacity-0 sm:hidden">
            {place.name}
          </span>
          <div className="flex shrink-0 gap-2">
            <button
              onClick={() => setSticker(true)}
              aria-label={`Sticker and QR label for ${place.name}`}
              className="grid size-11 place-items-center rounded-full bg-[#fffdf8]/92 text-[#17242a] shadow-[var(--shadow-card)] backdrop-blur transition hover:bg-[#fffdf8]"
            >
              <IconSticker className="size-5" />
            </button>
            <button
              onClick={() => setEditing(true)}
              aria-label={`Edit ${place.name}`}
              className="grid size-11 place-items-center rounded-full bg-[#fffdf8]/92 text-[#17242a] shadow-[var(--shadow-card)] backdrop-blur transition hover:bg-[#fffdf8]"
            >
              <IconPencil className="size-[18px]" />
            </button>
          </div>
        </div>
        <div ref={heroBig} className="absolute inset-x-5 bottom-4 text-[#fffdf8] sm:inset-x-7 sm:bottom-6">
          <h1 className="truncate font-display text-[1.9rem] leading-tight font-bold tracking-[-0.025em] [text-shadow:0_2px_12px_rgba(0,0,0,0.3)] sm:text-[2.3rem]">
            {place.name}
          </h1>
          <p className="truncate text-[14px] text-[#fffdf8]/90">{summary}</p>
        </div>
      </div>

      {error ? <Notice>{error}</Notice> : null}

      {items && items.length > 0 ? (
        // On phones the search and Add row stays just under the shrunken header, so Add is always in reach.
        <div className="flex flex-col gap-3 max-sm:sticky max-sm:top-[calc(max(12px,env(safe-area-inset-top))+56px)] max-sm:z-10 max-sm:-mx-4 max-sm:bg-bg/95 max-sm:px-4 max-sm:py-2 max-sm:backdrop-blur">
          <div className="flex gap-2">
            <label className="flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-xl border border-line bg-card px-4 focus-within:border-leaf">
              <IconSearch className="size-5 shrink-0 text-mute" />
              <input
                type="search"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Search in here"
                aria-label={`Search ${place.name}`}
                className="min-w-0 flex-1 bg-transparent text-base placeholder:text-mute focus:outline-none focus-visible:outline-none"
              />
            </label>
            <Button className="min-h-12 shrink-0 px-4" onClick={() => setAdding(true)}>
              <IconPlus /> Add item
            </Button>
          </div>
          {categories.length > 1 ? (
            <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label="Filter by category">
              {[null, ...categories].map((c) => {
                const on = category === c;
                return (
                  <button
                    key={c ?? "all"}
                    onClick={() => setCategory(c)}
                    aria-pressed={on}
                    className={`min-h-9 shrink-0 rounded-full px-3.5 text-[13px] font-semibold transition ${
                      on ? "bg-go text-on-go" : "bg-sunk text-fg/80 hover:text-fg"
                    }`}
                  >
                    {c ?? "All"} <span className={on ? "opacity-80" : "text-mute"}>{c ? catCount(c) : count}</span>
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}

      {shown === null ? (
        <ItemListSkeleton rows={4} />
      ) : items!.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-[24px] bg-sunk/60 px-6 py-10 text-center">
          <span className="block h-28 w-40 overflow-hidden rounded-2xl opacity-90 shadow-[var(--shadow-card)]">
            <PlacePhoto type={place.type} imagePath={place.imagePath} />
          </span>
          <h2 className="mt-2 font-display text-xl font-bold">Nothing recorded here yet</h2>
          <p className="max-w-sm text-sm text-mute">
            Add what&apos;s in {place.name} as you put it in, like &ldquo;{info.thing}&rdquo;. It takes a few seconds per thing.
          </p>
          <div className="flex flex-wrap justify-center gap-2.5">
            <Button onClick={() => setAdding(true)}>
              <IconPlus /> Add the first thing
            </Button>
            <Button variant="ghost" onClick={() => setMany(true)}>
              <IconStack /> Snap a whole shelf
            </Button>
          </div>
        </div>
      ) : shown.length === 0 ? (
        <p className="text-mute">
          Nothing matches{filter.trim() ? <> &ldquo;{filter.trim()}&rdquo;</> : null}
          {category ? ` in ${category}` : ""}.
        </p>
      ) : sections ? (
        sections.map((sec, n) => (
          <section key={sec.category} aria-labelledby={`sec-${n}`} className="flex flex-col gap-2.5">
            <SectionLabel id={`sec-${n}`}>
              {sec.category} <span className="font-semibold text-mute">· {sec.items.length}</span>
            </SectionLabel>
            <ItemList>
              {sec.items.map((item, i) => (
                <ItemRow key={item.id} index={i} item={item} addedBy={(item.addedBy && names.get(item.addedBy)) || ""} onOpen={setOpen} onTakeOne={takeOne} taking={taking === item.id} />
              ))}
            </ItemList>
          </section>
        ))
      ) : (
        <section aria-labelledby="items-h" className="flex flex-col gap-2.5">
          <SectionLabel id="items-h">{filtering ? countThings(shown.length) : ["freezer", "fridge", "pantry"].includes(place.type) ? "Use first" : "In here"}</SectionLabel>
          <ItemList>
            {shown.map((item, i) => (
              <ItemRow key={item.id} index={i} item={item} addedBy={(item.addedBy && names.get(item.addedBy)) || ""} onOpen={setOpen} onTakeOne={takeOne} taking={taking === item.id} />
            ))}
          </ItemList>
        </section>
      )}

      <AddItemSheet
        open={adding}
        onClose={() => setAdding(false)}
        place={place}
        onAdded={(item, movementId) => {
          refresh(place.id);
          announce(`Added ${item.productName}`, movementId);
        }}
        onMany={() => setMany(true)}
      />
      {many ? (
        <AddManySheet
          open={many}
          onClose={() => setMany(false)}
          place={place}
          existing={items ?? []}
          onAdded={(words) => {
            refresh(place.id);
            announce(`Added ${words} to ${place.name}`, null);
          }}
        />
      ) : null}
      <TakeOutSheet
        item={open}
        names={names}
        onClose={() => setOpen(null)}
        onTaken={(before, after, amount, movementId) => {
          refresh(place.id);
          const left = after.quantity > 0 ? `, ${formatQuantity(after.quantity, after.unit)} left` : ", all gone";
          announce(`Took out ${formatQuantity(amount, before.unit)} of ${before.productName}${left}`, movementId);
        }}
        onChanged={(message, movementId) => {
          refresh(place.id);
          announce(message, movementId);
        }}
      />
      {editing ? (
        <EditPlaceSheet
          open={editing}
          onClose={() => setEditing(false)}
          place={place}
          itemCount={count}
          onSaved={async () => {
            const p = await loadPlace(place.id).catch(() => null);
            if (p) setPlace(p);
          }}
          onRemoved={() => router.replace("/")}
        />
      ) : null}
      {sticker ? <StickerSheet open={sticker} onClose={() => setSticker(false)} place={place} /> : null}
      <Toast toast={toast} onDone={clear} />
    </AppShell>
  );
}
