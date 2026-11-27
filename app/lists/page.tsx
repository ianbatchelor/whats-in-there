"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import { AuthGate } from "@/components/AuthGate";
import { AppShell } from "@/components/AppShell";
import { HouseholdLoading } from "@/components/common/PageHeader";
import { useSeasonal } from "@/components/home/SeasonalReminders";
import { useHousehold } from "@/lib/hooks/useHousehold";
import { useQueryParam } from "@/lib/hooks/useQueryParam";
import { friendlyError } from "@/lib/supabase/errors";
import { loadLent } from "@/lib/stock";
import { loadToBuy } from "@/lib/shopping";
import { countIdeas } from "@/lib/presents";
import { isLongLent } from "@/lib/domain/lending";
import type { StockItem } from "@/lib/domain/stock";
import { Notice } from "@/components/ui/Notice";
import { ListSettingsSheet } from "@/components/lists/ListSettingsSheet";
import { ChristmasFeature, HouseholdCards, ListSection, ShoppingRow, type HouseholdCardData, type ListRowData } from "@/components/lists/ListsLayout";
import { createList, loadEntries, loadLists, loadPeople } from "@/lib/ownLists";
import { shortNames } from "@/lib/domain/access";
import { daysToChristmas, isChristmasTime } from "@/lib/domain/christmas";
import { listCaption, listsForTab, splitEntries, type ListEntry, type ListPerson, type OwnList } from "@/lib/domain/ownLists";
import { supabase } from "@/lib/supabase/client";
import { loadNames } from "@/lib/sharedPlaces";
import { IconBasket, IconBulb, IconChevronRight, IconGift, IconHouse, IconList, IconLock, IconPeople, IconPlus } from "@/components/ui/icons";

export default function ListsPage() {
  return <AuthGate>{(session) => <Lists session={session} />}</AuthGate>;
}

const CHRISTMAS_START = { title: "Christmas dinner", kind: "buy" as const, visibility: "family" as const };

const KIND_ICON = { todo: IconList, ideas: IconBulb, buy: IconBasket } as const;
/** A small tint behind each kind of list, so they're easy to tell apart at a glance. */
const KIND_TONE = { todo: "bg-slate text-forest", ideas: "bg-honey text-forest", buy: "bg-sage text-forest" } as const;

