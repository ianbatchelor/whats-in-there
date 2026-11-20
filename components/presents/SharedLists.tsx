"use client";

import Link from "next/link";
import { SectionLabel } from "@/components/AppShell";
import { IconChevronRight, IconGift } from "@/components/ui/icons";
import { firstName } from "@/lib/domain/presents";
import type { SharedPresentList } from "@/lib/listViewers";

/** Present lists in other households that someone let you into, one row each. */
export function SharedPresentLists({ lists, title = "Present lists shared with you" }: { lists: SharedPresentList[]; title?: string }) {
  if (lists.length === 0) return null;
  return (
    <section className="flex flex-col gap-3" aria-labelledby="shared-lists-h">
      <SectionLabel id="shared-lists-h">{title}</SectionLabel>
      <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card shadow-[var(--shadow-card)]">
        {lists.map((l) => (
          <li key={l.id}>
            <Link href={`/gift-list/?id=${l.id}`} className="flex min-h-[72px] items-center gap-3.5 px-4 py-3 transition hover:bg-sunk/50">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#f6e3e1] text-[#8f2d2d]" aria-hidden="true">
                <IconGift className="size-[22px]" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-display text-[16px] leading-snug font-bold">{firstName(l.name)}&apos;s present list</span>
                <span className="block truncate text-[14px] text-mute">
                  {l.free === 0 ? "Nothing free right now" : `${l.free} still free`} · from {firstName(l.sharedBy)}
                </span>
              </span>
              <IconChevronRight className="size-5 shrink-0 text-mute/70" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
