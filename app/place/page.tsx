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
import { loadItems, undo } from "@/lib/stock";
import { Screen, Splash } from "@/components/ui/Screen";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { Toast, type ToastData } from "@/components/ui/Toast";
import { IconChevronLeft, IconPlus } from "@/components/ui/icons";
import { placeType } from "@/components/home/placeTypes";
import { ItemRow } from "@/components/stock/ItemRow";
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
  const [toast, setToast] = useState<ToastData | null>(null);

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

  const shown = useMemo(() => {
    if (!items) return null;
    const q = filter.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => [i.productName, i.brand, i.category, i.notes].some((v) => v?.toLowerCase().includes(q)));
  }, [items, filter]);

  function offerUndo(message: string, movementId: string | null) {
    setToast({
      id: Date.now(),
      message,
      actionLabel: movementId ? "Undo" : undefined,
      onAction: movementId
        ? async () => {
            try {
              await undo(movementId);
              if (place) await refresh(place.id);
              setToast({ id: Date.now(), message: "Undone" });
            } catch (e) {
              setToast({ id: Date.now(), message: friendlyError(e) });
            }
          }
        : undefined,
    });
  }

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

  const { Icon, label } = placeType(place.type);
  const count = items?.length ?? 0;

  return (
    <Screen className="pb-28">
      <nav className="flex items-center justify-between pt-1">
        <Link href="/" className="-ml-2 flex min-h-11 items-center gap-1 pr-3 font-bold text-go">
          <IconChevronLeft className="size-5" /> Home
        </Link>
        <button onClick={() => setEditing(true)} className="min-h-11 px-2 font-bold text-go">
          Edit
        </button>
      </nav>

      <header className="flex items-center gap-3">
        <span className="inline-grid size-12 shrink-0 place-items-center rounded-[14px] bg-ice" aria-hidden="true">
          <Icon className="size-6" />
        </span>
        <div className="min-w-0">
          <h1 className="truncate font-display text-[1.9rem] leading-none font-extrabold tracking-[-0.02em]">{place.name}</h1>
          <p className="mt-1 text-sm text-mute">
            {label} · {count === 1 ? "1 thing" : `${count} things`}
          </p>
        </div>
      </header>

      {error ? <Notice>{error}</Notice> : null}

      {items && items.length > 5 ? (
        <input
          type="search"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder={`Search ${place.name}`}
          aria-label={`Search ${place.name}`}
          className="min-h-12 rounded-xl border border-line bg-card px-3.5 text-base placeholder:text-mute focus:border-go focus:outline-none"
        />
      ) : null}

      {shown === null ? (
        <div className="flex flex-col gap-2" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-[var(--radius-card)] bg-card" />
          ))}
        </div>
      ) : items!.length === 0 ? (
        <div className="relative flex flex-col items-start gap-3 rounded-[var(--radius-card)] border border-line bg-card p-5 pt-7">
          <span className="tape absolute -top-2 left-5 h-3.5 w-14 -rotate-6" aria-hidden="true" />
          <h2 className="font-display text-xl font-bold">Nothing in here yet</h2>
          <p className="text-sm text-mute">Add what&apos;s in {place.name} as you put it in. It takes a few seconds per thing.</p>
          <Button onClick={() => setAdding(true)}>
            <IconPlus /> Add food
          </Button>
        </div>
      ) : shown.length === 0 ? (
        <p className="text-mute">Nothing matches &ldquo;{filter}&rdquo;.</p>
      ) : (
        <section aria-labelledby="items-h" className="flex flex-col gap-2">
          <h2 id="items-h" className="font-mono text-[11px] tracking-[0.1em] text-mute uppercase">
            Use first
          </h2>
          <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-card">
            {shown.map((item) => (
              <ItemRow key={item.id} item={item} onOpen={setOpen} />
            ))}
          </ul>
        </section>
      )}

      {items && items.length > 0 ? (
        <div className="fixed inset-x-0 bottom-0 z-30 flex justify-center bg-gradient-to-t from-bg via-bg/95 to-transparent px-4 pt-6 pb-[max(16px,env(safe-area-inset-bottom))]">
          <Button className="w-full max-w-md shadow-[0_10px_24px_-12px_rgba(15,123,102,0.7)]" onClick={() => setAdding(true)}>
            <IconPlus /> Add food
          </Button>
        </div>
      ) : null}

      <AddItemSheet
        open={adding}
        onClose={() => setAdding(false)}
        place={place}
        onAdded={(item, movementId) => {
          refresh(place.id);
          offerUndo(`Added ${item.productName}`, movementId);
        }}
      />
      <TakeOutSheet
        item={open}
        names={names}
        onClose={() => setOpen(null)}
        onTaken={(before, after, amount, movementId) => {
          refresh(place.id);
          const left = after.quantity > 0 ? `, ${formatQuantity(after.quantity, after.unit)} left` : ", all gone";
          offerUndo(`Took out ${formatQuantity(amount, before.unit)} of ${before.productName}${left}`, movementId);
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
      <Toast toast={toast} onDone={() => setToast(null)} />
    </Screen>
  );
}
