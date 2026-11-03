"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import { Capacitor } from "@capacitor/core";
import { AuthGate } from "@/components/AuthGate";
import { Landing } from "@/components/landing/Landing";
import { SetupNeeded } from "@/components/SetupNeeded";
import { isConfigured } from "@/lib/config";
import { useSession } from "@/lib/hooks/useSession";
import { loadMembers, loadMemberships, loadPlaces, pickCurrent, type Member, type Membership, type Place } from "@/lib/household";
import { friendlyError } from "@/lib/supabase/errors";
import { supabase } from "@/lib/supabase/client";
import { Screen, Splash } from "@/components/ui/Screen";
import { Avatar } from "@/components/ui/Avatar";
import { Notice } from "@/components/ui/Notice";
import { Button } from "@/components/ui/Button";
import { IconPlus } from "@/components/ui/icons";
import { AddPlaceSheet } from "@/components/home/AddPlaceSheet";
import { placeType } from "@/components/home/placeTypes";
import { ItemRow } from "@/components/stock/ItemRow";
import { TakeOutSheet } from "@/components/stock/TakeOutSheet";
import { Toast, type ToastData } from "@/components/ui/Toast";
import type { StockItem } from "@/lib/domain/stock";
import { formatQuantity } from "@/lib/domain/quantity";
import { loadUseFirst, searchItems, undo } from "@/lib/stock";

export default function HomePage() {
  const { session, loading } = useSession();
  if (!isConfigured) return <SetupNeeded />;
  if (loading) return <Splash />;
  // Signed-out web visitors see the front page; the native apps go straight to sign-in.
  if (!session) return Capacitor.isNativePlatform() ? <AuthGate>{() => null}</AuthGate> : <Landing />;
  return <Home session={session} />;
}

