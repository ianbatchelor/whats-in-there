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
import { loadItems } from "@/lib/stock";
import { countThings } from "@/lib/domain/places";
import { AppShell, SectionLabel } from "@/components/AppShell";
import { Screen, Splash } from "@/components/ui/Screen";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { Toast } from "@/components/ui/Toast";
import { IconChevronLeft, IconPencil, IconPlus, IconSearch } from "@/components/ui/icons";
import { PlaceArt } from "@/components/art/PlaceArt";
import { placeType } from "@/components/home/placeTypes";
import { ItemList, ItemRow } from "@/components/stock/ItemRow";
import { useUndoToast } from "@/components/stock/useUndoToast";
import { AddItemSheet } from "@/components/stock/AddItemSheet";
import { TakeOutSheet } from "@/components/stock/TakeOutSheet";
import { EditPlaceSheet } from "@/components/stock/EditPlaceSheet";

type PlaceInfo = { id: string; name: string; type: LocationType; householdId: string };

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
  const [editing, setEditing] = useState(false);
  const [open, setOpen] = useState<StockItem | null>(null);
  const [category, setCategory] = useState<string | null>(null);

  const refresh = useCallback(async (locationId: string) => {
    try {
      setItems(await loadItems(locationId));
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
  const { Icon } = info;
  const count = items?.length ?? 0;
  const filtering = filter.trim() !== "" || category !== null;

  return (
    <AppShell>
      <div className="relative -mx-4 -mt-[max(16px,env(safe-area-inset-top))] sm:mx-0 sm:mt-0">
        <div className="aspect-[16/8] overflow-hidden sm:rounded-[var(--radius-card)] lg:aspect-[16/6]">
          <PlaceArt type={place.type} className="h-full w-full object-cover" />
        </div>
        <div className="absolute inset-x-0 top-0 flex items-center justify-between px-3 pt-[max(12px,env(safe-area-inset-top))] sm:pt-3">
          <Link href="/" aria-label="Back to My Places" className="grid size-11 place-items-center rounded-full bg-card/90 text-fg shadow-[var(--shadow-card)] backdrop-blur transition hover:bg-card">
            <IconChevronLeft className="size-5" />
          </Link>
          <button
            onClick={() => setEditing(true)}
            aria-label={`Edit ${place.name}`}
            className="grid size-11 place-items-center rounded-full bg-card/90 text-fg shadow-[var(--shadow-card)] backdrop-blur transition hover:bg-card"
          >
            <IconPencil className="size-[18px]" />
          </button>
        </div>
      </div>

      <header className="rise relative z-10 -mt-14 flex flex-col gap-4 rounded-[var(--radius-card)] border border-line bg-card p-4 shadow-[var(--shadow-lift)] sm:mx-4 sm:p-5">
        <div className="flex items-center gap-3.5">
          <span className="inline-grid size-12 shrink-0 place-items-center rounded-2xl bg-ice text-leaf" aria-hidden="true">
            <Icon className="size-6" />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-[1.75rem] leading-tight font-extrabold tracking-[-0.025em]">{place.name}</h1>
            <p className="truncate text-sm text-mute">{info.blurb}</p>
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-line pt-3.5">
          <p className="text-sm">
            <span className="font-display text-lg font-extrabold tabular-nums">{count}</span>{" "}
            <span className="text-mute">{count === 1 ? "thing" : "things"} in here</span>
          </p>
          <Button className="min-h-11 px-4" onClick={() => setAdding(true)}>
            <IconPlus /> Add item
          </Button>
        </div>
      </header>

      {error ? <Notice>{error}</Notice> : null}

      {items && items.length > 0 ? (
        <div className="flex flex-col gap-3">
          <label className="flex min-h-12 items-center gap-3 rounded-2xl border border-line bg-card px-4 shadow-[var(--shadow-card)] focus-within:border-leaf">
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
          {categories.length > 1 ? (
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label="Filter by category">
              {[null, ...categories].map((c) => {
                const on = category === c;
                return (
                  <button
                    key={c ?? "all"}
                    onClick={() => setCategory(c)}
                    aria-pressed={on}
                    className={`min-h-9 shrink-0 rounded-full border px-3.5 text-sm font-semibold transition ${
                      on ? "border-go bg-go text-on-go" : "border-line bg-card text-mute hover:text-fg"
                    }`}
                  >
                    {c ?? "All"}
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
        <div className="flex flex-col items-start gap-3 rounded-[var(--radius-card)] border-2 border-dashed border-line bg-sunk/40 p-5">
          <h2 className="font-display text-xl font-bold">Nothing in here yet</h2>
          <p className="text-sm text-mute">
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
          <SectionLabel id="items-h">{filtering ? countThings(shown.length) : "Use first"}</SectionLabel>
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
