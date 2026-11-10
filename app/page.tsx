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
import { SECTION_LABELS, countThings, groupPlaces, recentPlaces, sectionOf, soonCounts, usedSections, type PlaceSection } from "@/lib/domain/places";
import { SOON_DAYS, addDays } from "@/lib/domain/stock";
import { todayIso, timeAgo } from "@/lib/domain/dates";
import { activitySentence } from "@/lib/domain/activity";
import type { StockItem } from "@/lib/domain/stock";
import { formatQuantity } from "@/lib/domain/quantity";
import { loadActivity, loadSoon, loadUseFirst, type Activity } from "@/lib/stock";
import { Splash } from "@/components/ui/Screen";
import { Avatar } from "@/components/ui/Avatar";
import { Notice } from "@/components/ui/Notice";
import { Button } from "@/components/ui/Button";
import { Toast } from "@/components/ui/Toast";
import { IconPlus, IconSearch } from "@/components/ui/icons";
import { PlacePhoto } from "@/components/art/PlacePhoto";
import { AddPlaceSheet } from "@/components/home/AddPlaceSheet";
import { AddPlaceTile, GroupCard } from "@/components/home/PlaceCard";
import { ItemList, ItemRow, ItemTile, StatusPill } from "@/components/stock/ItemRow";
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

