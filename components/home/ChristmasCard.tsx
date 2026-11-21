"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Member } from "@/lib/household";
import { loadPresents } from "@/lib/presents";
import { people as presentPeople } from "@/lib/domain/presents";
import { countdown, daysToChristmas, isChristmassy, presentProgress, stillToSort } from "@/lib/domain/christmas";
import { loadEntries, loadLists } from "@/lib/ownLists";
import { IconChevronRight, IconGift, IconList, IconStar } from "@/components/ui/icons";

type ListLine = { id: string; title: string; left: number };

/**
 * Home's Christmas card, 1 to 26 December: the countdown, whose present lists still have ideas
 * nobody is getting, and the lists for the day. Quiet on purpose: a small star, no snow.
 */
export function ChristmasCard({ householdId, members, me, version }: { householdId: string; members: Member[]; me: string; version: number }) {
  /** Lines for lists with ideas still free; `any` is false when nobody else has ideas yet. */
  const [presents, setPresents] = useState<{ lines: string[]; any: boolean } | null>(null);
  const [lists, setLists] = useState<ListLine[]>([]);

  useEffect(() => {
    let live = true;
    loadPresents(householdId)
      .then((p) => {
        if (!live) return;
        const progress = presentProgress(presentPeople(members, p.lists, me), p.ideas, p.claims, me);
        setPresents({ lines: stillToSort(progress, me), any: progress.some((x) => x.userId !== me && x.ideas > 0) });
      })
      .catch(() => live && setPresents({ lines: [], any: false }));
    (async () => {
      const all = await loadLists();
      const xmas = all.filter((l) => isChristmassy(l.title)).slice(0, 2);
      const entries = await loadEntries(xmas.map((l) => l.id));
      if (live) setLists(xmas.map((l) => ({ id: l.id, title: l.title, left: entries.filter((e) => e.listId === l.id && !e.doneAt).length })));
    })().catch(() => {});
    return () => {
      live = false;
    };
  }, [householdId, members, me, version]);

  const days = daysToChristmas();
  return (
    <section aria-labelledby="xmas-h" className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-card shadow-[var(--shadow-card)]">
      <Link href="/christmas/" className="flex items-center gap-3 px-4 pt-3.5 pb-2 transition hover:bg-sunk/40">
        <IconStar className="size-5 shrink-0 text-[#c98a14]" />
        <h2 id="xmas-h" className="min-w-0 flex-1 font-display text-[15px] font-bold tracking-[-0.01em]">
          Christmas <span className="font-semibold text-mute">· {days === 0 ? "today" : days === 1 ? "tomorrow" : countdown(days)}</span>
        </h2>
        <IconChevronRight className="size-4 shrink-0 text-mute/70" />
      </Link>
      <ul className="divide-y divide-line border-t border-line empty:hidden">
        {presents === null || !presents.any ? null : presents.lines.length > 0 ? (
          presents.lines.map((line) => (
            <li key={line}>
              <Link href="/presents/" className="flex min-h-11 items-center gap-3 px-4 py-2 text-[14.5px] transition hover:bg-sunk/50">
                <IconGift className="size-[18px] shrink-0 text-leaf" />
                <span className="min-w-0 flex-1 truncate">{line}</span>
              </Link>
            </li>
          ))
        ) : (
          <li className="flex min-h-11 items-center gap-3 px-4 py-2 text-[14.5px] text-mute">
            <IconGift className="size-[18px] shrink-0 text-leaf" />
            Every present idea is spoken for
          </li>
        )}
        {lists.map((l) => (
          <li key={l.id}>
            <Link href={`/my-list/?id=${l.id}`} className="flex min-h-11 items-center gap-3 px-4 py-2 text-[14.5px] transition hover:bg-sunk/50">
              <IconList className="size-[18px] shrink-0 text-leaf" />
              <span className="min-w-0 flex-1 truncate">{l.title}</span>
              <span className="shrink-0 text-[13px] text-mute">{l.left === 0 ? "All done" : `${l.left} to do`}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
