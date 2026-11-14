"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { ListSettingsSheet } from "@/components/lists/ListSettingsSheet";
import { createList, loadEntries, loadLists, loadPeople } from "@/lib/ownLists";
import { listCaption, listsForTab, splitEntries, type ListEntry, type ListPerson, type OwnList } from "@/lib/domain/ownLists";
import { supabase } from "@/lib/supabase/client";
import {
  IconBasket,
  IconBook,
  IconBulb,
  IconChevronRight,
  IconGift,
  IconHandOver,
  IconHouse,
  IconLeaf,
  IconList,
  IconLock,
  IconPeople,
  IconPlus,
} from "@/components/ui/icons";

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
  /** A group list: people outside the household. */
  group?: boolean;
};

const KIND_ICON = { todo: IconList, ideas: IconBulb, buy: IconBasket } as const;

function Lists({ session }: { session: Session }) {
  const router = useRouter();
  const { current, ready, members, names, places, error, setError, version } = useHousehold(session, { optional: true });
  const [own, setOwn] = useState<OwnList[] | null>(null);
  const [ownEntries, setOwnEntries] = useState<ListEntry[]>([]);
  const [people, setPeople] = useState<ListPerson[]>([]);
  const [making, setMaking] = useState(false);
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

  // Your own lists, the household's and group lists: these work with or without a household.
  const loadOwn = useCallback(async () => {
    try {
      const [mine, who] = await Promise.all([loadLists(), loadPeople().catch(() => [] as ListPerson[])]);
      setOwnEntries(await loadEntries(mine.map((l) => l.id)).catch(() => []));
      setPeople(who);
      setOwn(mine);
    } catch (e) {
      setError(friendlyError(e));
    }
  }, [setError]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (ready) loadOwn();
  }, [ready, loadOwn]);

  // Someone at home shares a list, or adds to one: the counts keep up.
  useEffect(() => {
    if (!ready) return;
    const channel = supabase()
      .channel(`own-lists:${session.user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "lists" }, () => loadOwn())
      .on("postgres_changes", { event: "*", schema: "public", table: "list_entries" }, () => loadOwn())
      .on("postgres_changes", { event: "*", schema: "public", table: "list_members" }, () => loadOwn())
      .subscribe();
    return () => {
      supabase().removeChannel(channel);
    };
  }, [ready, loadOwn, session.user.id]);

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

  const tab = own ? listsForTab(own, session.user.id, current?.householdId ?? null) : { mine: [], home: [], groups: [] };
  const toRow = (l: OwnList, privateList: boolean): Row => {
    const { open, done } = splitEntries(ownEntries.filter((e) => e.listId === l.id));
    const ownerName = names.get(l.owner) ?? people.find((p) => p.listId === l.id && p.isOwner)?.name;
    const by = !privateList && l.owner !== session.user.id ? ownerName : null;
    return {
      href: `/my-list/?id=${l.id}`,
      Icon: KIND_ICON[l.kind] ?? IconList,
      title: l.title,
      n: open.length,
      caption: (by ? `${by}'s · ` : "") + listCaption(open.map((e) => e.text), done.length),
    };
  };
  const homeRows = [...rows.slice(0, 3), ...tab.home.map((l) => toRow(l, false)), ...rows.slice(3)];
  const mineRows = tab.mine.map((l) => toRow(l, true));
  const groupRows = tab.groups.map((l) => {
    const row = toRow(l, false);
    const n = people.filter((p) => p.listId === l.id).length;
    return { ...row, Icon: IconPeople, group: true, caption: `${n === 1 ? "Just you so far" : `${n} people`} · ${row.caption}` };
  });
  const others = members.filter((m) => m.userId !== session.user.id).map((m) => m.displayName);

  return (
    <AppShell>
      <PageHeader title="Lists" sub="Lists for everyone at home, just for you, or for a group you invite." />
      {error ? <Notice>{error}</Notice> : null}
      {!ready || own === null ? (
        <HouseholdLoading />
      ) : (
        <>
          {current ? <Section id="home-h" label={`Everyone in ${current.name}`} Icon={IconHouse} rows={homeRows} /> : null}
          {groupRows.length > 0 ? <Section id="groups-h" label="Groups" Icon={IconPeople} rows={groupRows} /> : null}
          {mineRows.length > 0 ? <Section id="mine-h" label="Just you" Icon={IconLock} rows={mineRows} /> : null}
          <button
            onClick={() => setMaking(true)}
            className="flex min-h-14 items-center justify-center gap-2 rounded-2xl border-[1.5px] border-dashed border-line font-display text-[15px] font-bold text-leaf transition hover:bg-sunk/50"
          >
            <IconPlus className="size-[18px]" /> New list
          </button>
          {mineRows.length === 0 && groupRows.length === 0 ? (
            <p className="-mt-2 text-center text-[13.5px] text-mute">Make a list just for you, for everyone at home, or for friends you invite.</p>
          ) : null}
          {!current ? (
            <Link href="/welcome/" className="flex min-h-11 items-center gap-1.5 self-start text-[14px] font-semibold text-leaf">
              Keep track of your own home too <IconChevronRight className="size-4" />
            </Link>
          ) : null}
          <ListSettingsSheet
            open={making}
            onClose={() => setMaking(false)}
            householdId={current?.householdId ?? null}
            householdName={current?.name ?? null}
            others={others}
            onSave={async (s) => {
              const id = await createList(s);
              setMaking(false);
              router.push(`/my-list/?id=${id}`);
            }}
          />
        </>
      )}
      <Link href="/help/#lists" className="flex min-h-11 items-center gap-1.5 self-start text-[14px] font-semibold text-leaf">
        How lists work <IconChevronRight className="size-4" />
      </Link>
    </AppShell>
  );
}

function Section({ id, label, Icon, rows }: { id: string; label: string; Icon: (p: { className?: string }) => React.ReactNode; rows: Row[] }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-2">
      <h2 id={id} className="flex items-center gap-1.5 font-display text-[13px] font-bold tracking-[0.06em] text-mute uppercase">
        <Icon className="size-4" /> {label}
      </h2>
      <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card shadow-[var(--shadow-card)]">
        {rows.map((r) => (
          <li key={r.href}>
            <Link href={r.href} className="flex min-h-[76px] items-center gap-3.5 px-4 py-3 transition hover:bg-sunk/50">
              <span className={`grid size-11 shrink-0 place-items-center rounded-xl ${r.group ? "bg-plum-bg text-plum" : "bg-sunk text-leaf"}`} aria-hidden="true">
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
    </section>
  );
}