function Home({ session }: { session: Session }) {
  const hh = useHousehold(session);
  const { current, members, places, names, placeById, error, version, refresh } = hh;
  const [adding, setAdding] = useState(false);
  const [useFirst, setUseFirst] = useState<StockItem[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [soon, setSoon] = useState<Map<string, number>>(new Map());
  const [section, setSection] = useState<PlaceSection | "all">("all");
  const [open, setOpen] = useState<StockItem | null>(null);

  const loadExtras = useCallback(async () => {
    if (!current) return;
    try {
      const [first, acts, soonRows] = await Promise.all([
        loadUseFirst(current.householdId, 4),
        loadActivity(current.householdId, 40),
        loadSoon(current.householdId),
      ]);
      setUseFirst(first);
      setActivity(acts);
      setSoon(soonCounts(soonRows, addDays(todayIso(), SOON_DAYS)));
    } catch (e) {
      hh.setError(friendlyError(e));
    }
  }, [current]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadExtras();
  }, [loadExtras, version]);

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

  const sections = places ? usedSections(places) : [];
  const shownPlaces = places && section !== "all" ? places.filter((p) => sectionOf(p.type) === section) : places;
  const groups = shownPlaces ? groupPlaces(shownPlaces) : null;
  const total = places?.reduce((n, p) => n + p.itemCount, 0) ?? 0;
  const recent = recentPlaces(activity, 3).filter((r) => r.locationId && placeById.has(r.locationId));
  const who = (id: string | null) => (id === session.user.id ? "You" : (id && names.get(id)) || "Someone");

  const useFirstList =
    useFirst.length > 0 ? (
      <ItemList>
        {useFirst.map((item, i) => (
          <ItemRow key={item.id} index={i} item={item} place={placeById.get(item.locationId)?.name} onOpen={setOpen} />
        ))}
      </ItemList>
    ) : null;

  const rail = (
    <>
      <section className="flex flex-col gap-3" aria-labelledby="rail-first">
        <SectionLabel id="rail-first">Use first</SectionLabel>
        {useFirst.length > 0 ? (
          <ul className="flex flex-col gap-1">
            {useFirst.map((item) => (
              <li key={item.id}>
                <button onClick={() => setOpen(item)} className="-mx-2 flex w-[calc(100%+16px)] items-center gap-3 rounded-xl px-2 py-1.5 text-left hover:bg-sunk">
                  <ItemTile name={item.productName} category={item.category} imagePath={item.imagePath} size={38} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-semibold">{item.productName}</span>
                    <span className="block truncate text-[12.5px] text-mute">{placeById.get(item.locationId)?.name}</span>
                  </span>
                  <StatusPill item={item} />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-mute">Nothing needs using up soon.</p>
        )}
      </section>
      <section className="flex flex-col gap-3" aria-labelledby="rail-act">
        <div className="flex items-baseline justify-between">
          <SectionLabel id="rail-act">Activity</SectionLabel>
          <Link href="/activity/" className="text-[13px] font-semibold text-leaf">
            See all
          </Link>
        </div>
        {activity.length > 0 ? (
          <ul className="flex flex-col gap-3">
            {activity.slice(0, 6).map((a) => (
              <li key={a.id} className="flex items-start gap-3">
                <Avatar name={a.actor ? (names.get(a.actor) ?? "?") : "?"} index={Math.max(0, members.findIndex((m) => m.userId === a.actor))} size={30} />
                <span className="min-w-0 text-[13.5px] leading-snug">
                  <span className="font-semibold">{who(a.actor)}</span> {activitySentence(a)}
                  <span className="block text-[12px] text-mute">
                    {a.locationId ? placeById.get(a.locationId)?.name : ""} · {timeAgo(a.at)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-mute">Nothing yet. Changes from everyone at home show up here.</p>
        )}
      </section>
    </>
  );

  return (
    <AppShell wide rail={rail}>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[13.5px] text-mute">
              {current.name}
              {places ? ` · ${places.length === 1 ? "1 place" : `${places.length} places`} · ${countThings(total)}` : ""}
            </p>
            <h1 className="font-display text-[1.75rem] leading-tight font-bold tracking-[-0.025em] sm:text-[2rem]">My Places</h1>
          </div>
          <Link href="/household/" className="mt-1 flex items-center sm:hidden" aria-label="Household and members">
            {members.slice(0, 3).map((m, i) => (
              <span key={m.userId} className="-ml-2 rounded-full ring-2 ring-bg first:ml-0">
                <Avatar name={m.displayName} index={i} size={36} />
              </span>
            ))}
          </Link>
        </div>
        <Link
          href="/search/"
          className="flex min-h-12 items-center gap-3 rounded-xl border border-line bg-card px-4 text-[15px] text-mute transition hover:text-fg sm:w-80"
        >
          <IconSearch className="size-5" />
          {total > 0 ? `Search ${countThings(total)}` : "Search everything you have"}
        </Link>
      </header>

      {error ? <Notice>{error}</Notice> : null}

      {recent.length > 0 ? (
        <section className="flex flex-col gap-2.5" aria-labelledby="recent-h">
          <div className="flex items-baseline justify-between">
            <SectionLabel id="recent-h">Recently opened</SectionLabel>
            <Link href="/activity/" className="text-[13px] font-semibold text-leaf xl:hidden">
              Activity
            </Link>
          </div>
          <ul className="grid grid-cols-3 gap-2.5 sm:max-w-xl">
            {recent.map((r) => {
              const p = placeById.get(r.locationId!)!;
              return (
                <li key={p.id}>
                  <Link href={`/place/?id=${p.id}`} className="group block">
                    <span className="block aspect-[4/3] overflow-hidden rounded-2xl bg-sunk">
                      <PlacePhoto type={p.type} className="transition duration-500 group-hover:scale-[1.05]" />
                    </span>
                    <span className="mt-1.5 block truncate text-[13px] font-semibold">{p.name}</span>
                    <span className="block truncate text-[12px] text-mute">
                      {who(r.actor)} · {timeAgo(r.at)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <section className="flex flex-col gap-3" aria-labelledby="places-h">
        <h2 id="places-h" className="sr-only">
          Places
        </h2>
        {sections.length > 1 ? (
          <div className="flex rounded-xl bg-sunk p-[3px] sm:w-fit" role="group" aria-label="Show places">
            {(["all", ...sections] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSection(s)}
                aria-pressed={section === s}
                className={`h-9 flex-1 rounded-[10px] px-4 text-[13.5px] font-semibold transition sm:flex-none ${
                  section === s ? "bg-card text-fg shadow-[0_1px_3px_rgba(0,0,0,0.08)]" : "text-mute hover:text-fg"
                }`}
              >
                {s === "all" ? "All" : SECTION_LABELS[s]}
              </button>
            ))}
          </div>
        ) : null}
        {groups === null ? (
          <ul className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 sm:gap-x-4" aria-busy="true">
            {[0, 1, 2, 3].map((i) => (
              <li key={i} className="aspect-[4/3] animate-pulse rounded-2xl bg-sunk" />
            ))}
          </ul>
        ) : places!.length === 0 ? (
          <FirstPlace onAdd={() => setAdding(true)} />
        ) : (
          <ul className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 sm:gap-x-4">
            {groups.map((g, i) => (
              <GroupCard
                key={g.type}
                group={g}
                index={i}
                soon={g.places.reduce((n, p) => n + (soon.get(p.id) ?? 0), 0)}
              />
            ))}
            <AddPlaceTile onClick={() => setAdding(true)} />
          </ul>
        )}
      </section>

      {useFirstList ? (
        <section aria-labelledby="first-h" className="flex flex-col gap-2.5 xl:hidden">
          <SectionLabel id="first-h">Use first</SectionLabel>
          {useFirstList}
        </section>
      ) : null}

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
    <div className="relative overflow-hidden rounded-[24px] bg-brand text-[#fffdf8]">
      <div className="absolute inset-0 opacity-60">
        <PlacePhoto type="attic" variant="wide" eager />
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-[#0f1c17] via-[#0f1c17]/70 to-[#0f1c17]/10" aria-hidden="true" />
      <div className="relative flex min-h-80 flex-col items-start justify-end gap-3 p-6 sm:min-h-96 sm:p-9">
        <h3 className="font-serif text-[2rem] leading-tight font-semibold">Add your first place</h3>
        <p className="max-w-md text-[#fffdf8]/80">
          A freezer, the attic, a wardrobe, a raised bed. Anywhere you put things. Give each its own name, like Garage Freezer or Blue Box.
        </p>
        <Button variant="gold" onClick={onAdd}>
          <IconPlus /> Add a place
        </Button>
      </div>
    </div>
  );
}