function greeting(now = new Date()) {
  const h = now.getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

function Home({ session }: { session: Session }) {
  const router = useRouter();
  const [current, setCurrent] = useState<Membership | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [places, setPlaces] = useState<Place[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [useFirst, setUseFirst] = useState<StockItem[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<StockItem[] | null>(null);
  const [open, setOpen] = useState<StockItem | null>(null);
  const [toast, setToast] = useState<ToastData | null>(null);

  const refreshPlaces = useCallback(async (householdId: string) => {
    try {
      const [p, u] = await Promise.all([loadPlaces(householdId), loadUseFirst(householdId)]);
      setPlaces(p);
      setUseFirst(u);
    } catch (e) {
      setError(friendlyError(e));
    }
  }, []);

  const runSearch = useCallback(async (householdId: string, q: string) => {
    try {
      setResults(await searchItems(householdId, q));
    } catch (e) {
      setError(friendlyError(e));
    }
  }, []);

  // Search as you type, after a short pause.
  useEffect(() => {
    if (!current) return;
    const q = query.trim();
    if (q.length < 2) return;
    const t = setTimeout(() => runSearch(current.householdId, q), 250);
    return () => clearTimeout(t);
  }, [query, current, runSearch]);

  const searching = query.trim().length >= 2;
  const placeNames = useMemo(() => new Map((places ?? []).map((p) => [p.id, p.name])), [places]);
  const names = useMemo(() => new Map(members.map((m) => [m.userId, m.displayName])), [members]);

  function afterChange() {
    if (!current) return;
    refreshPlaces(current.householdId);
    if (searching) runSearch(current.householdId, query.trim());
  }

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const memberships = await loadMemberships(session.user.id);
        if (!active) return;
        const chosen = pickCurrent(memberships);
        if (!chosen) return router.replace("/welcome/");
        setCurrent(chosen);
        const [m] = await Promise.all([loadMembers(chosen.householdId), refreshPlaces(chosen.householdId)]);
        if (active) setMembers(m);
      } catch (e) {
        if (active) setError(friendlyError(e));
      }
    })();
    return () => {
      active = false;
    };
  }, [session.user.id, router, refreshPlaces]);

  // Live updates: another household member adds a place or changes stock.
  useEffect(() => {
    if (!current) return;
    const channel = supabase()
      .channel(`home:${current.householdId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "storage_locations", filter: `household_id=eq.${current.householdId}` }, () =>
        refreshPlaces(current.householdId),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "stock_items", filter: `household_id=eq.${current.householdId}` }, () =>
        refreshPlaces(current.householdId),
      )
      .subscribe();
    return () => {
      supabase().removeChannel(channel);
    };
  }, [current, refreshPlaces]);

  if (error && !current) {
    return (
      <Screen className="justify-center">
        <Notice>{error}</Notice>
        <Button variant="ghost" onClick={() => window.location.reload()}>Try again</Button>
      </Screen>
    );
  }
  if (!current) return <Splash />;

  const me = members.find((m) => m.userId === session.user.id);

  return (
    <Screen>
      <header className="flex items-end justify-between gap-3 pt-2">
        <div className="min-w-0">
          <p className="text-sm text-mute">
            {greeting()}
            {me ? `, ${me.displayName}` : ""}
          </p>
          <h1 className="truncate font-display text-[1.9rem] leading-none font-extrabold tracking-[-0.02em]">{current.name}</h1>
        </div>
        <Link href="/household/" className="flex shrink-0 items-center pl-2" aria-label="Household and members">
          {members.slice(0, 4).map((m, i) => (
            <span key={m.userId} className="-ml-2">
              <Avatar name={m.displayName} index={i} />
            </span>
          ))}
          {members.length === 1 ? (
            <span className="-ml-2 inline-grid size-8 place-items-center rounded-full border-2 border-dashed border-mute/60 bg-bg text-mute">
              <IconPlus className="size-4" />
            </span>
          ) : null}
        </Link>
      </header>

      {error ? <Notice>{error}</Notice> : null}

      {places && places.length > 0 ? (
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (e.target.value.trim().length < 2) setResults(null);
          }}
          placeholder="Search everything, e.g. lasagne"
          aria-label="Search everything in every place"
          className="min-h-12 rounded-xl border border-line bg-card px-3.5 text-base placeholder:text-mute focus:border-go focus:outline-none"
        />
      ) : null}

      {searching ? (
        <section aria-labelledby="results-h" aria-live="polite" className="flex flex-col gap-2">
          <h2 id="results-h" className="font-mono text-[11px] tracking-[0.1em] text-mute uppercase">
            {results === null ? "Searching…" : results.length === 1 ? "1 match" : `${results.length} matches`}
          </h2>
          {results && results.length > 0 ? (
            <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-card">
              {results.map((item) => (
                <ItemRow key={item.id} item={item} place={placeNames.get(item.locationId)} onOpen={setOpen} />
              ))}
            </ul>
          ) : results ? (
            <p className="text-sm text-mute">Nothing called &ldquo;{query.trim()}&rdquo; in any of your places.</p>
          ) : null}
        </section>
      ) : null}

      {!searching && useFirst.length > 0 ? (
        <section aria-labelledby="first-h" className="flex flex-col gap-2">
          <h2 id="first-h" className="flex items-center gap-2 font-mono text-[11px] tracking-[0.1em] text-mute uppercase">
            <span className="tape inline-block h-2.5 w-5" aria-hidden="true" /> Use first
          </h2>
          <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-card">
            {useFirst.map((item) => (
              <ItemRow key={item.id} item={item} place={placeNames.get(item.locationId)} onOpen={setOpen} />
            ))}
          </ul>
        </section>
      ) : null}

      <section className={`flex flex-col gap-3 ${searching ? "hidden" : ""}`} aria-labelledby="places-h">
        <div className="flex items-center justify-between">
          <h2 id="places-h" className="font-mono text-[11px] tracking-[0.1em] text-mute uppercase">
            Your places
          </h2>
          {places && places.length > 0 ? (
            <button onClick={() => setAdding(true)} className="font-mono text-[11px] tracking-[0.1em] text-go uppercase">
              + Add
            </button>
          ) : null}
        </div>

        {places === null ? (
          <div className="grid grid-cols-2 gap-2.5" aria-busy="true">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-28 animate-pulse rounded-[var(--radius-card)] bg-card" />
            ))}
          </div>
        ) : places.length === 0 ? (
          <EmptyPlaces onAdd={() => setAdding(true)} />
        ) : (
          <ul className="grid grid-cols-2 gap-2.5">
            {places.map((p) => {
              const { Icon, label } = placeType(p.type);
              return (
                <li key={p.id}>
                  <Link
                    href={`/place/?id=${p.id}`}
                    className="flex min-h-28 flex-col justify-between gap-3 rounded-[var(--radius-card)] border border-line bg-card p-3.5 transition active:scale-[0.98]"
                  >
                    <span className="inline-grid size-9 place-items-center rounded-[10px] bg-ice" title={label}>
                      <Icon />
                    </span>
                    <span>
                      <span className="block font-display text-[15px] leading-tight font-bold">{p.name}</span>
                      <span className="text-xs text-mute">{p.itemCount === 1 ? "1 thing" : `${p.itemCount} things`}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {places && places.length > 0 && useFirst.length === 0 && !searching ? (
        <p className="text-center text-sm text-mute">Open a place to add what&apos;s in it.</p>
      ) : null}

      <AddPlaceSheet open={adding} onClose={() => setAdding(false)} householdId={current.householdId} onAdded={() => refreshPlaces(current.householdId)} />
      <TakeOutSheet
        item={open}
        placeName={open ? placeNames.get(open.locationId) : undefined}
        names={names}
        onClose={() => setOpen(null)}
        onTaken={(before, after, amount, movementId) => {
          afterChange();
          const left = after.quantity > 0 ? `, ${formatQuantity(after.quantity, after.unit)} left` : ", all gone";
          setToast({
            id: Date.now(),
            message: `Took out ${formatQuantity(amount, before.unit)} of ${before.productName}${left}`,
            actionLabel: movementId ? "Undo" : undefined,
            onAction: movementId
              ? async () => {
                  try {
                    await undo(movementId);
                    afterChange();
                    setToast({ id: Date.now(), message: "Undone" });
                  } catch (e) {
                    setToast({ id: Date.now(), message: friendlyError(e) });
                  }
                }
              : undefined,
          });
        }}
      />
      <Toast toast={toast} onDone={() => setToast(null)} />
    </Screen>
  );
}

function EmptyPlaces({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="relative flex flex-col items-start gap-3 rounded-[var(--radius-card)] border border-line bg-card p-5 pt-7">
      <span className="tape absolute -top-2 left-5 h-3.5 w-14 -rotate-6" aria-hidden="true" />
      <h3 className="font-display text-xl font-bold">Add your first place</h3>
      <p className="text-sm text-mute">
        A freezer, fridge, pantry or cupboard. Add as many as you like; three freezers can each have their own name and sticker.
      </p>
      <Button onClick={onAdd}>
        <IconPlus /> Add a place
      </Button>
    </div>
  );
}
