"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { AuthGate } from "@/components/AuthGate";
import { AppShell, SectionLabel } from "@/components/AppShell";
import { HouseholdLoading, PageHeader } from "@/components/common/PageHeader";
import { useHousehold } from "@/lib/hooks/useHousehold";
import { supabase } from "@/lib/supabase/client";
import { friendlyError } from "@/lib/supabase/errors";
import { addIdea, addNamedList, claimIdea, ensureList, loadPresents, readLink, removeIdea, unclaimIdea, type Presents } from "@/lib/presents";
import { cleanLink, firstName, linkLabel, linkProblem, looksLikeLink, people, sortIdeas, wouldLove, wrapFor, type Person, type WishIdea } from "@/lib/domain/presents";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { Toast, type ToastData } from "@/components/ui/Toast";
import { IconGift, IconPlus, IconShare } from "@/components/ui/icons";
import { GiftBox, WrappedBand } from "@/components/presents/Gift";
import { IdeaRow } from "@/components/presents/IdeaRow";
import { IdeaSheet } from "@/components/presents/IdeaSheet";
import { ShareSheet } from "@/components/presents/ShareSheet";
import { NewListSheet } from "@/components/presents/NewListSheet";

export default function PresentsPage() {
  return <AuthGate>{(session) => <PresentIdeas session={session} />}</AuthGate>;
}

