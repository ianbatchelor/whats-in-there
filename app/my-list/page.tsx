"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import { AuthGate } from "@/components/AuthGate";
import { AppShell, SectionLabel } from "@/components/AppShell";
import { HouseholdLoading, PageHeader } from "@/components/common/PageHeader";
import { ListSettingsSheet } from "@/components/lists/ListSettingsSheet";
import { useHousehold } from "@/lib/hooks/useHousehold";
import { useQueryParam } from "@/lib/hooks/useQueryParam";
import { supabase } from "@/lib/supabase/client";
import { friendlyError } from "@/lib/supabase/errors";
import { addEntry, deleteList, loadEntries, loadList, loadPeople, removeEntries, setDone, updateList } from "@/lib/ownLists";
import { GroupSheet } from "@/components/lists/GroupSheet";
import { groupNames, kindInfo, splitEntries, visibilityLine, type ListEntry, type ListPerson, type OwnList } from "@/lib/domain/ownLists";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { Toast, type ToastData } from "@/components/ui/Toast";
import { IconCheck, IconGift, IconHouse, IconLink, IconLock, IconPeople, IconPlus, IconX } from "@/components/ui/icons";
import { loadMembers } from "@/lib/household";

export default function MyListPage() {
  return <AuthGate>{(session) => <MyList session={session} />}</AuthGate>;
}

