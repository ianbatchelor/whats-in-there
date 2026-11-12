"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthGate } from "@/components/AuthGate";
import { supabase } from "@/lib/supabase/client";
import { friendlyError } from "@/lib/supabase/errors";
import { useQueryParam } from "@/lib/hooks/useQueryParam";
import { loadMembers, loadPlace, loadPlaces, type LocationType, type Place as PlaceRow } from "@/lib/household";
import type { StockItem } from "@/lib/domain/stock";
import { loadItems, loadPeeks, loadPlaceLastActivity } from "@/lib/stock";
import { boxesIn, countThings, isKeepPlace, isUseUpPlace } from "@/lib/domain/places";
import { itemStatus, needsAttention } from "@/lib/domain/status";
import { AppShell, SectionLabel } from "@/components/AppShell";
import { Screen, Splash } from "@/components/ui/Screen";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { Toast } from "@/components/ui/Toast";
import { IconChevronLeft, IconGrid, IconList, IconPencil, IconPlus, IconSearch, IconStack, IconSticker } from "@/components/ui/icons";
import { PlacePhoto } from "@/components/art/PlacePhoto";
import { BoxCover } from "@/components/place/BoxCover";
import { pickPeeks, toPeek, type Peek } from "@/lib/domain/boxLook";
import { timeAgo } from "@/lib/domain/dates";
import { placeType } from "@/components/home/placeTypes";
import { ItemList, ItemListSkeleton, ItemRow } from "@/components/stock/ItemRow";
import { ItemGrid } from "@/components/stock/ItemGrid";
import { tookOutMessage } from "@/components/stock/useQuickTake";
import { usePlaceView } from "@/components/stock/usePlaceView";
import { useUndoToast } from "@/components/stock/useUndoToast";
import { useQuickTake } from "@/components/stock/useQuickTake";
import { AddItemSheet } from "@/components/stock/AddItemSheet";
import { StarterThings } from "@/components/place/StarterThings";
import { QuickSheet } from "@/components/place/QuickSheet";
import { AddManySheet } from "@/components/stock/AddManySheet";
import { groupByCategory, looksLikeBooks } from "@/lib/domain/manyItems";
import { TakeOutSheet } from "@/components/stock/TakeOutSheet";
import { EditPlaceSheet } from "@/components/stock/EditPlaceSheet";
import { StickerSheet } from "@/components/stickers/StickerSheet";
import { useCollapsingHeader } from "@/components/common/useCollapsingHeader";
import { AddPlaceTile, PlaceCard } from "@/components/home/PlaceCard";
import { AddPlaceSheet } from "@/components/home/AddPlaceSheet";

type PlaceInfo = { id: string; name: string; type: LocationType; householdId: string; imagePath?: string | null; parentId?: string | null };

export default function PlacePage() {
  return <AuthGate>{() => <Place />}</AuthGate>;
}

