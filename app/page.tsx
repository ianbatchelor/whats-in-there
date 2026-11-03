"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import { AuthGate } from "@/components/AuthGate";
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

export default function HomePage() {
  return <AuthGate>{(session) => <Home session={session} />}</AuthGate>;
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

  const refreshPlaces = useCallback(async (householdId: string) => {
    try {
      setPlaces(await loadPlaces(householdId));
    } catch (e) {
      setError(friendlyError(e));
    }
  }, []);

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

      <section className="flex flex-col gap-3" aria-labelledby="places-h">
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
                  <div className="flex min-h-28 flex-col justify-between gap-3 rounded-[var(--radius-card)] border border-line bg-card p-3.5">
                    <span className="inline-grid size-9 place-items-center rounded-[10px] bg-ice" title={label}>
                      <Icon />
                    </span>
                    <span>
                      <span className="block font-display text-[15px] leading-tight font-bold">{p.name}</span>
                      <span className="text-xs text-mute">{p.itemCount === 1 ? "1 item" : `${p.itemCount} items`}</span>
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <p className="mt-auto text-center text-xs text-mute">Adding and taking out food arrives in the next build.</p>

      <AddPlaceSheet open={adding} onClose={() => setAdding(false)} householdId={current.householdId} onAdded={() => refreshPlaces(current.householdId)} />
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
