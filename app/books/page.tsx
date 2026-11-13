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
import { cleanLink, firstName, linkLabel, linkProblem, people, type Person, type WishIdea } from "@/lib/domain/presents";
import { BOOK_LOOK, BOOK_SORTS, findOwned, matchKey, sortBooks, wantsToRead, type BookSort } from "@/lib/domain/books";
import { loadOwnedNames, lookUpIsbn, readBarcode, type FoundBook, type OwnedBook } from "@/lib/books";
import { loadPlaces, type Place } from "@/lib/household";
import { addItem, undo } from "@/lib/stock";
import { Notice } from "@/components/ui/Notice";
import { Toast, type ToastData } from "@/components/ui/Toast";
import { IconBook, IconPlus, IconShare } from "@/components/ui/icons";
import { BookStack, ClothBand } from "@/components/books/Book";
import { BookRow } from "@/components/books/BookRow";
import { BookAdd } from "@/components/books/BookAdd";
import { ShelfSheet } from "@/components/books/ShelfSheet";
import { IdeaSheet } from "@/components/presents/IdeaSheet";
import { ShareSheet } from "@/components/presents/ShareSheet";
import { NewListSheet } from "@/components/presents/NewListSheet";

const SORT_KEY = "books:sort";

export default function BooksPage() {
  return <AuthGate>{(session) => <BookWishLists session={session} />}</AuthGate>;
}

