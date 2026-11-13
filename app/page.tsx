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
import {
  SECTION_LABELS,
  countThings,
  groupPlaces,
  isKeepPlace,
  isUseUpPlace,
  rollUp,
  sectionOf,
  topPlaceId,
  usedSections,
  type PlaceSection,
} from "@/lib/domain/places";
import { timeAgo } from "@/lib/domain/dates";
import { activitySentence } from "@/lib/domain/activity";
import type { StockItem } from "@/lib/domain/stock";
import { loadActivity, loadAttention, loadLent, loadUseFirst, type Activity } from "@/lib/stock";
import { isLongLent } from "@/lib/domain/lending";
import { itemStatus, needsAttention } from "@/lib/domain/status";
import { tookOutMessage, useQuickTake } from "@/components/stock/useQuickTake";
import { Splash } from "@/components/ui/Screen";
import { Avatar } from "@/components/ui/Avatar";
import { Notice } from "@/components/ui/Notice";
import { Button } from "@/components/ui/Button";
import { Toast } from "@/components/ui/Toast";
import { IconBasket, IconCheck, IconGift, IconHandOver, IconLeaf, IconScan, IconSearch } from "@/components/ui/icons";
import { loadToBuy } from "@/lib/shopping";
import { countIdeas } from "@/lib/presents";
import { ideaCountCaption } from "@/lib/domain/presents";
import { AddPlaceSheet } from "@/components/home/AddPlaceSheet";
import { AddPlaceTile, GroupCard } from "@/components/home/PlaceCard";
import { FirstThingsTip, StarterPlaces } from "@/components/home/StarterPlaces";
import { useSeasonal } from "@/components/home/SeasonalReminders";
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