function Place() {
  const id = useQueryParam("id");
  // Arrived from the place's sticker or QR label: start with the quick choices.
  const fromSticker = useQueryParam("quick") === "1";
  const [quick, setQuick] = useState(false);
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
  /** Every place in the household, for the boxes inside this one and the place this one is in. */
  const [family, setFamily] = useState<PlaceRow[] | null>(null);
  const [addingBox, setAddingBox] = useState(false);
  /** A few things from each box inside this place, for their covers. */
  const [peeks, setPeeks] = useState<Map<string, Peek[]> | null>(null);
  // Pictures first on a bookshelf, or wherever most things have a photo.
  const pictures = place?.type === "bookshelf" || (!!items && items.length > 0 && items.filter((i) => i.imagePath).length * 2 >= items.length);
  const [view, setView] = usePlaceView(place?.id ?? null, pictures);
  const { header: heroHeader, bar: heroBar, big: heroBig, small: heroSmall, shade: heroShade } = useCollapsingHeader(place !== null);

  const refresh = useCallback(async (locationId: string, householdId?: string) => {
    try {
      const [list, latest, all] = await Promise.all([
        loadItems(locationId),
        loadPlaceLastActivity(locationId).catch(() => null),
        householdId ? loadPlaces(householdId).catch(() => null) : Promise.resolve(null),
      ]);
      setItems(list);
      setLast(latest);
      if (all) setFamily(all);
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
        const [members] = await Promise.all([loadMembers(p.householdId), refresh(p.id, p.householdId)]);
        if (active) setNames(new Map(members.map((m) => [m.userId, m.displayName])));
      } catch (e) {
        if (active) setError(friendlyError(e));
      }
    })();
    return () => {
      active = false;
    };
  }, [id, router, refresh]);

  useEffect(() => {
    if (!place || !fromSticker) return;
    setQuick(true); // eslint-disable-line react-hooks/set-state-in-effect
    // Back or a reload shouldn't open it again.
    window.history.replaceState(window.history.state, "", `/place/?id=${place.id}`);
  }, [place, fromSticker]);

  // Someone else in the household adds or takes something out: refresh this list.
  useEffect(() => {
    if (!place) return;
    const channel = supabase()
      .channel(`place:${place.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "stock_items", filter: `location_id=eq.${place.id}` }, () => refresh(place.id))
      .on("postgres_changes", { event: "*", schema: "public", table: "storage_locations", filter: `household_id=eq.${place.householdId}` }, () =>
        loadPlaces(place.householdId)
          .then(setFamily)
          .catch(() => {}),
      )
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
      (i) => (!category || i.category?.trim() === category) && (!q || [i.productName, i.brand, i.category, i.notes].some((v) => v?.toLowerCase().includes(q))),
    );
  }, [items, filter, category]);

  // Shelves, rails and boxes read best in sections (Fiction, Coats…) in A to Z order; food stays
  // in use-first order. Sections show only when nothing is being searched or filtered.
  const sections = useMemo(() => {
    if (!place || !items || isUseUpPlace(place.type) || filter.trim() || category) return null;
    const cats = items.map((i) => i.category?.trim() ?? "").filter(Boolean);
    if (new Set(cats).size < 2) return null;
    return groupByCategory(items, (i) => ({ name: i.productName, detail: i.brand ?? "", category: i.category?.trim() || "Other" }), looksLikeBooks(cats));
  }, [place, items, filter, category]);

  // Covers for the boxes inside this place: one query for a few things from each. Reloaded when a
  // box is added, renamed or gets more things (its count changes).
  const boxKey =
    place && family && !place.parentId
      ? boxesIn(family, place.id)
          .map((b) => `${b.id}:${b.itemCount}`)
          .join(",")
      : "";
  useEffect(() => {
    if (!boxKey) {
      setPeeks(null); // eslint-disable-line react-hooks/set-state-in-effect
      return;
    }
    let live = true;
    loadPeeks(boxKey.split(",").map((k) => k.split(":")[0]!))
      .then((m) => live && setPeeks(m))
      .catch(() => live && setPeeks(new Map()));
    return () => {
      live = false;
    };
  }, [boxKey]);

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
  const keep = isKeepPlace(place.type);
  const parent = place.parentId ? (family?.find((p) => p.id === place.parentId) ?? null) : null;
  // One level only: a box doesn't hold boxes.
  const boxes = family && !place.parentId ? boxesIn(family, place.id) : [];
  const canHoldBoxes = !place.parentId;
  const grid = keep && view === "grid";
  const lentHere = (items ?? []).filter((i) => i.lentTo).length;
  const count = items?.length ?? 0;
  const filtering = filter.trim() !== "" || category !== null;
  const due = (items ?? []).filter((i) => needsAttention(i));
  const lateHere = due.filter((i) => itemStatus(i)?.tone === "late").length;
  const soonHere = due.length - lateHere;
  const boxed = boxes.reduce((n, b) => n + b.itemCount, 0);
  const facts = [
    // "Kitchen fridge · Fridge" says it twice, and "Something else" says nothing, so the kind is left out then.
    parent ? `In ${parent.name}` : place.type === "other" || place.name.toLowerCase().includes(info.label.toLowerCase()) ? null : info.label,
    // The same total as on Home, so a shed with things in boxes doesn't look emptier from inside.
    items ? (boxed > 0 ? `${countThings(count + boxed)}, ${boxed} in boxes` : countThings(count)) : null,
    lateHere > 0 ? `${lateHere} past ${lateHere === 1 ? "its date" : "a date"}` : null,
    soonHere > 0 ? `${soonHere} to use soon` : null,
    lentHere > 0 ? `${lentHere} lent out` : null,
  ].filter(Boolean);
  // "updated…" is the first thing to go when the line would be cut off on a phone.
  const updated = last ? `updated ${timeAgo(last.at)}` : null;
  const summary = [...facts, ...(updated && facts.join(" · ").length + updated.length < 42 ? [updated] : [])].join(" · ");
  // One-tap adds while a place is new: shown in the empty state, and under a short list until it fills up.
  const starters = (
    <StarterThings
      placeId={place.id}
      type={place.type}
      have={(items ?? []).map((i) => i.productName)}
      label="Tap to add some common things. You can edit them after."
      onAdded={(item, movementId) => {
        refresh(place.id);
        announce(`Added ${item.productName}`, movementId);
      }}
      onError={setError}
    />
  );
  const catCount = (c: string) => (items ?? []).filter((i) => i.category?.trim() === c).length;

  return (
    <AppShell wide>
      <div
        ref={heroHeader}
        className="reveal relative z-20 -mx-4 -mt-[max(16px,env(safe-area-inset-top))] overflow-hidden max-sm:sticky max-sm:top-0 max-sm:shadow-[0_10px_24px_-18px_rgba(0,0,0,0.5)] sm:mx-0 sm:mt-0 sm:rounded-[24px]"
      >
        <div className="h-56 sm:h-64 lg:h-72">
          {place.parentId ? (
            <BoxCover
              id={place.id}
              type={place.type}
              imagePath={place.imagePath}
              peeks={items ? pickPeeks(items.map(toPeek)) : null}
              total={items?.length ?? 0}
              wide
              eager
              className="reveal-img"
            />
          ) : (
            <PlacePhoto type={place.type} imagePath={place.imagePath} variant="wide" eager className="reveal-img" />
          )}
        </div>
        <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-black/0 to-black/70" aria-hidden="true" />
        {/* Darkens the photo as the header shrinks, so the small title stays readable. */}
        <div ref={heroShade} className="pointer-events-none absolute inset-0 bg-black/45 opacity-0" aria-hidden="true" />
        <div
          ref={heroBar}
          className="absolute inset-x-0 top-0 z-10 flex items-center justify-between gap-3 px-4 pt-[max(12px,env(safe-area-inset-top))] will-change-transform sm:p-4"
        >
          <Link
            href={parent ? `/place/?id=${parent.id}` : "/"}
            aria-label={parent ? `Back to ${parent.name}` : "Back to My Places"}
            className="grid size-11 place-items-center rounded-full bg-[#fffdf8]/92 text-[#17242a] shadow-[var(--shadow-card)] backdrop-blur transition hover:bg-[#fffdf8]"
          >
            <IconChevronLeft className="size-5" />
          </Link>
          <span ref={heroSmall} aria-hidden="true" className="min-w-0 flex-1 truncate font-serif text-[18px] font-semibold text-[#fffdf8] opacity-0 sm:hidden">
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
          <h1
            className={`line-clamp-2 pb-0.5 font-serif leading-[1.1] text-balance ${place.name.length > 18 ? "text-[1.75rem]" : "text-[2.1rem]"} font-semibold tracking-[-0.015em] [text-shadow:0_2px_12px_rgba(0,0,0,0.3)] sm:text-[2.6rem]`}
          >
            {place.name}
          </h1>
          <p className="truncate text-[14px] text-[#fffdf8]/90">{summary}</p>
        </div>
      </div>

      {error ? <Notice>{error}</Notice> : null}

      {items && (items.length > 0 || boxes.length > 0) ? (
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
            {keep ? (
              <button
                onClick={() => setView(grid ? "list" : "grid")}
                aria-label={grid ? "Show as a list" : "Show as pictures"}
                title={grid ? "Show as a list" : "Show as pictures"}
                className="grid size-12 shrink-0 place-items-center rounded-xl border border-line bg-card text-fg transition hover:bg-sunk active:scale-95"
              >
                {grid ? <IconList className="size-5" /> : <IconGrid className="size-5" />}
              </button>
            ) : null}
            <Button className="min-h-12 shrink-0 px-4" onClick={() => setAdding(true)}>
              <IconPlus /> Add{keep ? <span className="max-sm:sr-only"> item</span> : " item"}
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

      {boxes.length > 0 ? (
        <section aria-labelledby="boxes-h" className="flex flex-col gap-2.5">
          <SectionLabel id="boxes-h">
            Inside {place.name} <span className="font-semibold text-mute">· {boxes.length}</span>
          </SectionLabel>
          <ul className="grid grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-4">
            {boxes.map((b, i) => (
              <PlaceCard
                key={b.id}
                place={b}
                index={i}
                cover={<BoxCover id={b.id} type={b.type} imagePath={b.imagePath} peeks={peeks ? (peeks.get(b.id) ?? []) : null} total={b.itemCount} />}
              />
            ))}
            <AddPlaceTile onClick={() => setAddingBox(true)} label="Add a box or shelf" />
          </ul>
        </section>
      ) : null}

      {shown === null ? (
        <ItemListSkeleton rows={4} />
      ) : items!.length === 0 && boxes.length > 0 ? null : items!.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-[24px] bg-sunk/40 px-6 py-8 text-center">
          <h2 className="font-display text-xl font-bold">Nothing recorded here yet</h2>
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
          {canHoldBoxes ? (
            <button onClick={() => setAddingBox(true)} className="min-h-11 text-[15px] font-semibold text-leaf">
              Or add a box or shelf inside it
            </button>
          ) : null}
          <div className="mt-2 w-full border-t border-line pt-5 text-left">{starters}</div>
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
            {grid ? (
              <ItemGrid items={sec.items} placeType={place.type} onOpen={setOpen} />
            ) : (
              <ItemList>
                {sec.items.map((item, i) => (
                  <ItemRow
                    key={item.id}
                    index={i}
                    item={item}
                    keep={keep}
                    placeType={place.type}
                    addedBy={(item.addedBy && names.get(item.addedBy)) || ""}
                    onOpen={setOpen}
                    onTakeOne={takeOne}
                    taking={taking === item.id}
                  />
                ))}
              </ItemList>
            )}
          </section>
        ))
      ) : (
        <section aria-labelledby="items-h" className="flex flex-col gap-2.5">
          <SectionLabel id="items-h">
            {filtering
              ? countThings(shown.length)
              : boxes.length > 0
                ? "Not in a box"
                : ["freezer", "fridge", "pantry"].includes(place.type)
                  ? "Use first"
                  : "In here"}
          </SectionLabel>
          {grid ? (
            <ItemGrid items={shown} placeType={place.type} onOpen={setOpen} highlight={filter} />
          ) : (
            <ItemList>
              {shown.map((item, i) => (
                <ItemRow
                  key={item.id}
                  index={i}
                  item={item}
                  keep={keep}
                  placeType={place.type}
                  highlight={filter}
                  addedBy={(item.addedBy && names.get(item.addedBy)) || ""}
                  onOpen={setOpen}
                  onTakeOne={takeOne}
                  taking={taking === item.id}
                />
              ))}
            </ItemList>
          )}
        </section>
      )}

      {items && items.length > 0 && items.length < 3 && !filtering && boxes.length === 0 ? starters : null}

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
      <QuickSheet
        open={quick}
        onClose={() => setQuick(false)}
        place={place}
        items={items}
        keep={keep}
        placeName={(locationId) => (family ?? []).find((p) => p.id === locationId)?.name}
        onPutIn={() => setAdding(true)}
        onTakeOne={takeOne}
        taking={taking}
        onOpenItem={setOpen}
        onMoved={(item, movementId) => {
          refresh(place.id, place.householdId);
          announce(`Moved ${item.productName} here`, movementId);
        }}
      />
      <TakeOutSheet
        item={open}
        keep={keep}
        householdId={place.householdId}
        names={names}
        onClose={() => setOpen(null)}
        onTaken={(before, after, amount, movementId) => {
          refresh(place.id);
          announce(tookOutMessage(before, after, amount, keep), movementId);
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
          boxCount={boxes.length}
          homes={boxes.length === 0 ? (family ?? []).filter((p) => !p.parentId && p.id !== place.id).map((p) => ({ id: p.id, name: p.name })) : []}
          onSaved={async () => {
            const p = await loadPlace(place.id).catch(() => null);
            if (p) setPlace(p);
            refresh(place.id, place.householdId);
          }}
          onRemoved={() => router.replace("/")}
        />
      ) : null}
      {addingBox ? (
        <AddPlaceSheet
          open={addingBox}
          onClose={() => setAddingBox(false)}
          householdId={place.householdId}
          inside={{ id: place.id, name: place.name }}
          onAdded={() => refresh(place.id, place.householdId)}
        />
      ) : null}
      {sticker ? <StickerSheet open={sticker} onClose={() => setSticker(false)} place={place} /> : null}
      <Toast toast={toast} onDone={clear} />
    </AppShell>
  );
}