function BookWishLists({ session }: { session: Session }) {
  const me = session.user.id;
  const { current, members, names, error, setError } = useHousehold(session);
  const [data, setData] = useState<Presents | null>(null);
  const [owned, setOwned] = useState<OwnedBook[]>([]);
  const [places, setPlaces] = useState<Place[]>([]);
  const [chosen, setChosen] = useState<string | null>(null);
  const [sort, setSort] = useState<BookSort>("wanted");
  const [busy, setBusy] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [editing, setEditing] = useState<WishIdea | null>(null);
  const [shelving, setShelving] = useState<WishIdea | null>(null);
  const [sharing, setSharing] = useState(false);
  const [naming, setNaming] = useState(false);
  const [toast, setToast] = useState<ToastData | null>(null);
  const say = (message: string, undoIt?: () => void) =>
    setToast((t) => ({ id: (t?.id ?? 0) + 1, message, actionLabel: undoIt ? "Undo" : undefined, onAction: undoIt }));

  const refresh = useCallback(async () => {
    if (!current) return;
    try {
      setData(await loadPresents(current.householdId, "books"));
    } catch (e) {
      setError(friendlyError(e));
    }
  }, [current, setError]);

  // What's already on the shelves, to spot books you have. Not needed to show the list.
  const refreshShelves = useCallback(async () => {
    if (!current) return;
    const [o, p] = await Promise.all([loadOwnedNames(current.householdId).catch(() => []), loadPlaces(current.householdId).catch(() => [])]);
    setOwned(o);
    setPlaces(p);
  }, [current]);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    refresh();
    refreshShelves();
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [refresh, refreshShelves]);

  useEffect(() => {
    const f = new URLSearchParams(window.location.search).get("for");
    let s: string | null = null;
    try {
      s = localStorage.getItem(SORT_KEY);
    } catch {
      /* private browsing */
    }
    /* eslint-disable react-hooks/set-state-in-effect */
    if (f) setChosen(f);
    if (s && BOOK_SORTS.some((x) => x.key === s)) setSort(s as BookSort);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  // Live: Michelle adds a book, or someone says they'll get one.
  useEffect(() => {
    if (!current) return;
    const filter = `household_id=eq.${current.householdId}`;
    const channel = supabase()
      .channel(`books:${current.householdId}`)
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
  const mine = person?.userId === me;
  const books = person?.list && data ? sortBooks(data.ideas.filter((i) => i.listId === person.list!.id), sort) : [];
  const claimOf = (id: string) => data?.claims.find((c) => c.ideaId === id);
  const countFor = (p: Person) => (p.list && data ? data.ideas.filter((i) => i.listId === p.list!.id).length : 0);
  const who = (id: string | null) => (id === me ? "you" : (id && names.get(id)) || "Someone");
  const placeName = useMemo(() => new Map(places.map((p) => [p.id, p.name])), [places]);
  const ownedIn = (title: string) => {
    const o = findOwned(title, owned);
    return o ? (placeName.get(o.locationId) ?? "your home") : null;
  };
  // Who else in the house wants the same book.
  const alsoWanted = (book: WishIdea) => {
    if (!data) return [];
    const key = matchKey(book.title);
    const listIds = new Set(data.ideas.filter((i) => i.listId !== book.listId && matchKey(i.title) === key).map((i) => i.listId));
    return everyone.filter((p) => p.list && listIds.has(p.list.id)).map((p) => (p.userId === me ? "You" : firstName(p.name)));
  };

  function choose(key: string) {
    setChosen(key);
    setStatus(null);
    const url = new URL(window.location.href);
    url.searchParams.set("for", key);
    window.history.replaceState(null, "", url);
  }

  function sortBy(s: BookSort) {
    setSort(s);
    try {
      localStorage.setItem(SORT_KEY, s);
    } catch {
      /* private browsing: not remembered */
    }
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
    return (await ensureList(current!.householdId, person!.userId!, "books")).id;
  }

  const forWhom = () => (mine ? "your list" : `${firstName(person!.name)}'s list`);

  async function addFound(b: FoundBook) {
    await run(`add:${b.title}`, async () => {
      await addIdea(current!.householdId, await listId(), { title: b.title, author: b.author, coverId: b.coverId, isbn: b.isbn, note: null, link: null, price: null, favourite: false });
      setStatus(null);
      const where = ownedIn(b.title);
      say(where ? `Added ${b.title}. You already have it in ${where}.` : `Added ${b.title} to ${forWhom()}`);
    });
  }

  const addTyped = (title: string) =>
    run("add", async () => {
      await addIdea(current!.householdId, await listId(), { title: title.slice(0, 120), note: null, link: null, price: null, favourite: false });
      setStatus(null);
    });

  // A pasted shop link: the same reader as present ideas fills in the name and picture.
  async function addFromLink(raw: string) {
    const link = cleanLink(raw);
    if (!link || link === "bad") {
      setError(linkProblem("bad_link"));
      return;
    }
    setStatus("Reading the shop page for the title and picture…");
    await run("add", async () => {
      const id = await listId();
      const got = await readLink(current!.householdId, link);
      const shop = got.ok ? got.reading.shop : (got.shop ?? linkLabel(link));
      const r = got.ok ? got.reading : null;
      await addIdea(current!.householdId, id, {
        title: r?.title ?? `A book from ${shop}`,
        note: null,
        link,
        price: r?.price ?? null,
        favourite: false,
        imagePath: r?.imagePath ?? null,
      });
      setStatus(null);
      say(got.ok ? `Added from ${shop}. Tap it to tidy the title and add the author.` : linkProblem(got.code, shop));
    });
    setStatus(null);
  }

  // A photo of the back of a book: read the barcode on the phone, then ask the library catalogue.
  async function scan(photo: File) {
    setError(null);
    setStatus("Reading the barcode…");
    setBusy("scan");
    try {
      const isbn = await readBarcode(photo);
      if (!isbn) {
        setStatus("Couldn't read a book barcode in that photo. Try again closer up and in good light, or type the title.");
        return;
      }
      setStatus("Looking the book up…");
      const book = await lookUpIsbn(isbn).catch(() => null);
      if (!book) {
        setStatus(`The library catalogue doesn't know ISBN ${isbn}. Type the title instead.`);
        return;
      }
      setBusy(null);
      await addFound(book);
    } catch (e) {
      setStatus(null);
      setError(friendlyError(e));
    } finally {
      setBusy(null);
    }
  }

  const claim = (book: WishIdea) =>
    run(book.id, async () => {
      await claimIdea(book, current!.householdId);
      say(`You're getting ${book.title}. ${firstName(person!.name)} won't see.`, () => run(book.id, () => unclaimIdea(book.id)));
    });

  const unclaim = (book: WishIdea) => run(book.id, () => unclaimIdea(book.id));

  const reAdd = (b: WishIdea) =>
    addIdea(current!.householdId, b.listId, {
      title: b.title,
      author: b.author,
      isbn: b.isbn,
      coverId: b.coverId,
      note: b.note,
      link: b.link,
      price: b.price,
      favourite: b.favourite,
      imagePath: b.imagePath,
    });

  const remove = (book: WishIdea) =>
    run(book.id, async () => {
      await removeIdea(book.id);
      setEditing(null);
      say(`Took ${book.title} off the list`, () => run(book.id, () => reAdd(book)));
    });

  async function putOnShelf(book: WishIdea, place: Place) {
    const { movementId } = await addItem({ locationId: place.id, productName: book.title, brand: book.author ?? undefined, quantity: 1, unit: "item" });
    await removeIdea(book.id);
    setShelving(null);
    refresh();
    refreshShelves();
    say(`${book.title} is in ${place.name}`, () =>
      run(book.id, async () => {
        if (movementId) await undo(movementId);
        await reAdd(book);
        refreshShelves();
      }),
    );
  }

  async function startShare() {
    if (!person) return;
    setError(null);
    try {
      if (!person.list) {
        await ensureList(current!.householdId, person.userId!, "books");
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
      <PageHeader title="Book wish lists" back={{ href: "/lists/", label: "Lists" }} sub="The books everyone wants to read next. Share a list so friends and family know what to get." />

      {error ? <Notice>{error}</Notice> : null}

      {data === null || !current ? (
        <HouseholdLoading />
      ) : (
        <>
          <nav aria-label="Whose list" className="-mx-4 overflow-x-auto px-4 pt-1 pb-1 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0">
            <ul className="flex gap-3">
              {everyone.map((p, i) => {
                const on = p.key === person?.key;
                const n = countFor(p);
                return (
                  <li key={p.key} className="shrink-0">
                    <button
                      onClick={() => choose(p.key)}
                      aria-pressed={on}
                      className={`flex w-[84px] flex-col items-center gap-2 rounded-2xl pt-3 pb-2 transition ${on ? "bg-card shadow-[var(--shadow-lift)] ring-1 ring-line" : "opacity-85 hover:opacity-100"}`}
                    >
                      {n === 0 ? (
                        // No books yet: an empty slot, not a faint stack that reads as nothing.
                        <span className="grid h-[52px] w-[52px] place-items-center rounded-[14px] border-2 border-dashed border-line text-mute">
                          <IconBook className="size-5" />
                        </span>
                      ) : (
                        <BookStack index={i} count={n} className="h-[52px] w-[52px]" />
                      )}
                      <span className={`flex max-w-full flex-col px-1 font-display text-[13.5px] leading-tight font-bold ${on ? "" : "text-mute"}`}>
                        <span className="truncate">{p.userId === me ? "You" : firstName(p.name)}</span>
                        {p.list?.friend ? <span className="text-[11px] font-semibold" style={{ color: BOOK_LOOK.ribbon }}>friend</span> : null}
                      </span>
                    </button>
                  </li>
                );
              })}
              <li className="shrink-0">
                <button onClick={() => setNaming(true)} className="flex w-[84px] flex-col items-center gap-2 rounded-2xl pt-3 pb-2 text-mute hover:text-fg">
                  <span className="grid h-[52px] w-[52px] place-items-center rounded-[14px] border-2 border-dashed border-line">
                    <IconPlus className="size-5" />
                  </span>
                  <span className="font-display text-[13.5px] font-bold whitespace-nowrap">Add a list</span>
                </button>
              </li>
            </ul>
          </nav>

          {person ? (
            <section aria-labelledby="list-h" className="flex flex-col gap-4">
              <ClothBand>
                <p className="font-display text-[12.5px] font-bold tracking-[0.08em] uppercase opacity-75">
                  {mine ? "Your book wish list" : person.list?.friend ? `${firstName(person.name)}'s own list` : `For ${firstName(person.name)}`}
                </p>
                <h2 id="list-h" className="mt-1 font-serif text-[1.7rem] leading-[1.05] font-semibold tracking-[-0.015em] sm:text-[2.4rem]">
                  {wantsToRead(person.name, mine)}
                </h2>
                {mine && person.list?.shareCode ? (
                  <p className="mt-1.5 text-[13.5px] leading-snug opacity-80">Shared. Anyone with the link can see it.</p>
                ) : (
                  <p className="mt-2 max-w-[34ch] text-[14.5px] leading-snug opacity-85">
                    {mine
                      ? "Friends can say they'll get you one. You won't see which, so it stays a surprise."
                      : `Say you'll get one so nobody doubles up. ${firstName(person.name)} won't see.`}
                  </p>
                )}
                <button
                  onClick={startShare}
                  className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-btn)] px-4 font-display text-[14.5px] font-bold shadow-[0_6px_16px_-10px_rgba(0,0,0,0.6)] transition active:scale-[0.98]"
                  style={{ background: BOOK_LOOK.paper, color: BOOK_LOOK.cloth }}
                >
                  <IconShare className="size-[18px]" /> {mine ? "Share my list" : `Share ${firstName(person.name)}'s list`}
                </button>
              </ClothBand>

              <BookAdd
                forName={mine ? "you" : firstName(person.name)}
                busy={busy}
                status={status}
                ownedIn={ownedIn}
                onAdd={addFound}
                onAddTyped={addTyped}
                onLink={addFromLink}
                onScan={scan}
              />

              {books.length === 0 ? (
                <div className="flex items-center gap-3.5 rounded-[var(--radius-card)] border-2 border-dashed border-line bg-sunk/40 p-5">
                  <IconBook className="size-8 shrink-0" />
                  <p className="text-[15px] text-mute">
                    {mine
                      ? "Nothing on your list yet. Scan the barcode on a book you spot, or type a title to find it."
                      : `${firstName(person.name)} hasn't added any books yet. You can add some for them too.`}
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex flex-col gap-2.5 pt-1 sm:flex-row sm:items-center sm:justify-between">
                    <SectionLabel>
                      {books.length === 1 ? "1 book" : `${books.length} books`}
                      {!mine && books.some((b) => claimOf(b.id)) ? <span className="font-semibold text-mute"> · {books.filter((b) => claimOf(b.id)).length} being got</span> : null}
                    </SectionLabel>
                    <div role="group" aria-label="Sort by" className="-mx-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
                      {BOOK_SORTS.map((s) => (
                        <button
                          key={s.key}
                          onClick={() => sortBy(s.key)}
                          aria-pressed={sort === s.key}
                          className={`min-h-9 shrink-0 rounded-full px-3.5 text-[13.5px] font-semibold transition ${sort === s.key ? "bg-fg text-bg" : "bg-sunk text-mute hover:text-fg"}`}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <ul className="flex flex-col gap-2.5">
                    {books.map((b) => {
                      const c = mine ? undefined : claimOf(b.id);
                      return (
                        <BookRow
                          key={b.id}
                          book={b}
                          mine={mine}
                          busy={busy === b.id}
                          addedBy={b.addedBy && b.addedBy !== person.userId ? who(b.addedBy) : null}
                          suggestedBy={b.suggestedBy}
                          owned={ownedIn(b.title)}
                          alsoWanted={alsoWanted(b)}
                          claim={c ? { byMe: c.claimedBy === me, name: c.claimedName ?? who(c.claimedBy), fromLink: !c.claimedBy } : null}
                          onClaim={() => claim(b)}
                          onUnclaim={() => unclaim(b)}
                          onOpen={() => setEditing(b)}
                          onGotIt={() => setShelving(b)}
                        />
                      );
                    })}
                  </ul>
                </>
              )}

              {gettingCount > 0 ? (
                <p className="text-[13.5px] text-mute">
                  You&apos;re getting {gettingCount === 1 ? "1 book" : `${gettingCount} books`} across everyone&apos;s lists.
                </p>
              ) : null}
            </section>
          ) : null}
        </>
      )}

      <IdeaSheet
        kind="books"
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
      <ShelfSheet book={shelving} places={places} onClose={() => setShelving(null)} onPut={putOnShelf} />
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
          books
          open={naming}
          onClose={() => setNaming(false)}
          onAdd={async (name) => {
            const l = await addNamedList(current.householdId, name, "books");
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
