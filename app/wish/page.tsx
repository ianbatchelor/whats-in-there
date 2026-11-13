"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { isConfigured } from "@/lib/config";
import { friendlyError } from "@/lib/supabase/errors";
import { firstName, linkLabel, wishCodeFrom, wrapFor } from "@/lib/domain/presents";
import { claimShared, loadShared, unclaimShared, wishPictureUrl, type SharedIdea, type SharedList } from "@/lib/presents";
import { SetupNeeded } from "@/components/SetupNeeded";
import { Splash } from "@/components/ui/Screen";
import { Notice } from "@/components/ui/Notice";
import { Button } from "@/components/ui/Button";
import { BrandMark, Wordmark } from "@/components/brand/BrandMark";
import { IconBook, IconCheck, IconGift, IconLink, IconStar } from "@/components/ui/icons";
import { Bow, paperStyle } from "@/components/presents/Gift";
import { BookCover, Ribbon, clothStyle } from "@/components/books/Book";
import { BOOK_LOOK } from "@/lib/domain/books";

const noopSubscribe = () => () => {};

// What this browser remembers: who you are, whether you're the person the list is for, and the
// secrets that let you take back your own "I'm getting this".
const store = {
  get(k: string): string | null {
    try {
      return localStorage.getItem(`wish:${k}`);
    } catch {
      return null;
    }
  },
  set(k: string, v: string | null) {
    try {
      if (v === null) localStorage.removeItem(`wish:${k}`);
      else localStorage.setItem(`wish:${k}`, v);
    } catch {
      // Private browsing: it just won't be remembered.
    }
  },
};

/**
 * The page family see from a shared link: https://seewhatsinhere.com/wish/?c=<code>.
 * No account needed. It asks first whether you're the person the list is for, so they don't
 * see what's being got for them.
 */
