"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthGate } from "@/components/AuthGate";
import { supabase } from "@/lib/supabase/client";
import { friendlyError } from "@/lib/supabase/errors";
import { useQueryParam } from "@/lib/hooks/useQueryParam";
import { loadMembers, type LocationType } from "@/lib/household";
import type { StockItem } from "@/lib/domain/stock";
import { formatQuantity } from "@/lib/domain/quantity";
import { loadItems, loadPlaceLastActivity } from "@/lib/stock";
import { countThings } from "@/lib/domain/places";
import { AppShell, SectionLabel } from "@/components/AppShell";
import { Screen, Splash } from "@/components/ui/Screen";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { Toast } from "@/components/ui/Toast";
import { IconChevronLeft, IconPencil, IconPlus, IconSearch } from "@/components/ui/icons";
import { PlacePhoto } from "@/components/art/PlacePhoto";
import { timeAgo } from "@/lib/domain/dates";
import { placeType } from "@/components/home/placeTypes";
import { ItemList, ItemRow } from "@/components/stock/ItemRow";
import { useUndoToast } from "@/components/stock/useUndoToast";
import { AddItemSheet } from "@/components/stock/AddItemSheet";
import { TakeOutSheet } from "@/components/stock/TakeOutSheet";
import { EditPlaceSheet } from "@/components/stock/EditPlaceSheet";

type PlaceInfo = { id: string; name: string; type: LocationType; householdId: string };

export default function PlacePage() {
  return <AuthGate>{(session) => <Place me={session.user.id} />}</AuthGate>;
}

