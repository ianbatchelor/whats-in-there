"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Session } from "@supabase/supabase-js";
import { AuthGate } from "@/components/AuthGate";
import { AppShell, SectionLabel } from "@/components/AppShell";
import { HouseholdLoading, PageHeader } from "@/components/common/PageHeader";
import { Avatar } from "@/components/ui/Avatar";
import { Notice } from "@/components/ui/Notice";
import { IconChevronRight, IconGift, IconList, IconPlus, IconSnow } from "@/components/ui/icons";
import { useHousehold } from "@/lib/hooks/useHousehold";
import { usePresentCircle } from "@/lib/hooks/usePresentCircle";
import { friendlyError } from "@/lib/supabase/errors";
import { loadPresents, type Presents } from "@/lib/presents";
import { people as presentPeople } from "@/lib/domain/presents";
import { CHRISTMAS_SEARCH, countdown, daysToChristmas, isChristmassy, presentProgress, progressLine } from "@/lib/domain/christmas";
import { loadEntries, loadLists } from "@/lib/ownLists";
import { listCaption, splitEntries, type ListEntry, type OwnList } from "@/lib/domain/ownLists";
import { loadMatching, loadUseFirst } from "@/lib/stock";
import type { StockItem } from "@/lib/domain/stock";
import { countThings } from "@/lib/domain/places";
import { storageAge, todayIso } from "@/lib/domain/dates";

export default function ChristmasPage() {
  return <AuthGate>{(session) => <Christmas session={session} />}</AuthGate>;
}

/** Freezer things stored this long are worth using up to make room for Christmas food. */
const MAKE_ROOM_DAYS = 60;