function PresentIdeas({ session }: { session: Session }) {
  const me = session.user.id;
  const { current, members, names, error, setError } = useHousehold(session);
  const [data, setData] = useState<Presents | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<WishIdea | null>(null);
  const [sharing, setSharing] = useState(false);
  const [naming, setNaming] = useState(false);
  const [toast, setToast] = useState<ToastData | null>(null);
  const say = (message: string, undo?: () => void) =>
    setToast((t) => ({ id: (t?.id ?? 0) + 1, message, actionLabel: undo ? "Undo" : undefined, onAction: undo }));

  const refresh = useCallback(async () => {
    if (!current) return;
    try {
      setData(await loadPresents(current.householdId));
    } catch (e) {
      setError(friendlyError(e));
    }
  }, [current, setError]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  // Pick up the person from the address (?for=), so Back and shared links land on the same list.
  useEffect(() => {
    const f = new URLSearchParams(window.location.search).get("for");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (f) setChosen(f);
  }, []);

  // Live: Michelle adds an idea, or someone says they're getting one.
  useEffect(() => {
    if (!current) return;
    const filter = `household_id=eq.${current.householdId}`;
    const channel = supabase()
      .channel(`presents:${current.householdId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "wish_lists", filter }, () => refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "wish_ideas", filter }, () => refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "wish_claims", filter }, () => refresh())
      .subscribe();
    return () => {
      supabase().removeChannel(channel);
    };
  }, [current, refresh]);

  const everyone = useMemo(() => (data ? people(members, data.lists, me) : []), [data, members, me]);
  const person: Person | undefined = everyone.find((p) => p.key === chosen) ?? everyone[0];
  const index = person ? everyone.indexOf(person) : 0;
  const wrap = wrapFor(index);
  const mine = person?.userId === me;
  const ideas = person?.list && data ? sortIdeas(data.ideas.filter((i) => i.listId === person.list!.id)) : [];
  const claimOf = (id: string) => data?.claims.find((c) => c.ideaId === id);
  const countFor = (p: Person) => (p.list && data ? data.ideas.filter((i) => i.listId === p.list!.id).length : 0);
  const who = (id: string | null) => (id === me ? "you" : (id && names.get(id)) || "Someone");

  function choose(key: string) {
    setChosen(key);
    setTitle("");
    const url = new URL(window.location.href);
    url.searchParams.set("for", key);
    window.history.replaceState(null, "", url);
  }

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

  async function listId(): Promise<string> {
    if (person!.list) return person!.list.id;
    return (await ensureList(current!.householdId, person!.userId!)).id;
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const t = title.trim();
    if (!t || !current || !person) return;
    if (looksLikeLink(t)) return addFromLink(t);
    await run("add", async () => {
      await addIdea(current.householdId, await listId(), { title: t, note: null, link: null, price: null, favourite: false });
      setTitle("");
    });
  }

  // A pasted shop link: read the page for its name, price and picture, then add it.
  async function addFromLink(raw: string) {
    const link = cleanLink(raw);
    if (!link || link === "bad") {
      setError(linkProblem("bad_link"));
      return;
    }
    await run("add", async () => {
      const id = await listId();
      const got = await readLink(current!.householdId, link);
      const shop = got.ok ? got.reading.shop : (got.shop ?? linkLabel(link));
      const r = got.ok ? got.reading : null;
      await addIdea(current!.householdId, id, {
        title: r?.title ?? `Something from ${shop}`,
        note: null,
        link,
        price: r?.price ?? null,
        favourite: false,
        imagePath: r?.imagePath ?? null,
      });
      setTitle("");
      if (!got.ok) say(linkProblem(got.code, shop));
      else if (!r!.title || r!.titleFromLink || !r!.price) say(`Added from ${shop}. Tap it to check the name and add a price.`);
      else say(`Added from ${shop}. Tap it to check the details.`);
    });
  }

  const claim = (idea: WishIdea) =>
    run(idea.id, async () => {
      await claimIdea(idea, current!.householdId);
      say(`You're getting ${idea.title}. ${firstName(person!.name)} won't see.`, () => run(idea.id, () => unclaimIdea(idea.id)));
    });

  const unclaim = (idea: WishIdea) => run(idea.id, () => unclaimIdea(idea.id));

  const remove = (idea: WishIdea) =>
    run(idea.id, async () => {
      await removeIdea(idea.id);
      setEditing(null);
      say(`Took ${idea.title} off the list`, () =>
        run(idea.id, () =>
          addIdea(current!.householdId, idea.listId, { title: idea.title, note: idea.note, link: idea.link, price: idea.price, favourite: idea.favourite, imagePath: idea.imagePath }),
        ),
      );
    });

  async function startShare() {
    if (!person) return;
    setError(null);
    try {
      if (!person.list) {
        await ensureList(current!.householdId, person.userId!);
        await refresh();
      }
      setSharing(true);
    } catch (e) {
      setError(friendlyError(e));
    }
  }

  const gettingCount = data ? data.claims.filter((c) => c.claimedBy === me).length : 0;

  return (
    <AppShell>
      <PageHeader
        title="Present ideas"
        back={{ href: "/lists/", label: "Lists" }}
        sub="Everyone's wish list in one place. Share one with family when they ask what to get."
      />

      {error ? <Notice>{error}</Notice> : null}

      {data === null || !current ? (
        <HouseholdLoading />
      ) : (
        <>
          <nav aria-label="Whose list" className="-mx-4 overflow-x-auto px-4 pt-3 pb-1 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0">
            <ul className="flex gap-3.5">
              {everyone.map((p, i) => {
                const on = p.key === person?.key;
                const n = countFor(p);
                return (
                  <li key={p.key} className="shrink-0">
                    <button
                      onClick={() => choose(p.key)}
                      aria-pressed={on}
                      className={`flex w-[92px] flex-col items-center gap-2 rounded-2xl pt-2.5 pb-2 transition ${on ? "bg-card shadow-[var(--shadow-lift)] ring-1 ring-line" : "opacity-85 hover:opacity-100"}`}
                    >
                      <GiftBox wrap={wrapFor(i)} className={`h-[58px] w-[64px] transition ${on ? "-translate-y-0.5" : ""}`}>
                        {n > 0 ? (
                          <span className="absolute right-1 bottom-1 grid h-5 min-w-5 place-items-center rounded-full bg-black/35 px-1 text-[11px] font-bold tabular-nums">
                            {n}
                          </span>
                        ) : null}
                      </GiftBox>
                      <span className={`max-w-full truncate px-1 font-display text-[13.5px] font-bold ${on ? "" : "text-mute"}`}>{p.userId === me ? "You" : firstName(p.name)}</span>
                    </button>
                  </li>
                );
              })}
              <li className="shrink-0">
                <button
                  onClick={() => setNaming(true)}
                  className="flex w-[92px] flex-col items-center gap-2 rounded-2xl pt-2.5 pb-2 text-mute hover:text-fg"
                >
                  <span className="grid h-[58px] w-[64px] place-items-center rounded-[14px] border-2 border-dashed border-line">
                    <IconPlus className="size-5" />
                  </span>
                  <span className="font-display text-[13.5px] font-bold whitespace-nowrap">Add a list</span>
                </button>
              </li>
            </ul>
          </nav>

          {person ? (
            <section aria-labelledby="list-h" className="flex flex-col gap-4">
              <WrappedBand wrap={wrap}>
                <p className="font-display text-[12.5px] font-bold tracking-[0.08em] uppercase opacity-80">
                  {mine ? "Your wish list" : `For ${firstName(person.name)}`}
                </p>
                <h2 id="list-h" className="mt-1 font-serif text-[2rem] leading-[1.05] font-semibold tracking-[-0.015em] sm:text-[2.4rem]">
                  {wouldLove(person.name, mine)}
                </h2>
                <p className="mt-2 max-w-[34ch] text-[14.5px] leading-snug opacity-85">
                  {mine
                    ? "Others can say they're getting something. You won't see what, so it stays a surprise."
                    : `Say you're getting something so nobody doubles up. ${firstName(person.name)} won't see.`}
                </p>
                <button
                  onClick={startShare}
                  className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-btn)] px-4 font-display text-[14.5px] font-bold shadow-[0_6px_16px_-10px_rgba(0,0,0,0.6)] transition active:scale-[0.98]"
                  style={{ background: wrap.ink, color: wrap.paper }}
                >
                  <IconShare className="size-[18px]" /> {person.list?.shareCode ? "Shared with family" : "Share with family"}
                </button>
              </WrappedBand>

              <form onSubmit={add} className="flex gap-2">
                <label htmlFor="idea-add" className="sr-only">
                  Add a present idea
                </label>
                <input
                  id="idea-add"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Add an idea or paste a link"
                  maxLength={120}
                  autoComplete="off"
                  enterKeyHint="done"
                  className="min-h-12 w-full min-w-0 flex-1 rounded-2xl border border-line bg-card px-4 text-base text-fg shadow-[inset_0_1px_2px_rgba(23,36,42,0.04)] placeholder:text-mute focus:border-leaf focus:ring-4 focus:ring-leaf/15 focus:outline-none"
                />
                <Button type="submit" busy={busy === "add"} disabled={!title.trim()} className="shrink-0 px-4">
                  <IconPlus className="size-[18px]" /> Add
                </Button>
              </form>
              {busy === "add" && looksLikeLink(title) ? (
                <p role="status" className="-mt-2 text-[14px] text-mute">
                  Reading the shop page for the name, price and picture…
                </p>
              ) : null}

              {ideas.length === 0 ? (
                <div className="flex items-center gap-3.5 rounded-[var(--radius-card)] border-2 border-dashed border-line bg-sunk/40 p-5">
                  <IconGift className="size-8 shrink-0" />
                  <p className="text-[15px] text-mute">
                    {mine
                      ? "Nothing on your list yet. Add things you'd love, then tap one to add a shop link, a rough price or a size."
                      : `${firstName(person.name)} hasn't added anything yet. You can add ideas for them too.`}
                  </p>
                </div>
              ) : (
                <>
                  <SectionLabel>
                    {ideas.length === 1 ? "1 idea" : `${ideas.length} ideas`}
                    {!mine && ideas.some((i) => claimOf(i.id)) ? (
                      <span className="font-semibold text-mute"> · {ideas.filter((i) => claimOf(i.id)).length} being got</span>
                    ) : null}
                  </SectionLabel>
                  <ul className="flex flex-col gap-2.5">
                    {ideas.map((i) => {
                      const c = mine ? undefined : claimOf(i.id);
                      return (
                        <IdeaRow
                          key={i.id}
                          idea={i}
                          wrap={wrap}
                          mine={mine}
                          busy={busy === i.id}
                          addedBy={i.addedBy && i.addedBy !== person.userId ? who(i.addedBy) : null}
                          claim={c ? { byMe: c.claimedBy === me, name: c.claimedName ?? who(c.claimedBy), fromLink: !c.claimedBy } : null}
                          onClaim={() => claim(i)}
                          onUnclaim={() => unclaim(i)}
                          onOpen={() => setEditing(i)}
                        />
                      );
                    })}
                  </ul>
                </>
              )}

              {gettingCount > 0 ? (
                <p className="text-[13.5px] text-mute">
                  You&apos;re getting {gettingCount === 1 ? "1 present" : `${gettingCount} presents`} across everyone&apos;s lists.
                </p>
              ) : null}
            </section>
          ) : null}
        </>
      )}

      <IdeaSheet
        idea={editing}
        mine={mine}
        personName={person?.name ?? ""}
        householdId={current?.householdId ?? ""}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          refresh();
        }}
        onRemove={remove}
      />
      {person?.list && current ? (
        <ShareSheet
          open={sharing}
          onClose={() => setSharing(false)}
          list={person.list}
          name={person.name}
          mine={mine}
          onChanged={refresh}
          onRemoved={
            person.userId
              ? undefined
              : () => {
                  setSharing(false);
                  setChosen(null);
                  refresh();
                }
          }
        />
      ) : null}
      {current ? (
        <NewListSheet
          open={naming}
          onClose={() => setNaming(false)}
          onAdd={async (name) => {
            const l = await addNamedList(current.householdId, name);
            await refresh();
            choose(l.id);
            setNaming(false);
          }}
        />
      ) : null}
      <Toast toast={toast} onDone={() => setToast(null)} />
    </AppShell>
  );
}
