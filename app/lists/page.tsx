"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { Session } from "@supabase/supabase-js";
import { AuthGate } from "@/components/AuthGate";
import { AppShell } from "@/components/AppShell";
import { HouseholdLoading, PageHeader } from "@/components/common/PageHeader";
import { useSeasonal } from "@/components/home/SeasonalReminders";
import { useHousehold } from "@/lib/hooks/useHousehold";
import { friendlyError } from "@/lib/supabase/errors";
import { loadLent } from "@/lib/stock";
import { loadToBuy } from "@/lib/shopping";
import { countIdeas } from "@/lib/presents";
import { isLongLent } from "@/lib/domain/lending";
import type { StockItem } from "@/lib/domain/stock";
import { Notice } from "@/components/ui/Notice";
import { IconBasket, IconBook, IconChevronRight, IconGift, IconHandOver, IconLeaf } from "@/components/ui/icons";

export default function ListsPage() {
  return <AuthGate>{(session) => <Lists session={session} />}</AuthGate>;
}

type Row = {
  href: string;
  Icon: (p: { className?: string }) => React.ReactNode;
  title: string;
  /** What's on it, in a few words. Null while loading. */
  caption: string | null;
  n: number | null;
  /** Something wants doing: the count shows in the late colour. */
  urgent?: boolean;
};

function Lists({ session }: { session: Session }) {
  const { current, places, error, setError, version } = useHousehold(session);
  const [toBuy, setToBuy] = useState<string[] | null>(null);
  const [ideas, setIdeas] = useState<number | null>(null);
  const [books, setBooks] = useState<number | null>(null);
  const [lent, setLent] = useState<StockItem[] | null>(null);
  const seasonal = useSeasonal(current?.householdId, places);

  const load = useCallback(async () => {
    if (!current) return;
    try {
      const [list, wishes, wanted, out] = await Promise.all([
        loadToBuy(current.householdId).catch(() => null),
        countIdeas(current.householdId).catch(() => null),
        countIdeas(current.householdId, "books").catch(() => null),
        loadLent(current.householdId),
      ]);
      setToBuy(list);
      setIdeas(wishes);
      setBooks(wanted);
      setLent(out);
    } catch (e) {
      setError(friendlyError(e));
    }
  }, [current, setError]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load, version]);

  const longLent = lent?.filter((i) => isLongLent(i)).length ?? 0;
  const jobs = seasonal.shown?.length ?? null;

  const rows: Row[] = [
    {
      href: "/list/",
      Icon: IconBasket,
      title: "Shopping list",
      n: toBuy?.length ?? null,
      caption: toBuy === null ? null : toBuy.length === 0 ? "Nothing to buy" : toBuy.slice(0, 3).join(", ") + (toBuy.length > 3 ? "…" : ""),
    },
    {
      href: "/presents/",
      Icon: IconGift,
      title: "Present ideas",
      n: ideas,
      caption: ideas === null ? null : ideas === 0 ? "Start a wish list" : "Everyone's wish lists",
    },
    {
      href: "/books/",
      Icon: IconBook,
      title: "Book wish lists",
      n: books,
      caption: books === null ? null : books === 0 ? "Start a reading list" : "What everyone wants to read next",
    },
    {
      href: "/lent/",
      Icon: IconHandOver,
      title: "Lent out",
      n: lent?.length ?? null,
      urgent: longLent > 0,
      caption:
        lent === null
          ? null
          : lent.length === 0
            ? "Nothing lent right now"
            : longLent > 0
              ? `${lent.length} lent · ${longLent} over a month`
              : lent.length === 1
                ? `With ${lent[0]!.lentTo}`
                : `${lent.length} things lent`,
    },
    {
      href: "/season/",
      Icon: IconLeaf,
      title: `${seasonal.season} jobs`,
      n: jobs,
      caption: jobs === null ? null : jobs === 0 ? "All done for now" : seasonal.shown!.map((r) => r.title).join(", "),
    },
  ];

  return (
    <AppShell>
      <PageHeader title="Lists" sub={current ? `Shared with everyone in ${current.name}.` : undefined} />
      {error ? <Notice>{error}</Notice> : null}
      {!current ? (
        <HouseholdLoading />
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card shadow-[var(--shadow-card)]">
          {rows.map((r) => (
            <li key={r.href}>
              <Link href={r.href} className="flex min-h-[76px] items-center gap-3.5 px-4 py-3 transition hover:bg-sunk/50">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-sunk text-leaf" aria-hidden="true">
                  <r.Icon className="size-[22px]" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-display text-[16px] leading-snug font-bold">{r.title}</span>
                  <span className={`block truncate text-[14px] ${r.urgent ? "text-late" : "text-mute"}`}>{r.caption ?? " "}</span>
                </span>
                {r.n !== null && r.n > 0 ? (
                  <span className={`font-display text-[1.35rem] leading-none font-bold tabular-nums ${r.urgent ? "text-late" : ""}`}>{r.n}</span>
                ) : null}
                <IconChevronRight className="size-5 shrink-0 text-mute/70" />
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Link href="/help/#lists" className="flex min-h-11 items-center gap-1.5 self-start text-[14px] font-semibold text-leaf">
        How lists work <IconChevronRight className="size-4" />
      </Link>
    </AppShell>
  );
}