function Christmas({ session }: { session: Session }) {
  const me = session.user.id;
  const { current, ready, places, placeById, error, setError } = useHousehold(session, { optional: true });
  const { circle, members } = usePresentCircle(session);
  const [presents, setPresents] = useState<Presents | null>(null);
  const [lists, setLists] = useState<{ lists: OwnList[]; entries: ListEntry[] } | null>(null);
  const [things, setThings] = useState<StockItem[] | null>(null);
  const [freezer, setFreezer] = useState<StockItem[]>([]);

  useEffect(() => {
    if (!circle) return;
    let live = true;
    loadPresents(circle.householdId)
      .then((p) => live && setPresents(p))
      .catch((e) => live && setError(friendlyError(e)));
    return () => {
      live = false;
    };
  }, [circle, setError]);

  useEffect(() => {
    if (!ready) return;
    let live = true;
    (async () => {
      try {
        const all = await loadLists();
        // Lists made for Christmas, and anything shared with family (that's usually what it's for).
        const xmas = all.filter((l) => isChristmassy(l.title) || l.visibility === "family");
        const entries = await loadEntries(xmas.map((l) => l.id));
        if (live) setLists({ lists: xmas, entries });
      } catch (e) {
        if (live) setError(friendlyError(e));
      }
    })();
    return () => {
      live = false;
    };
  }, [ready, setError]);

  useEffect(() => {
    if (!current) return;
    let live = true;
    Promise.all([loadMatching(current.householdId, CHRISTMAS_SEARCH), loadUseFirst(current.householdId, 200)])
      .then(([found, oldest]) => {
        if (!live) return;
        setThings(found);
        const cutoff = Date.now() - MAKE_ROOM_DAYS * 86_400_000;
        setFreezer(oldest.filter((i) => new Date(i.frozenAt ?? i.addedAt).getTime() < cutoff));
      })
      .catch((e) => live && setError(friendlyError(e)));
    return () => {
      live = false;
    };
  }, [current, setError]);

  const days = daysToChristmas();
  const progress = useMemo(() => {
    if (!presents) return null;
    const ps = presentPeople(members, presents.lists, me);
    return presentProgress(ps, presents.ideas, presents.claims, me);
  }, [presents, members, me]);

  // Boxes and places named for Christmas, then Christmas things stored elsewhere.
  const boxes = (places ?? []).filter((p) => isChristmassy(p.name));
  const boxIds = new Set(boxes.map((b) => b.id));
  const loose = (things ?? []).filter((t) => !boxIds.has(t.locationId));
  const makeRoom = freezer.filter((i) => placeById.get(i.locationId)?.type === "freezer").slice(0, 5);

  return (
    <AppShell>
      <PageHeader
        title="Christmas"
        back={{ href: "/lists/", label: "Lists" }}
        sub={`${countdown(days)}. Presents, lists, decorations and room in the freezer, all in one place.`}
      />
      {error ? <Notice>{error}</Notice> : null}

      <section aria-labelledby="xp-h" className="flex flex-col gap-2.5">
        <div className="flex items-baseline justify-between">
          <SectionLabel id="xp-h">Presents{circle && circle.householdId !== current?.householdId ? ` · ${circle.name}` : ""}</SectionLabel>
          <Link href="/presents/" className="text-[13px] font-semibold text-leaf">
            All lists
          </Link>
        </div>
        {progress === null ? (
          <HouseholdLoading />
        ) : (
          <ul className="overflow-hidden rounded-2xl border border-line bg-card shadow-[var(--shadow-card)]">
            {progress.map((p, i) => {
              const own = p.userId === me;
              const done = !own && p.ideas > 0 && p.taken === p.ideas;
              return (
                <li key={p.userId ?? p.name} className="border-b border-line last:border-b-0">
                  <Link href={p.userId ? `/presents/?for=${p.userId}` : "/presents/"} className="flex min-h-16 items-center gap-3 px-4 py-2.5 transition hover:bg-sunk/50">
                    <Avatar name={p.name} index={i} size={34} />
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{own ? "You" : p.name}</span>
                      <span className={`block text-[13.5px] ${done ? "text-ok" : p.yours > 0 ? "text-leaf" : "text-mute"}`}>{done ? "Everything's taken" : progressLine(p, own)}</span>
                    </span>
                    <IconChevronRight className="size-4 shrink-0 text-mute/70" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="xl-h" className="flex flex-col gap-2.5">
        <SectionLabel id="xl-h">Lists for the day</SectionLabel>
        {lists && lists.lists.length > 0 ? (
          <ul className="overflow-hidden rounded-2xl border border-line bg-card shadow-[var(--shadow-card)]">
            {lists.lists.map((l) => {
              const { open, done } = splitEntries(lists.entries.filter((e) => e.listId === l.id));
              return (
                <li key={l.id} className="border-b border-line last:border-b-0">
                  <Link href={`/my-list/?id=${l.id}`} className="flex min-h-16 items-center gap-3 px-4 py-2.5 transition hover:bg-sunk/50">
                    <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-sunk text-leaf" aria-hidden="true">
                      {l.visibility === "family" ? <IconGift className="size-5" /> : <IconList className="size-5" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{l.title}</span>
                      <span className="block truncate text-[13.5px] text-mute">{listCaption(open.map((e) => e.text), done.length)}</span>
                    </span>
                    {open.length > 0 ? <span className="font-display text-[1.2rem] font-bold tabular-nums">{open.length}</span> : null}
                    <IconChevronRight className="size-4 shrink-0 text-mute/70" />
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : lists ? (
          <p className="text-[14.5px] text-mute">Lists with Christmas in the name, or shared with family, show up here.</p>
        ) : null}
        <Link href="/lists/?new=christmas" className="flex min-h-11 items-center gap-1.5 self-start text-[14px] font-semibold text-leaf">
          <IconPlus className="size-4" /> Start a Christmas list
        </Link>
      </section>

      {current ? (
        <section aria-labelledby="xd-h" className="flex flex-col gap-2.5">
          <SectionLabel id="xd-h">Decorations and Christmas things</SectionLabel>
          {things === null ? null : boxes.length + loose.length === 0 ? (
            <p className="text-[14.5px] text-mute">Nothing stored yet. Add the decorations box when it goes back in the loft, and it&apos;ll be easy to find next year.</p>
          ) : (
            <ul className="overflow-hidden rounded-2xl border border-line bg-card shadow-[var(--shadow-card)]">
              {boxes.map((b) => (
                <li key={b.id} className="border-b border-line last:border-b-0">
                  <Link href={`/place/?id=${b.id}`} className="flex min-h-14 items-center gap-3 px-4 py-2.5 transition hover:bg-sunk/50">
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{placeById.get(b.id)?.name ?? b.name}</span>
                      <span className="block text-[13.5px] text-mute">{countThings(b.itemCount)}</span>
                    </span>
                    <IconChevronRight className="size-4 shrink-0 text-mute/70" />
                  </Link>
                </li>
              ))}
              {loose.slice(0, 8).map((t) => (
                <li key={t.id} className="border-b border-line last:border-b-0">
                  <Link href={`/place/?id=${t.locationId}`} className="flex min-h-14 items-center gap-3 px-4 py-2.5 transition hover:bg-sunk/50">
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{t.productName}</span>
                      <span className="block truncate text-[13.5px] text-mute">{placeById.get(t.locationId)?.name ?? "Somewhere at home"}</span>
                    </span>
                    <IconChevronRight className="size-4 shrink-0 text-mute/70" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {current && makeRoom.length > 0 ? (
        <section aria-labelledby="xf-h" className="flex flex-col gap-2.5">
          <SectionLabel id="xf-h">Make room in the freezer</SectionLabel>
          <p className="-mt-1 text-[14px] text-mute">The longest-frozen things, to use up before the Christmas food goes in.</p>
          <ul className="overflow-hidden rounded-2xl border border-line bg-card shadow-[var(--shadow-card)]">
            {makeRoom.map((t) => (
              <li key={t.id} className="border-b border-line last:border-b-0">
                <Link href={`/place/?id=${t.locationId}`} className="flex min-h-14 items-center gap-3 px-4 py-2.5 transition hover:bg-sunk/50">
                  <IconSnow className="size-5 shrink-0 text-[#3b6e8f]" />
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{t.productName}</span>
                    <span className="block truncate text-[13.5px] text-mute">
                      {placeById.get(t.locationId)?.name} · {storageAge((t.frozenAt ?? t.addedAt).slice(0, 10), todayIso())} in
                    </span>
                  </span>
                  <IconChevronRight className="size-4 shrink-0 text-mute/70" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </AppShell>
  );
}