function Place({ me }: { me: string }) {
  const id = useQueryParam("id");
  const router = useRouter();
  const [place, setPlace] = useState<PlaceInfo | null>(null);
  const [items, setItems] = useState<StockItem[] | null>(null);
  const [names, setNames] = useState<Map<string, string>>(new Map());
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(false);
  const [open, setOpen] = useState<StockItem | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [last, setLast] = useState<{ actor: string | null; at: string } | null>(null);

  const refresh = useCallback(async (locationId: string) => {
    try {
      const [list, latest] = await Promise.all([loadItems(locationId), loadPlaceLastActivity(locationId).catch(() => null)]);
      setItems(list);
      setLast(latest);
    } catch (e) {
      setError(friendlyError(e));
    }
  }, []);

  const loadPlace = useCallback(async (locationId: string) => {
    const { data, error } = await supabase()
      .from("storage_locations")
      .select("id, name, type, household_id")
      .eq("id", locationId)
      .is("archived_at", null)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return { id: data.id as string, name: data.name as string, type: data.type as LocationType, householdId: data.household_id as string };
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
  }, [id, router, loadPlace, refresh]);

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
  }, [place?.id, refresh, loadPlace]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const { toast, clear, announce } = useUndoToast(() => {
    if (place) refresh(place.id);
  });

  if (missing) {
    return (
      <Screen className="justify-center">
        <h1 className="font-display text-2xl font-extrabold">This place isn&apos;t available</h1>
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
  const lastWho = last ? (last.actor === me ? "You" : (last.actor && names.get(last.actor)) || "Someone") : null;
  const catCount = (c: string) => (items ?? []).filter((i) => i.category?.trim() === c).length;

  return (
    <AppShell wide>
      <div className="reveal relative -mx-4 -mt-[max(16px,env(safe-area-inset-top))] overflow-hidden sm:mx-0 sm:mt-0 sm:rounded-[24px]">
        <div className="h-64 sm:h-72 lg:h-[22rem]">
          <PlacePhoto type={place.type} variant="wide" eager className="reveal-img" />
        </div>
        <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-black/0 to-black/70" aria-hidden="true" />
        <div className="absolute inset-x-0 top-0 flex items-center justify-between px-4 pt-[max(12px,env(safe-area-inset-top))] sm:p-4">
          <Link href="/" aria-label="Back to My Places" className="grid size-11 place-items-center rounded-full bg-[#fffdf8]/92 text-[#17242a] shadow-[var(--shadow-card)] backdrop-blur transition hover:bg-[#fffdf8]">
            <IconChevronLeft className="size-5" />
          </Link>
          <button
            onClick={() => setEditing(true)}
            aria-label={`Edit ${place.name}`}
            className="grid size-11 place-items-center rounded-full bg-[#fffdf8]/92 text-[#17242a] shadow-[var(--shadow-card)] backdrop-blur transition hover:bg-[#fffdf8]"
          >
            <IconPencil className="size-[18px]" />
          </button>
        </div>
        <div className="absolute inset-x-5 bottom-4 text-[#fffdf8] sm:inset-x-7 sm:bottom-6">
          <h1 className="truncate font-display text-[2.1rem] leading-tight font-extrabold tracking-[-0.03em] [text-shadow:0_2px_12px_rgba(0,0,0,0.3)] sm:text-[2.6rem]">
            {place.name}
          </h1>
          <p className="truncate text-[14px] text-[#fffdf8]/85">{info.blurb}</p>
        </div>
      </div>

      <dl className="-mx-4 -mt-6 grid grid-cols-3 border-b border-line bg-card sm:mx-0 sm:mt-0 sm:rounded-2xl sm:border sm:shadow-[var(--shadow-card)]">
        <div className="px-4 py-3 sm:px-5">
          <dt className="sr-only">Things</dt>
          <dd className="font-display text-xl font-extrabold tabular-nums">{count}</dd>
          <dd className="text-[12.5px] text-mute">{count === 1 ? "thing" : "things"}</dd>
        </div>
        <div className="border-l border-line px-4 py-3 sm:px-5">
          <dt className="sr-only">Categories</dt>
          <dd className="font-display text-xl font-extrabold tabular-nums">{categories.length}</dd>
          <dd className="text-[12.5px] text-mute">{categories.length === 1 ? "category" : "categories"}</dd>
        </div>
        <div className="min-w-0 border-l border-line px-4 py-3 sm:px-5">
          <dt className="sr-only">Last change</dt>
          <dd className="truncate font-display text-xl font-extrabold">{lastWho ?? "None"}</dd>
          <dd className="truncate text-[12.5px] text-mute">{last ? `last change · ${timeAgo(last.at)}` : "no changes yet"}</dd>
        </div>
      </dl>

      {error ? <Notice>{error}</Notice> : null}

      {items && items.length > 0 ? (
        <div className="flex flex-col gap-3">
          <div className="flex gap-2">
            <label className="flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-2xl bg-sunk px-4">
              <IconSearch className="size-5 shrink-0 text-mute" />
              <input
                type="search"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder={`Search ${place.name}`}
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
        <div className="flex flex-col gap-2" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-[var(--radius-card)] bg-sunk" />
          ))}
        </div>
      ) : items!.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-[24px] bg-sunk/60 px-6 py-10 text-center">
          <span className="block h-28 w-40 overflow-hidden rounded-2xl opacity-90 shadow-[var(--shadow-card)]">
            <PlacePhoto type={place.type} />
          </span>
          <h2 className="mt-2 font-display text-xl font-bold">Nothing recorded here yet</h2>
          <p className="max-w-sm text-sm text-mute">
            Add what&apos;s in {place.name} as you put it in, like &ldquo;{info.thing}&rdquo;. It takes a few seconds per thing.
          </p>
          <Button onClick={() => setAdding(true)}>
            <IconPlus /> Add the first thing
          </Button>
        </div>
      ) : shown.length === 0 ? (
        <p className="text-mute">
          Nothing matches{filter.trim() ? <> &ldquo;{filter.trim()}&rdquo;</> : null}
          {category ? ` in ${category}` : ""}.
        </p>
      ) : (
        <section aria-labelledby="items-h" className="flex flex-col gap-2.5">
          <SectionLabel id="items-h">{filtering ? countThings(shown.length) : ["freezer", "fridge", "pantry"].includes(place.type) ? "Use first" : "In here"}</SectionLabel>
          <ItemList>
            {shown.map((item, i) => (
              <ItemRow key={item.id} index={i} item={item} onOpen={setOpen} />
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
      />
      <TakeOutSheet
        item={open}
        names={names}
        onClose={() => setOpen(null)}
        onTaken={(before, after, amount, movementId) => {
          refresh(place.id);
          const left = after.quantity > 0 ? `, ${formatQuantity(after.quantity, after.unit)} left` : ", all gone";
          announce(`Took out ${formatQuantity(amount, before.unit)} of ${before.productName}${left}`, movementId);
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
      <Toast toast={toast} onDone={clear} />
    </AppShell>
  );
}