function MyList({ session }: { session: Session }) {
  const router = useRouter();
  const id = useQueryParam("id");
  const { current, members, names, error, setError } = useHousehold(session, { optional: true });
  // undefined while loading; null when it doesn't exist or isn't shared with you.
  const [list, setList] = useState<OwnList | null | undefined>(undefined);
  const [entries, setEntries] = useState<ListEntry[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [settings, setSettings] = useState(false);
  const [people, setPeople] = useState<ListPerson[]>([]);
  const [group, setGroup] = useState(false);
  /** A family list from a home you don't live in (Dad's, seen by his daughter): its name and people. */
  const [away, setAway] = useState<{ name: string | null; names: Map<string, string> } | null>(null);
  const [toast, setToast] = useState<ToastData | null>(null);
  const say = (message: string, undo?: () => void) =>
    setToast((t) => ({
      id: (t?.id ?? 0) + 1,
      message,
      actionLabel: undo ? "Undo" : undefined,
      onAction: undo,
    }));

  const refresh = useCallback(async () => {
    if (!id) return;
    try {
      const l = await loadList(id);
      setList(l);
      setEntries(l ? await loadEntries([l.id]) : []);
      setPeople(l?.visibility === "group" ? (await loadPeople()).filter((p) => p.listId === l.id) : []);
    } catch (e) {
      setError(friendlyError(e));
    }
  }, [id, setError]);

  useEffect(() => {
    if (id === null) router.replace("/lists/");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    else refresh();
  }, [id, refresh, router]);

  // Someone else at home ticks something off, or the owner changes who can see it: see it straight away.
  useEffect(() => {
    if (!id) return;
    const channel = supabase()
      .channel(`own-list:${id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "list_entries",
          filter: `list_id=eq.${id}`,
        },
        () => refresh(),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "lists", filter: `id=eq.${id}` }, () => refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "list_members", filter: `list_id=eq.${id}` }, () => refresh())
      .subscribe();
    return () => {
      supabase().removeChannel(channel);
    };
  }, [id, refresh]);

  async function run(key: string, work: () => Promise<void>) {
    setError(null);
    setBusy(key);
    try {
      await work();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(null);
      refresh();
    }
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const t = text.trim();
    if (!t || !list) return;
    await run("add", async () => {
      await addEntry(list.id, t);
      setText("");
    });
  }

  const info = list ? kindInfo(list.kind) : null;
  const tick = (entry: ListEntry, done: boolean) =>
    run(entry.id, async () => {
      await setDone(entry.id, done);
      if (done) say(`${info?.doneLabel ?? "Done"}: ${entry.text}`, () => run(entry.id, () => setDone(entry.id, false)));
    });

  const remove = (entry: ListEntry) =>
    run(entry.id, async () => {
      await removeEntries([entry.id]);
      say(`Took ${entry.text} off the list`, () => run(entry.id, () => addEntry(entry.listId, entry.text, entry.note, entry.doneAt)));
    });

  const clearDone = (done: ListEntry[]) =>
    run("clear", async () => {
      await removeEntries(done.map((d) => d.id));
      say(done.length === 1 ? "Cleared 1 thing" : `Cleared ${done.length} things`);
    });

  // A family list belongs to a home that may not be yours: show its name and its people's names.
  const awayHousehold = list?.visibility === "family" && list.householdId && list.householdId !== current?.householdId ? list.householdId : null;
  useEffect(() => {
    if (!awayHousehold) return;
    let live = true;
    Promise.all([
      supabase().from("households").select("name").eq("id", awayHousehold).maybeSingle(),
      loadMembers(awayHousehold).catch(() => []),
    ]).then(([h, m]) => {
      if (live) setAway({ name: (h.data?.name as string | undefined) ?? null, names: new Map(m.map((x) => [x.userId, x.displayName])) });
    });
    return () => {
      live = false;
    };
  }, [awayHousehold]);

  const isOwner = list?.owner === session.user.id;
  const isGroup = list?.visibility === "group";
  const isFamily = list?.visibility === "family";
  const shared = list?.visibility === "household" || isGroup || isFamily;
  const groupName = (uid: string) => people.find((p) => p.userId === uid)?.name;
  const who = (uid: string | null) =>
    uid === session.user.id ? "you" : (uid && (groupName(uid) ?? names.get(uid) ?? (awayHousehold ? away?.names.get(uid) : undefined))) || null;
  const others = members.filter((m) => m.userId !== session.user.id && m.role !== "family").map((m) => m.displayName);
  const family = members.filter((m) => m.role === "family").map((m) => m.displayName);
  const { open, done } = splitEntries(entries);

  if (list === null) {
    return (
      <AppShell>
        <PageHeader title="List not found" back={{ href: "/lists/", label: "Lists" }} />
        <Notice tone="info">This list has been deleted, or it isn&apos;t shared with you any more.</Notice>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader
        title={list?.title ?? "List"}
        back={{ href: "/lists/", label: "Lists" }}
        sub={
          list ? (
            <span>
              {isGroup ? (
                <IconPeople className="mr-1.5 inline size-4 -translate-y-px align-middle text-plum" />
              ) : isFamily ? (
                <IconGift className="mr-1.5 inline size-4 -translate-y-px align-middle text-leaf" />
              ) : shared ? (
                <IconHouse className="mr-1.5 inline size-4 -translate-y-px align-middle text-leaf" />
              ) : (
                <IconLock className="mr-1.5 inline size-4 -translate-y-px align-middle text-leaf" />
              )}
              {visibilityLine(list.visibility, awayHousehold ? (away?.name ?? null) : (current?.name ?? null), isOwner, who(list.owner))}
              {isOwner ? (
                <>
                  {" "}
                  <button onClick={() => setSettings(true)} className="font-semibold text-leaf underline-offset-2 hover:underline">
                    Change
                  </button>
                </>
              ) : null}
            </span>
          ) : undefined
        }
      />

      {list && isGroup ? (
        <div className="flex flex-col gap-3 rounded-[18px] bg-plum px-4 py-4 text-white dark:text-[#1d1424]">
          <button onClick={() => setGroup(true)} className="flex items-center gap-2.5 text-left">
            <span className="flex shrink-0 -space-x-2" aria-hidden="true">
              {people.slice(0, 5).map((p) => (
                <span
                  key={p.userId}
                  className="grid size-8 place-items-center rounded-full border-2 border-plum bg-plum-bg font-display text-[13px] font-bold text-plum"
                >
                  {p.name.trim().charAt(0).toUpperCase() || "?"}
                </span>
              ))}
            </span>
            <span className="min-w-0 text-[15px] leading-snug font-medium">{groupNames(people, session.user.id)}</span>
          </button>
          {isOwner ? (
            <button
              onClick={() => setGroup(true)}
              className="flex min-h-11 items-center gap-2 self-start rounded-xl bg-white px-3.5 font-display text-[15px] font-bold text-plum dark:bg-[#1d1424]"
            >
              <IconLink className="size-[18px]" /> Invite with a link
            </button>
          ) : (
            <button onClick={() => setGroup(true)} className="self-start text-[14px] font-semibold underline underline-offset-2">
              See who&apos;s in the group
            </button>
          )}
        </div>
      ) : null}

      <form onSubmit={add} className="flex gap-2">
        <label htmlFor="own-add" className="sr-only">
          {info?.placeholder ?? "Add something"}
        </label>
        <input
          id="own-add"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={info?.placeholder ?? "Add something"}
          maxLength={200}
          autoComplete="off"
          enterKeyHint="done"
          disabled={!list}
          className="min-h-12 w-full min-w-0 flex-1 rounded-2xl border border-line bg-card px-4 text-base text-fg shadow-[inset_0_1px_2px_rgba(23,36,42,0.04)] placeholder:text-mute focus:border-leaf focus:ring-4 focus:ring-leaf/15 focus:outline-none"
        />
        <Button type="submit" busy={busy === "add"} disabled={!text.trim() || !list} className="shrink-0 px-4">
          <IconPlus className="size-[18px]" /> Add
        </Button>
      </form>

      {error ? <Notice>{error}</Notice> : null}

      {list === undefined ? (
        <HouseholdLoading />
      ) : (
        <>
          {open.length === 0 ? (
            <div className="flex items-center gap-3.5 rounded-[var(--radius-card)] border-2 border-dashed border-line bg-sunk/40 p-5">
              <IconCheck className="size-8 shrink-0 text-leaf" />
              <p className="text-[15px] text-mute">{done.length > 0 ? "All done. " : "Nothing on it yet. "}Type above to add something.</p>
            </div>
          ) : (
            <ul className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-card shadow-[var(--shadow-card)]">
              {open.map((e) => (
                <Row key={e.id} entry={e} by={shared ? who(e.addedBy) : null} busy={busy === e.id} onTick={tick} onRemove={remove} />
              ))}
            </ul>
          )}

          {done.length > 0 ? (
            <section aria-labelledby="done-h" className="flex flex-col gap-2.5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <SectionLabel id="done-h">
                  {info?.doneLabel ?? "Done"} <span className="font-semibold text-mute">· {done.length}</span>
                </SectionLabel>
                <button
                  onClick={() => clearDone(done)}
                  disabled={busy !== null}
                  className="min-h-10 text-[14px] font-semibold text-mute hover:text-fg"
                >
                  Clear
                </button>
              </div>
              <ul className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-card shadow-[var(--shadow-card)]">
                {done.map((e) => (
                  <Row
                    key={e.id}
                    entry={e}
                    by={shared ? who(e.doneBy) : null}
                    doneLabel={info?.doneLabel}
                    busy={busy === e.id}
                    onTick={tick}
                    onRemove={remove}
                  />
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}

      {list && isGroup ? (
        <GroupSheet
          open={group}
          onClose={() => setGroup(false)}
          list={list}
          people={people}
          me={session.user.id}
          onChanged={refresh}
          onLeft={() => router.replace("/lists/")}
        />
      ) : null}
      {list && isOwner ? (
        <ListSettingsSheet
          open={settings}
          onClose={() => setSettings(false)}
          householdId={current?.householdId ?? null}
          householdName={current?.name ?? null}
          others={others}
          family={family}
          list={list}
          onSave={async (s) => {
            await updateList(list.id, s);
            setSettings(false);
            say(
              s.visibility === "me"
                ? "Saved. Only you can see it."
                : s.visibility === "group"
                  ? "Saved. Now invite people with a link."
                  : s.visibility === "family"
                    ? "Saved. Shared with everyone at home and family."
                    : `Saved. Shared with everyone in ${current?.name ?? "your household"}.`,
            );
            await refresh();
            if (s.visibility === "group" && list.visibility !== "group") setGroup(true);
          }}
          onDelete={async () => {
            await deleteList(list.id);
            router.replace("/lists/");
          }}
        />
      ) : null}
      <Toast toast={toast} onDone={() => setToast(null)} />
    </AppShell>
  );
}

function Row({
  entry,
  by,
  doneLabel,
  busy,
  onTick,
  onRemove,
}: {
  entry: ListEntry;
  /** Who added it (or ticked it off), shown on shared lists. */
  by: string | null;
  doneLabel?: string;
  busy: boolean;
  onTick: (entry: ListEntry, done: boolean) => void;
  onRemove: (entry: ListEntry) => void;
}) {
  const done = !!entry.doneAt;
  const caption = done ? (by ? `${doneLabel ?? "Done"} by ${by}` : null) : by ? `added by ${by}` : null;
  return (
    <li className="flex items-center gap-3 border-b border-line py-2 pr-2 pl-3 last:border-b-0" aria-busy={busy || undefined}>
      <button
        onClick={() => onTick(entry, !done)}
        disabled={busy}
        aria-pressed={done}
        aria-label={done ? `${entry.text}, done. Put it back on the list` : `Tick off ${entry.text}`}
        className="grid size-11 shrink-0 place-items-center"
      >
        <span
          className={`grid size-7 place-items-center rounded-lg border-2 transition ${done ? "border-go bg-go text-on-go" : "border-line text-transparent hover:border-leaf"}`}
        >
          <IconCheck className="size-4" />
        </span>
      </button>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5 py-1">
        <p className={`font-medium break-words ${done ? "text-mute line-through decoration-mute/60" : ""}`}>{entry.text}</p>
        {entry.note ? <p className="text-[13.5px] text-mute">{entry.note}</p> : null}
        {caption ? <p className="text-[13px] text-mute">{caption}</p> : null}
      </div>
      <button
        onClick={() => onRemove(entry)}
        disabled={busy}
        aria-label={`Take ${entry.text} off the list`}
        className="grid size-11 shrink-0 place-items-center rounded-xl text-mute hover:bg-sunk hover:text-fg"
      >
        <IconX className="size-[18px]" />
      </button>
    </li>
  );
}