/** "Batchelor household": the name as people typed it, with a capital to start. */
function sentenceCase(name: string): string {
  const t = name.trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function Lists({ session }: { session: Session }) {
  const router = useRouter();
  const { current, ready, members, names, places, error, setError, version } = useHousehold(session, { optional: true });
  const [own, setOwn] = useState<OwnList[] | null>(null);
  const [ownEntries, setOwnEntries] = useState<ListEntry[]>([]);
  const [people, setPeople] = useState<ListPerson[]>([]);
  /** Names of people who own family lists in other homes (Dad's list, seen from Molly's flat). */
  const [ownerNames, setOwnerNames] = useState<Map<string, string>>(new Map());
  const [making, setMaking] = useState(false);
  // Arriving from the Christmas page: open a new list ready for the day.
  const asked = useQueryParam("new");
  const start = asked === "christmas" ? CHRISTMAS_START : null;
  const [opened, setOpened] = useState(false);
  useEffect(() => {
    if (start && ready && !opened) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOpened(true);
      setMaking(true);
    }
  }, [start, ready, opened]);
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
      const owners = mine.filter((l) => l.visibility === "family").map((l) => l.owner);
      if (owners.length > 0) setOwnerNames(await loadNames(owners).catch(() => new Map()));
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

  const cards: HouseholdCardData[] = [
    {
      href: "/presents/",
      title: "Present ideas",
      art: "/lists/present-ideas.webp",
      tint: "bg-rose",
      n: ideas,
      caption: ideas === null ? null : ideas === 0 ? "Start a wish list" : "Everyone's wish lists",
    },
    {
      href: "/books/",
      title: "Book wish lists",
      art: "/lists/book-wish-lists.webp",
      tint: "bg-honey",
      n: books,
      caption: books === null ? null : books === 0 ? "Start a reading list" : "What everyone wants to read next",
    },
    {
      href: "/lent/",
      title: "Lent out",
      art: "/lists/lent-out.webp",
      tint: "bg-slate",
      n: lent?.length ?? null,
      urgent: longLent > 0,
      caption:
        lent === null
          ? null
          : lent.length === 0
            ? "Nothing lent right now"
            : longLent > 0
              ? `${longLent} out for over a month`
              : `With ${shortNames([...new Set(lent.map((i) => i.lentTo ?? "").filter(Boolean))])}`,
    },
    {
      href: "/season/",
      title: `${seasonal.season} jobs`,
      art: "/lists/autumn-jobs.webp",
      tint: "bg-terracotta",
      n: jobs,
      caption: jobs === null ? null : jobs === 0 ? "All done for now" : seasonal.shown!.map((r) => r.title).join(", "),
    },
  ];

  const tab = own ? listsForTab(own, session.user.id, current?.householdId ?? null) : { mine: [], home: [], groups: [], family: [] };
  const toRow = (l: OwnList, privateList: boolean): ListRowData => {
    const { open, done } = splitEntries(ownEntries.filter((e) => e.listId === l.id));
    const ownerName = names.get(l.owner) ?? ownerNames.get(l.owner) ?? people.find((p) => p.listId === l.id && p.isOwner)?.name;
    const by = !privateList && l.owner !== session.user.id ? ownerName : null;
    return {
      href: `/my-list/?id=${l.id}`,
      Icon: KIND_ICON[l.kind] ?? IconList,
      tone: KIND_TONE[l.kind] ?? KIND_TONE.todo,
      title: l.title,
      n: open.length,
      caption: (by ? `${by}'s · ` : "") + listCaption(open.map((e) => e.text), done.length),
    };
  };
  const homeRows = tab.home.map((l) => toRow(l, false));
  const mineRows = tab.mine.map((l) => toRow(l, true));
  const groupRows = tab.groups.map((l) => {
    const row = toRow(l, false);
    const n = people.filter((p) => p.listId === l.id).length;
    return { ...row, Icon: IconPeople, tone: "bg-plum-bg text-plum", caption: `${n === 1 ? "Just you so far" : `${n} people`} · ${row.caption}` };
  });
  const familyFirstNames = members.filter((m) => m.role === "family").map((m) => m.displayName.trim().split(/\s+/)[0]!);
  const familyRows = tab.family.map((l) => {
    const row = toRow(l, false);
    // Lists from this home say which family can see them; a family list from another home says whose it is already.
    const withWho = l.householdId === current?.householdId && familyFirstNames.length > 0 ? `With ${shortNames(familyFirstNames)} · ` : "";
    return { ...row, Icon: IconGift, tone: "bg-rose text-forest", caption: withWho + row.caption };
  });
  // People who live here, and family with homes of their own, for the "who can see it" choices.
  const others = members.filter((m) => m.userId !== session.user.id && m.role !== "family").map((m) => m.displayName);
  const family = members.filter((m) => m.role === "family").map((m) => m.displayName);

  const anyOwn = homeRows.length + familyRows.length + groupRows.length + mineRows.length > 0;

  return (
    <AppShell cream>
      <header className="flex flex-col gap-0.5">
        <h1 className="font-serif text-[2.1rem] leading-[1.05] font-semibold tracking-[-0.015em] text-forest sm:text-[2.4rem]">Lists</h1>
        {current ? <p className="text-[14.5px] font-medium text-mute">{sentenceCase(current.name)}</p> : null}
      </header>
      {error ? <Notice>{error}</Notice> : null}
      {!ready || own === null ? (
        <HouseholdLoading />
      ) : (
        <>
          {current ? (
            <div className="-mt-1 flex flex-col gap-2.5">
              {/* From November to Boxing Day, Christmas leads; the rest of the year Shopping moves up. */}
              {isChristmasTime() ? <ChristmasFeature days={daysToChristmas()} /> : null}
              <ShoppingRow count={toBuy?.length ?? null} />
              <HouseholdCards cards={cards} label={`Everyone in ${current.name}`} />
            </div>
          ) : null}
          {anyOwn ? (
            <div className="-mt-1 flex flex-col gap-4">
              <h2 className="font-serif text-[1.45rem] leading-tight font-semibold tracking-[-0.01em] text-forest">Your lists</h2>
              {homeRows.length > 0 ? <ListSection id="homelists-h" label="Everyone at home" Icon={IconHouse} rows={homeRows} /> : null}
              {familyRows.length > 0 ? <ListSection id="family-h" label="With family" Icon={IconGift} rows={familyRows} /> : null}
              {groupRows.length > 0 ? <ListSection id="groups-h" label="Groups" Icon={IconPeople} rows={groupRows} /> : null}
              {mineRows.length > 0 ? <ListSection id="mine-h" label="Just you" Icon={IconLock} rows={mineRows} /> : null}
            </div>
          ) : null}
          <button
            onClick={() => setMaking(true)}
            className="flex min-h-14 items-center justify-center gap-2 rounded-2xl border-[1.5px] border-dashed border-line font-display text-[15px] font-bold text-leaf transition hover:bg-sunk/50"
          >
            <IconPlus className="size-[18px]" /> New list
          </button>
          {!anyOwn ? (
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
            family={family}
            start={start}
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
