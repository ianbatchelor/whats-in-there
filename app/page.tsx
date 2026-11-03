"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { Session } from "@supabase/supabase-js";
import { Capacitor } from "@capacitor/core";
import { AuthGate } from "@/components/AuthGate";
import { AppShell, SectionLabel } from "@/components/AppShell";
import { Landing } from "@/components/landing/Landing";
import { SetupNeeded } from "@/components/SetupNeeded";
import { isConfigured } from "@/lib/config";
import { useSession } from "@/lib/hooks/useSession";
import { useHousehold } from "@/lib/hooks/useHousehold";
import { friendlyError } from "@/lib/supabase/errors";
import { groupPlaces } from "@/lib/domain/places";
import type { StockItem } from "@/lib/domain/stock";
import { formatQuantity } from "@/lib/domain/quantity";
import { loadUseFirst } from "@/lib/stock";
import { Splash } from "@/components/ui/Screen";
import { Avatar } from "@/components/ui/Avatar";
import { Notice } from "@/components/ui/Notice";
import { Button } from "@/components/ui/Button";
import { Toast } from "@/components/ui/Toast";
import { IconPlus, IconSearch } from "@/components/ui/icons";
import { BrandMark, Wordmark } from "@/components/brand/BrandMark";
import { PlaceArt } from "@/components/art/PlaceArt";
import { AddPlaceSheet } from "@/components/home/AddPlaceSheet";
import { AddPlaceTile, GroupCard } from "@/components/home/PlaceCard";
import { ItemList, ItemRow } from "@/components/stock/ItemRow";
import { TakeOutSheet } from "@/components/stock/TakeOutSheet";
import { useUndoToast } from "@/components/stock/useUndoToast";

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
  const hh = useHousehold(session);
  const { current, members, places, names, placeById, me, error, version, refresh } = hh;
  const [adding, setAdding] = useState(false);
  const [useFirst, setUseFirst] = useState<StockItem[]>([]);
  const [open, setOpen] = useState<StockItem | null>(null);

  const loadFirst = useCallback(async () => {
    if (!current) return;
    try {
      setUseFirst(await loadUseFirst(current.householdId, 3));
    } catch (e) {
      hh.setError(friendlyError(e));
    }
  }, [current]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadFirst();
  }, [loadFirst, version]);

  const { toast, clear, announce } = useUndoToast(() => {
    refresh();
  });

  if (error && !current) {
    return (
      <AppShell>
        <Notice>{error}</Notice>
        <Button variant="ghost" onClick={() => window.location.reload()}>
          Try again
        </Button>
      </AppShell>
    );
  }
  if (!current) return <Splash />;

  const groups = places ? groupPlaces(places) : null;

  return (
    <AppShell wide>
      {/* Phone header band; the sidebar carries the brand on wide screens. */}
      <div className="-mx-4 -mt-[max(16px,env(safe-area-inset-top))] flex items-center justify-between bg-brand px-4 pt-[max(14px,env(safe-area-inset-top))] pb-4 text-[#fffdf8] sm:-mx-6 sm:px-6 lg:hidden">
        <Link href="/" className="flex items-center gap-2.5">
          <BrandMark size={34} className="ring-1 ring-white/15" />
          <Wordmark className="text-[1.2rem] leading-none" />
        </Link>
        <Link href="/household/" className="flex items-center" aria-label="Household and members">
          {members.slice(0, 3).map((m, i) => (
            <span key={m.userId} className="-ml-2 first:ml-0">
              <Avatar name={m.displayName} index={i} size={34} />
            </span>
          ))}
        </Link>
      </div>

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-mute">
            {greeting()}
            {me ? `, ${me.displayName}` : ""} · {current.name}
          </p>
          <h1 className="font-display text-[2.3rem] leading-none font-extrabold tracking-[-0.03em] sm:text-[2.7rem]">My Places</h1>
          <p className="mt-1.5 text-mute">Your spaces, storage and growing areas.</p>
        </div>
        <Link
          href="/search/"
          className="flex min-h-12 w-full items-center gap-3 rounded-2xl border border-line bg-card px-4 text-mute shadow-[var(--shadow-card)] transition hover:text-fg sm:w-80"
        >
          <IconSearch className="size-5" />
          Search everything you have
        </Link>
      </header>

      {error ? <Notice>{error}</Notice> : null}

      {useFirst.length > 0 ? (
        <section aria-labelledby="first-h" className="flex flex-col gap-2.5">
          <div className="flex items-center gap-2">
            <span className="tape inline-block h-2.5 w-6" aria-hidden="true" />
            <SectionLabel id="first-h">Use first</SectionLabel>
          </div>
          <ItemList>
            {useFirst.map((item, i) => (
              <ItemRow key={item.id} index={i} item={item} place={placeById.get(item.locationId)?.name} onOpen={setOpen} />
            ))}
          </ItemList>
        </section>
      ) : null}

      <section className="flex flex-col gap-3" aria-labelledby="places-h">
        <SectionLabel id="places-h">Places</SectionLabel>
        {groups === null ? (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" aria-busy="true">
            {[0, 1, 2, 3].map((i) => (
              <li key={i} className="aspect-[4/3.6] animate-pulse rounded-[var(--radius-card)] bg-sunk" />
            ))}
          </ul>
        ) : groups.length === 0 ? (
          <FirstPlace onAdd={() => setAdding(true)} />
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
            {groups.map((g, i) => (
              <GroupCard key={g.type} group={g} index={i} />
            ))}
            <AddPlaceTile onClick={() => setAdding(true)} />
          </ul>
        )}
      </section>

      <AddPlaceSheet open={adding} onClose={() => setAdding(false)} householdId={current.householdId} onAdded={refresh} />
      <TakeOutSheet
        item={open}
        placeName={open ? placeById.get(open.locationId)?.name : undefined}
        names={names}
        onClose={() => setOpen(null)}
        onTaken={(before, after, amount, movementId) => {
          refresh();
          const left = after.quantity > 0 ? `, ${formatQuantity(after.quantity, after.unit)} left` : ", all gone";
          announce(`Took out ${formatQuantity(amount, before.unit)} of ${before.productName}${left}`, movementId);
        }}
      />
      <Toast toast={toast} onDone={clear} />
    </AppShell>
  );
}

function FirstPlace({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-card shadow-[var(--shadow-card)] sm:flex">
      <div className="aspect-[16/9] sm:aspect-auto sm:w-1/2">
        <PlaceArt type="other" />
      </div>
      <div className="flex flex-col items-start gap-3 p-5 sm:w-1/2 sm:justify-center sm:p-8">
        <h3 className="font-display text-2xl font-extrabold tracking-tight">Add your first place</h3>
        <p className="text-mute">
          A freezer, the attic, a wardrobe, a raised bed. Anywhere you put things. Give each its own name, like Garage Freezer or Blue Box.
        </p>
        <Button onClick={onAdd}>
          <IconPlus /> Add a place
        </Button>
      </div>
    </div>
  );
}
