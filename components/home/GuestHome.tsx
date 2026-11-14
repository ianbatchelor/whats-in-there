"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import { AppShell, SectionLabel } from "@/components/AppShell";
import { Splash } from "@/components/ui/Screen";
import { Notice } from "@/components/ui/Notice";
import { SharedPlaces } from "@/components/home/SharedPlaces";
import { IconBasket, IconBulb, IconChevronRight, IconGift, IconHouse, IconList, IconPeople, IconStar } from "@/components/ui/icons";
import { countdown, daysToChristmas, isChristmasTime } from "@/lib/domain/christmas";
import { supabase } from "@/lib/supabase/client";
import { friendlyError } from "@/lib/supabase/errors";
import { familiesOf, loadMemberships, type Membership } from "@/lib/household";
import { loadEntries, loadLists } from "@/lib/ownLists";
import { listCaption, splitEntries, type ListEntry, type OwnList } from "@/lib/domain/ownLists";
import { loadSharedWithMe, type SharedPlace } from "@/lib/sharedPlaces";
import { KEYS, readLocal, writeLocal } from "@/lib/storage";

const KIND_ICON = { todo: IconList, ideas: IconBulb, buy: IconBasket } as const;

/**
 * Home for people with no household of their own: family who are here for presents, someone let into
 * a parent's freezer, a friend on a group list. It shows what's been shared with them. Setting up a
 * household is offered at the bottom, never in the way. Someone with nothing shared yet goes to /welcome/.
 */
export function GuestHome({ session }: { session: Session }) {
  const router = useRouter();
  const [state, setState] = useState<{ name: string | null; families: Membership[]; places: SharedPlace[]; lists: OwnList[]; entries: ListEntry[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const pending = readLocal(KEYS.pendingInvite);
    if (pending) {
      router.replace(`/invite/?token=${encodeURIComponent(pending)}`);
      return;
    }
    let live = true;
    (async () => {
      try {
        const [profile, memberships, places, lists] = await Promise.all([
          supabase().from("profiles").select("display_name").eq("user_id", session.user.id).maybeSingle(),
          loadMemberships(session.user.id),
          loadSharedWithMe().catch(() => [] as SharedPlace[]),
          loadLists().catch(() => [] as OwnList[]),
        ]);
        const families = familiesOf(memberships);
        if (!live) return;
        if (families.length === 0 && places.length === 0 && lists.length === 0) return router.replace("/welcome/");
        const entries = await loadEntries(lists.map((l) => l.id)).catch(() => [] as ListEntry[]);
        if (!live) return;
        setState({ name: (profile.data?.display_name as string | undefined) ?? null, families, places, lists, entries });
      } catch (e) {
        if (live) setError(friendlyError(e));
      }
    })();
    return () => {
      live = false;
    };
  }, [router, session.user.id]);

  if (error) {
    return (
      <AppShell>
        <Notice>{error}</Notice>
      </AppShell>
    );
  }
  if (!state) return <Splash />;

  const first = state.name?.trim().split(/\s+/)[0];
  const openPresents = (f: Membership) => {
    writeLocal(KEYS.presentsCircle, f.householdId);
    router.push("/presents/");
  };

  return (
    <AppShell wide>
      <header className="flex flex-col gap-1">
        <p className="text-[13.5px] text-mute">{new Date().toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}</p>
        <h1 className="font-display text-[1.75rem] leading-tight font-bold tracking-[-0.025em] sm:text-[2rem]">
          {greeting()}
          {first ? `, ${first}` : ""}
        </h1>
        <p className="text-[14.5px] text-mute">Here&apos;s what people have shared with you.</p>
      </header>

      <SharedPlaces places={state.places} />

      {state.families.length > 0 ? (
        <section className="flex flex-col gap-3" aria-labelledby="family-h">
          <SectionLabel id="family-h">Presents</SectionLabel>
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card shadow-[var(--shadow-card)]">
            {state.families.map((f) => (
              <li key={f.householdId}>
                <button onClick={() => openPresents(f)} className="flex min-h-[72px] w-full items-center gap-3.5 px-4 py-3 text-left transition hover:bg-sunk/50">
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-sunk text-leaf" aria-hidden="true">
                    <IconGift className="size-[22px]" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-display text-[16px] leading-snug font-bold">Present lists at {f.name}</span>
                    <span className="block truncate text-[14px] text-mute">Everyone&apos;s wish lists, and yours</span>
                  </span>
                  <IconChevronRight className="size-5 shrink-0 text-mute/70" />
                </button>
              </li>
            ))}
            {isChristmasTime() ? (
              <li>
                <Link href="/christmas/" className="flex min-h-[72px] w-full items-center gap-3.5 px-4 py-3 text-left transition hover:bg-sunk/50">
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-sunk text-leaf" aria-hidden="true">
                    <IconStar className="size-[22px]" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-display text-[16px] leading-snug font-bold">Christmas</span>
                    <span className="block truncate text-[14px] text-mute">{countdown(daysToChristmas())}. Who&apos;s getting what</span>
                  </span>
                  <IconChevronRight className="size-5 shrink-0 text-mute/70" />
                </Link>
              </li>
            ) : null}
          </ul>
        </section>
      ) : null}

      {state.lists.length > 0 ? (
        <section className="flex flex-col gap-3" aria-labelledby="lists-h">
          <div className="flex items-baseline justify-between">
            <SectionLabel id="lists-h">Lists</SectionLabel>
            <Link href="/lists/" className="text-[13px] font-semibold text-leaf">
              All lists
            </Link>
          </div>
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card shadow-[var(--shadow-card)]">
            {state.lists.map((l) => {
              const { open, done } = splitEntries(state.entries.filter((e) => e.listId === l.id));
              const Icon = l.visibility === "group" ? IconPeople : l.visibility === "family" ? IconGift : (KIND_ICON[l.kind] ?? IconList);
              return (
                <li key={l.id}>
                  <Link href={`/my-list/?id=${l.id}`} className="flex min-h-[72px] items-center gap-3.5 px-4 py-3 transition hover:bg-sunk/50">
                    <span className={`grid size-11 shrink-0 place-items-center rounded-xl ${l.visibility === "group" ? "bg-plum-bg text-plum" : "bg-sunk text-leaf"}`} aria-hidden="true">
                      <Icon className="size-[22px]" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-display text-[16px] leading-snug font-bold">{l.title}</span>
                      <span className="block truncate text-[14px] text-mute">{listCaption(open.map((e) => e.text), done.length)}</span>
                    </span>
                    {open.length > 0 ? <span className="font-display text-[1.35rem] leading-none font-bold tabular-nums">{open.length}</span> : null}
                    <IconChevronRight className="size-5 shrink-0 text-mute/70" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <Link
        href="/welcome/"
        className="flex min-h-14 items-center gap-3 rounded-2xl border-[1.5px] border-dashed border-line px-4 text-[14.5px] transition hover:bg-sunk/50"
      >
        <IconHouse className="size-5 shrink-0 text-leaf" />
        <span className="min-w-0 flex-1">
          <b className="font-semibold">Keep track of your own home too</b>
          <span className="block text-[13.5px] text-mute">Set up a household any time. Nothing shared with you changes.</span>
        </span>
        <IconChevronRight className="size-4 shrink-0 text-mute/70" />
      </Link>
    </AppShell>
  );
}

function greeting(now: Date = new Date()): string {
  const h = now.getHours();
  return h < 5 ? "Good evening" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}