export default function SharedWishPage() {
  const code = useSyncExternalStore(
    noopSubscribe,
    () => wishCodeFrom(window.location.search),
    () => undefined,
  );
  const [list, setList] = useState<SharedList | null | undefined>(undefined);
  const [problem, setProblem] = useState<string | null>(null);
  const [role, setRole] = useState<"giver" | "owner" | null>(null);
  const [myName, setMyName] = useState("");
  const [asking, setAsking] = useState<SharedIdea | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tokens, setTokens] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!code) return;
    try {
      setList(await loadShared(code));
    } catch (e) {
      setProblem(friendlyError(e));
    }
  }, [code]);

  useEffect(() => {
    if (!code) return;
    /* eslint-disable react-hooks/set-state-in-effect */
    setRole((store.get(`${code}:role`) as "giver" | "owner" | null) ?? null);
    setMyName(store.get("name") ?? "");
    try {
      setTokens(JSON.parse(store.get(`${code}:tokens`) ?? "{}"));
    } catch {
      setTokens({});
    }
    /* eslint-enable react-hooks/set-state-in-effect */
    load();
  }, [code, load]);

  function choose(r: "giver" | "owner") {
    setRole(r);
    if (code) store.set(`${code}:role`, r);
  }

  function keepToken(id: string, token: string | null) {
    setTokens((t) => {
      const next = { ...t };
      if (token) next[id] = token;
      else delete next[id];
      if (code) store.set(`${code}:tokens`, JSON.stringify(next));
      return next;
    });
  }

  async function claim(idea: SharedIdea, name: string) {
    if (!code || !name.trim()) return;
    setBusy(idea.id);
    setError(null);
    try {
      const token = await claimShared(code, idea.id, name);
      store.set("name", name.trim());
      keepToken(idea.id, token);
      setAsking(null);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(null);
      load();
    }
  }

  async function unclaim(idea: SharedIdea) {
    if (!code || !tokens[idea.id]) return;
    setBusy(idea.id);
    setError(null);
    try {
      await unclaimShared(code, idea.id, tokens[idea.id]!);
      keepToken(idea.id, null);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(null);
      load();
    }
  }

  if (!isConfigured) return <SetupNeeded />;
  if (code === undefined || (code && list === undefined && !problem)) return <Splash />;

  const books = list?.kind === "books";
  const gift = wrapFor(0);
  // Book lists wear navy cloth with a red ribbon; present lists stay gift-wrapped.
  const wrap = books ? { paper: BOOK_LOOK.ribbon, ink: "#ffffff", ribbon: BOOK_LOOK.ribbon, soft: BOOK_LOOK.soft } : gift;
  const getting = books ? "I'll get this" : "I'm getting this";
  const first = list ? firstName(list.name) : "";
  const ideas = list?.ideas ?? [];
  const free = ideas.filter((i) => !i.taken).length;

  return (
    <div className="min-h-dvh bg-bg">
      <header className="relative isolate overflow-hidden pb-14" style={books ? clothStyle() : paperStyle(gift)}>
        {books ? (
          <Ribbon className="right-[14%] h-[70%] -z-10 w-5" />
        ) : (
          <>
            <span aria-hidden="true" className="absolute inset-y-0 right-[16%] -z-10 w-6" style={{ background: gift.ribbon, boxShadow: "inset 2px 0 0 rgba(255,255,255,0.25), inset -2px 0 0 rgba(0,0,0,0.12)" }} />
            <Bow color={gift.ribbon} className="absolute top-[max(8px,env(safe-area-inset-top))] right-[calc(16%-40px)] -z-10 w-[104px] drop-shadow-[0_3px_3px_rgba(0,0,0,0.3)]" />
          </>
        )}
        <div className="mx-auto max-w-2xl px-5 pt-[max(22px,env(safe-area-inset-top))]">
          <Link href="/" className="flex w-fit items-center gap-2 opacity-90">
            <BrandMark size={26} className="ring-1 ring-white/20" />
            <Wordmark serif className="text-[0.95rem]" />
          </Link>
          <p className="mt-10 font-display text-[12.5px] font-bold tracking-[0.1em] uppercase opacity-80">{books ? "Book wish list" : "Present ideas"}</p>
          <h1 className="mt-1 max-w-[16ch] font-serif text-[2.6rem] leading-[1] font-semibold tracking-[-0.02em] sm:text-[3.2rem]">
            {list ? (books ? `${first} wants to read…` : `${first} would love…`) : "Present ideas"}
          </h1>
        </div>
      </header>

      <main className="relative mx-auto -mt-8 flex max-w-2xl flex-col gap-4 px-4 pb-[max(32px,env(safe-area-inset-bottom))] sm:px-5">
        {problem ? (
          <div className="rounded-[var(--radius-card)] border border-line bg-card p-5 shadow-[var(--shadow-card)]">
            <Notice>{problem}</Notice>
          </div>
        ) : !code || list === null ? (
          <div className="flex flex-col gap-2 rounded-[var(--radius-card)] border border-line bg-card p-6 shadow-[var(--shadow-card)]">
            <h2 className="font-display text-xl font-bold">This list isn&apos;t shared any more</h2>
            <p className="text-mute">The link may have been switched off. Ask whoever sent it for a new one.</p>
          </div>
        ) : role === null ? (
          <div className="rise flex flex-col gap-4 rounded-[var(--radius-card)] border border-line bg-card p-6 shadow-[var(--shadow-lift)]">
            {books ? (
              <span style={{ color: BOOK_LOOK.cloth }}>
                <IconBook className="size-8" />
              </span>
            ) : <IconGift className="size-8 text-[#8f2d2d]" />}
            <h2 className="font-serif text-[1.7rem] leading-tight font-semibold">Before you peek…</h2>
            <p className="text-[15.5px] text-mute">
              This page shows which {books ? "books" : "presents"} people are already getting for {first}. So that {first} doesn&apos;t spoil the surprise, which are you?
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button onClick={() => choose("giver")} className="sm:flex-1" style={{ background: wrap.paper, color: wrap.ink }}>
                I&apos;m buying for {first}
              </Button>
              <Button variant="ghost" onClick={() => choose("owner")} className="sm:flex-1">
                I&apos;m {first}
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="rounded-[var(--radius-card)] border border-line bg-card px-5 py-4 text-[15px] shadow-[var(--shadow-card)]">
              {role === "owner" ? (
                <p className="text-mute">
                  This is your list as {books ? "friends" : "family"} see it. What&apos;s being got stays hidden.{" "}
                  <button onClick={() => choose("giver")} className="font-semibold text-fg underline decoration-line underline-offset-4">
                    Not {first}?
                  </button>
                </p>
              ) : (
                <p className="text-mute">
                  Tap <b className="text-fg">{getting}</b> on the one you choose, so nobody buys the same {books ? "book" : "thing"} twice. {first} won&apos;t see.{" "}
                  {ideas.length > 0 ? <span className="whitespace-nowrap">{free === 0 ? "Everything's taken." : `${free} still free.`}</span> : null}
                </p>
              )}
            </div>

            {error ? <Notice>{error}</Notice> : null}

            {ideas.length === 0 ? (
              <p className="rounded-[var(--radius-card)] border-2 border-dashed border-line p-6 text-center text-mute">Nothing on the list yet. Check back soon.</p>
            ) : (
              <ul className="flex flex-col gap-2.5">
                {ideas.map((i) => {
                  const giver = role === "giver";
                  const mineClaim = !!tokens[i.id] && i.taken;
                  const takenShown = giver && i.taken;
                  return (
                    <li
                      key={i.id}
                      className={`rise flex overflow-hidden rounded-[var(--radius-card)] border border-line bg-card shadow-[var(--shadow-card)] ${takenShown && !mineClaim ? "opacity-70" : ""}`}
                    >
                      {books ? (
                        <span className="my-3.5 ml-3.5 self-start">
                          <BookCover title={i.title} author={i.author ?? null} coverId={i.coverId ?? null} className="w-[60px] text-[10px]" />
                        </span>
                      ) : (
                        <span aria-hidden="true" className="relative w-3.5 shrink-0" style={{ background: wrap.paper }}>
                          <span className="absolute top-4 left-1/2 size-[7px] -translate-x-1/2 rounded-full bg-card ring-1 ring-black/10" />
                        </span>
                      )}
                      {i.imagePath && !books ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={wishPictureUrl(i.imagePath)} alt="" loading="lazy" className="my-3.5 ml-3.5 size-20 shrink-0 rounded-xl bg-white object-contain ring-1 ring-line" />
                      ) : null}
                      <div className="flex min-w-0 flex-1 flex-col gap-1 py-3.5 pr-3 pl-3.5">
                        <p className="flex items-start gap-1.5">
                          {i.favourite ? <IconStar className="mt-[3px] size-4 shrink-0 fill-[#e9b949]! stroke-[#c8962a]!" /> : null}
                          <span className={`font-semibold leading-snug ${takenShown && !mineClaim ? "line-through decoration-mute/50" : ""}`}>{i.title}</span>
                        </p>
                        {books && i.author ? <p className="text-[14px] leading-snug text-mute">{i.author}</p> : null}
                        {i.note ? <p className="text-[14px] leading-snug text-mute">{i.note}</p> : null}
                        {i.price || i.link ? (
                          <p className="flex flex-wrap items-center gap-1.5 pt-0.5 text-[12.5px]">
                            {i.price ? (
                              <span className="rounded-full px-2 py-0.5 font-semibold" style={{ background: wrap.soft, color: wrap.paper }}>
                                {i.price}
                              </span>
                            ) : null}
                            {i.link ? (
                              <a
                                href={i.link}
                                target="_blank"
                                rel="noopener noreferrer nofollow"
                                className="inline-flex min-h-8 min-w-0 items-center gap-1 rounded-full bg-sunk px-2.5 font-semibold text-leaf"
                              >
                                <IconLink className="size-3.5 shrink-0" />
                                <span className="truncate">See it at {linkLabel(i.link)}</span>
                              </a>
                            ) : null}
                          </p>
                        ) : null}
                        {giver ? (
                          i.taken ? (
                            <div className="flex flex-wrap items-center gap-x-3 pt-1">
                              <span className="flex items-center gap-1.5 text-[13.5px] font-semibold text-ok">
                                <span className="grid size-[18px] place-items-center rounded-full bg-ok-bg">
                                  <IconCheck className="size-3" />
                                </span>
                                {mineClaim ? "You're getting this" : `${i.takenBy ?? "Someone"} is getting this`}
                              </span>
                              {mineClaim ? (
                                <button onClick={() => unclaim(i)} disabled={busy !== null} className="min-h-10 text-[13.5px] font-semibold text-mute hover:text-fg">
                                  Undo
                                </button>
                              ) : null}
                            </div>
                          ) : asking?.id === i.id ? (
                            <NameForm
                              initial={myName}
                              busy={busy === i.id}
                              onCancel={() => setAsking(null)}
                              onSubmit={(n) => claim(i, n)}
                              style={{ background: wrap.paper, color: wrap.ink }}
                            />
                          ) : (
                            <div className="pt-1.5">
                              <button
                                onClick={() => (myName ? claim(i, myName) : setAsking(i))}
                                disabled={busy !== null}
                                className="min-h-10 rounded-xl px-3.5 font-display text-[14px] font-bold transition active:scale-[0.97] disabled:opacity-55"
                                style={{ background: wrap.paper, color: wrap.ink }}
                              >
                                {getting}
                              </button>
                              {myName ? (
                                <button onClick={() => setAsking(i)} className="ml-3 min-h-10 text-[13px] text-mute hover:text-fg">
                                  as {myName}
                                </button>
                              ) : null}
                            </div>
                          )
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            <p className="pt-2 text-center text-[13px] text-mute">
              Made with{" "}
              <Link href="/" className="font-semibold text-fg">
                See What&apos;s in Here
              </Link>
              , the app for keeping track of what you have at home.
            </p>
          </>
        )}
      </main>
    </div>
  );
}

function NameForm({
  initial,
  busy,
  onSubmit,
  onCancel,
  style,
}: {
  initial: string;
  busy: boolean;
  onSubmit: (name: string) => void;
  onCancel: () => void;
  style: React.CSSProperties;
}) {
  const [name, setName] = useState(initial);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(name);
      }}
      className="flex flex-col gap-2 pt-2"
    >
      <label htmlFor="giver-name" className="text-[13.5px] font-semibold">
        Your first name, so the family know who&apos;s getting it
      </label>
      <div className="flex gap-2">
        <input
          id="giver-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={40}
          autoFocus
          autoComplete="given-name"
          placeholder="Sue"
          className="min-h-11 w-full min-w-0 flex-1 rounded-xl border border-line bg-card px-3.5 text-base focus:border-leaf focus:ring-4 focus:ring-leaf/15 focus:outline-none"
        />
        <Button type="submit" busy={busy} disabled={!name.trim()} className="min-h-11 shrink-0 px-4" style={style}>
          Done
        </Button>
      </div>
      <button type="button" onClick={onCancel} className="min-h-9 self-start text-[13px] text-mute">
        Cancel
      </button>
    </form>
  );
}