function Home({ session }: { session: Session }) {
  const hh = useHousehold(session);
  const { current, members, places, names, placeById, error, version, refresh } = hh;
  const [adding, setAdding] = useState(false);
  const [useFirst, setUseFirst] = useState<StockItem[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [attention, setAttention] = useState<StockItem[]>([]);
  const [lent, setLent] = useState<StockItem[]>([]);
  const [toBuy, setToBuy] = useState<string[] | null>(null);
  const [ideas, setIdeas] = useState<number | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [section, setSection] = useState<PlaceSection | "all">("all");
  const [open, setOpen] = useState<StockItem | null>(null);
  const seasonal = useSeasonal(current?.householdId, places);

  const loadExtras = useCallback(async () => {
    if (!current) return;
    try {
      const [first, acts, due, out, list, wishes] = await Promise.all([
        loadUseFirst(current.householdId, 60),
        loadActivity(current.householdId, 40),
        loadAttention(current.householdId),
        loadLent(current.householdId).catch(() => []),
        loadToBuy(current.householdId).catch(() => null),
        countIdeas(current.householdId).catch(() => null),
      ]);
      setToBuy(list);
      setIdeas(wishes);
      setUseFirst(first);
      setLent(out);
      setActivity(acts);
      setAttention(due.filter((i) => needsAttention(i)));
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
  const { taking, takeOne } = useQuickTake(announce, refresh);

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

  // Home shows the places that aren't inside anything; a box's things count towards its place.
  const topPlaces = places ? rollUp(places) : null;
  const sections = topPlaces ? usedSections(topPlaces) : [];
  const shownPlaces = topPlaces && section !== "all" ? topPlaces.filter((p) => sectionOf(p.type) === section) : topPlaces;
  const groups = shownPlaces ? groupPlaces(shownPlaces) : null;
  const total = places?.reduce((n, p) => n + p.itemCount, 0) ?? 0;
  const who = (id: string | null) => (id === session.user.id ? "You" : (id && names.get(id)) || "Someone");
  // Per place: how many are past a printed date, and how many are only close to one.
  const lateIn = new Map<string, number>();
  const soonIn = new Map<string, number>();
  for (const i of attention) {
    const m = itemStatus(i)?.tone === "late" ? lateIn : soonIn;
    const at = topPlaceId(i.locationId, placeById);
    m.set(at, (m.get(at) ?? 0) + 1);
  }
  const late = [...lateIn.values()].reduce((a, b) => a + b, 0);
  const sumOver = (m: Map<string, number>, ids: { id: string }[]) => ids.reduce((n, p) => n + (m.get(p.id) ?? 0), 0);
  const dueIds = new Set(attention.map((i) => i.id));
  // "Longest stored" is what's left of the use-first order once dated things have their own card. Only
  // places things get used up from count: photo albums in the attic are meant to stay there.
  const inUseUpPlace = (i: StockItem) => {
    const type = placeById.get(i.locationId)?.type;
    return !!type && isUseUpPlace(type);
  };
  const oldest = useFirst.filter((i) => !dueIds.has(i.id) && inUseUpPlace(i)).slice(0, 4);
  const keptIn = (i: StockItem) => {
    const type = placeById.get(i.locationId)?.type;
    return !!type && isKeepPlace(type);
  };
  const shownAttention = showAll ? attention : attention.slice(0, 4);
  const firstName = hh.me?.displayName.trim().split(/\s+/)[0];

  // Lent things that have been away a month or more come up near the top, so they get asked for back.
  const longLent = lent.filter((i) => isLongLent(i)).length;

  const row = (item: StockItem, i: number) => (
    <ItemRow
      key={item.id}
      index={i}
      item={item}
      place={placeById.get(item.locationId)?.name}
      placeType={placeById.get(item.locationId)?.type}
      keep={keptIn(item)}
      addedBy={item.addedBy ? who(item.addedBy) : ""}
      onOpen={setOpen}
      onTakeOne={takeOne}
      taking={taking === item.id}
    />
  );

  const rail = (
    <>
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
                <Avatar
                  name={a.actor ? (names.get(a.actor) ?? "?") : "?"}
                  index={Math.max(
                    0,
                    members.findIndex((m) => m.userId === a.actor),
                  )}
                  size={30}
                />
                <span className="min-w-0 text-[13.5px] leading-snug">
                  <span className="font-semibold">{who(a.actor)}</span> {activitySentence(a, a.toLocationId ? placeById.get(a.toLocationId)?.name : undefined)}
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
              {current.name} · {new Date().toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
            </p>
            <h1 className="font-display text-[1.75rem] leading-tight font-bold tracking-[-0.025em] sm:text-[2rem]">
              {greeting()}
              {firstName ? `, ${firstName}` : ""}
            </h1>
          </div>
          <Link href="/household/" className="mt-1 flex items-center sm:hidden" aria-label="Household and members">
            {members.slice(0, 3).map((m, i) => (
              <span key={m.userId} className="-ml-2 rounded-full ring-2 ring-bg first:ml-0">
                <Avatar name={m.displayName} index={i} size={34} />
              </span>
            ))}
          </Link>
        </div>
        <div className="flex min-h-12 items-center rounded-xl border border-line bg-card text-[15px] text-mute sm:w-80">
          <Link href="/search/" className="flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-l-xl pl-4 transition hover:text-fg">
            <IconSearch className="size-5 shrink-0" />
            <span className="truncate">{total > 0 ? `Search ${countThings(total)}` : "Search everything you have"}</span>
          </Link>
          <Link
            href="/add/"
            aria-label="Scan a label"
            title="Scan a label"
            className="mr-1 grid size-10 shrink-0 place-items-center rounded-lg text-leaf transition hover:bg-sunk"
          >
            <IconScan className="size-5" />
          </Link>
        </div>
      </header>

      {error ? <Notice>{error}</Notice> : null}

      {places && places.length > 0 ? (
        <dl className="hidden grid-cols-4 divide-x divide-line rounded-2xl border border-line bg-card lg:grid">
          {[
            { n: total, label: total === 1 ? "thing" : "things", tone: "" },
            { n: places.length, label: places.length === 1 ? "place" : "places", tone: "" },
            { n: late, label: "past a date", tone: late > 0 ? "text-late" : "" },
            { n: attention.length - late, label: "to use soon", tone: attention.length - late > 0 ? "text-soon" : "" },
          ].map((s) => (
            <div key={s.label} className="px-5 py-3.5">
              <dd className={`font-display text-[1.45rem] leading-tight font-bold tabular-nums ${s.tone}`}>{s.n}</dd>
              <dt className="text-[13px] text-mute">{s.label}</dt>
            </div>
          ))}
        </dl>
      ) : null}

      {attention.length > 0 ? (
        <section className="flex flex-col gap-2.5" aria-labelledby="attention-h">
          <div className="flex items-baseline justify-between">
            <SectionLabel id="attention-h">Needs attention</SectionLabel>
            <span className="text-[13px] text-mute">
              {late > 0 ? `${late} past a date` : null}
              {late > 0 && attention.length > late ? " · " : null}
              {attention.length > late ? `${attention.length - late} to use soon` : null}
            </span>
          </div>
          <ItemList>{shownAttention.map(row)}</ItemList>
          {attention.length > 4 ? (
            <button onClick={() => setShowAll((v) => !v)} className="min-h-10 self-start text-[14px] font-semibold text-leaf">
              {showAll ? "Show fewer" : `Show all ${attention.length}`}
            </button>
          ) : null}
        </section>
      ) : places && places.length > 0 && total === 0 ? (
        <FirstThingsTip />
      ) : total > 0 ? (
        <p className="flex items-center gap-2.5 rounded-2xl border border-line bg-card px-4 py-3 text-[14.5px] text-mute">
          <span className="grid size-6 shrink-0 place-items-center rounded-full bg-ok-bg text-ok" aria-hidden="true">
            <IconCheck className="size-3.5" />
          </span>
          Nothing needs using up in the next two weeks.
        </p>
      ) : null}

      {places && places.length > 0 ? (
        <Glance
          tiles={[
            {
              href: "/list/",
              Icon: IconBasket,
              label: "Shopping",
              n: toBuy?.length ?? null,
              caption: toBuy && toBuy.length === 0 ? "nothing to buy" : "to buy",
              tone: "",
            },
            {
              href: "/presents/",
              Icon: IconGift,
              label: "Presents",
              n: ideas,
              caption: ideaCountCaption(ideas ?? 1),
              tone: "",
            },
            ...(lent.length > 0
              ? [
                  {
                    href: "/lent/",
                    Icon: IconHandOver,
                    label: "Lent out",
                    n: longLent > 0 ? longLent : lent.length,
                    caption: longLent > 0 ? "away over a month" : lent.length === 1 ? "thing lent" : "things lent",
                    tone: longLent > 0 ? "text-late" : "",
                  },
                ]
              : []),
            ...(seasonal.shown && seasonal.shown.length > 0
              ? [
                  {
                    href: "/season/",
                    Icon: IconLeaf,
                    label: seasonal.season,
                    n: seasonal.shown.length,
                    caption: seasonal.shown.length === 1 ? "job to do" : "jobs to do",
                    tone: "",
                  },
                ]
              : []),
          ]}
        />
      ) : null}

      <section className="flex flex-col gap-3" aria-labelledby="places-h">
        <h2 id="places-h" className="sr-only">
          Places
        </h2>
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <SectionLabel>Places</SectionLabel>
          {sections.length > 1 ? (
            <div className="flex gap-1.5" role="group" aria-label="Show places">
              {(["all", ...sections] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setSection(s)}
                  aria-pressed={section === s}
                  className={`h-10 rounded-full border px-4 text-[13.5px] font-semibold transition ${
                    section === s ? "border-fg bg-fg text-bg" : "border-line bg-card text-mute hover:text-fg"
                  }`}
                >
                  {s === "all" ? "All" : SECTION_LABELS[s]}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        {groups === null ? (
          <ul className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 sm:gap-x-4 lg:grid-cols-4" aria-busy="true">
            {[0, 1, 2, 3].map((i) => (
              <li key={i} className="aspect-[4/3] animate-pulse rounded-2xl bg-sunk" />
            ))}
          </ul>
        ) : places!.length === 0 ? (
          <StarterPlaces householdId={current.householdId} onAdded={refresh} onOwn={() => setAdding(true)} />
        ) : (
          <ul className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 sm:gap-x-4 lg:grid-cols-4">
            {groups.map((g, i) => (
              <GroupCard key={g.type} group={g} index={i} late={sumOver(lateIn, g.places)} soon={sumOver(soonIn, g.places)} />
            ))}
            <AddPlaceTile onClick={() => setAdding(true)} />
          </ul>
        )}
      </section>

      {oldest.length > 0 ? (
        <section aria-labelledby="first-h" className="flex flex-col gap-2.5">
          <SectionLabel id="first-h">Longest stored</SectionLabel>
          <ItemList>{oldest.map(row)}</ItemList>
        </section>
      ) : null}

      <AddPlaceSheet open={adding} onClose={() => setAdding(false)} householdId={current.householdId} onAdded={refresh} />
      <TakeOutSheet
        item={open}
        placeName={open ? placeById.get(open.locationId)?.name : undefined}
        keep={open ? keptIn(open) : false}
        householdId={current.householdId}
        names={names}
        onClose={() => setOpen(null)}
        onTaken={(before, after, amount, movementId) => {
          refresh();
          announce(tookOutMessage(before, after, amount, keptIn(before)), movementId);
        }}
        onChanged={(message, movementId) => {
          refresh();
          announce(message, movementId);
        }}
      />
      <Toast toast={toast} onDone={clear} />
    </AppShell>
  );
}

function greeting(now: Date = new Date()): string {
  const h = now.getHours();
  return h < 5 ? "Good evening" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

type Tile = { href: string; Icon: (p: { className?: string }) => React.ReactNode; label: string; n: number | null; caption: string; tone: string };

/** The shopping list, present ideas, lent things and seasonal jobs at a glance, so Home stays short and the places stay near the top. */
function Glance({ tiles }: { tiles: Tile[] }) {
  return (
    <ul className={`grid gap-2.5 ${tiles.length === 4 ? "grid-cols-2 sm:grid-cols-4" : tiles.length === 3 ? "grid-cols-3" : tiles.length === 2 ? "grid-cols-2" : "grid-cols-1"}`}>
      {tiles.map((t) => (
        <li key={t.href} className="min-w-0">
          <Link
            href={t.href}
            className="lift flex h-full min-h-[104px] flex-col gap-1 rounded-2xl border border-line bg-card p-3 shadow-[var(--shadow-card)]"
            aria-label={`${t.label}: ${t.n ?? ""} ${t.caption}`}
          >
            <span className="flex min-w-0 items-center gap-1.5 text-[13px] font-semibold text-mute">
              <t.Icon className="size-4 shrink-0 text-leaf" />
              <span className="truncate">{t.label}</span>
            </span>
            <span className={`mt-auto font-display text-[1.6rem] leading-none font-bold tabular-nums ${t.tone}`}>{t.n ?? "–"}</span>
            <span className={`text-[13px] leading-tight ${t.tone || "text-mute"}`}>{t.caption}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
