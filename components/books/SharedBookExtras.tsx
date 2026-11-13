"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { IconShare } from "@/components/ui/icons";
import { friendlyError } from "@/lib/supabase/errors";
import { firstName, wishShareUrl } from "@/lib/domain/presents";
import { BOOK_LOOK } from "@/lib/domain/books";
import { publicOrigin } from "@/lib/config";
import { lookUpIsbn, readBarcode, type FoundBook } from "@/lib/books";
import type { NewBook } from "@/lib/presents";
import { BookAdd } from "./BookAdd";

/**
 * The add box on the shared page, for people without an account: search a title or scan a
 * barcode. Used for a friend's own list and for suggesting a book for someone else's.
 */
export function SharedBookAdd({ forName, onAdd, placeholder }: { forName: string; onAdd: (b: NewBook) => Promise<void>; placeholder?: string }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function add(key: string, b: NewBook, done?: string) {
    setBusy(key);
    setError(null);
    try {
      await onAdd(b);
      setStatus(done ?? `Added ${b.title}.`);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(null);
    }
  }

  async function scan(photo: File) {
    setError(null);
    setBusy("scan");
    setStatus("Reading the barcode…");
    try {
      const isbn = await readBarcode(photo);
      if (!isbn) {
        setStatus("Couldn't read a book barcode in that photo. Try again closer up, or type the title.");
        return;
      }
      setStatus("Looking the book up…");
      const book = await lookUpIsbn(isbn).catch(() => null);
      if (!book) {
        setStatus(`The library catalogue doesn't know ISBN ${isbn}. Type the title instead.`);
        return;
      }
      setBusy(null);
      await add(`add:${book.title}`, book);
    } catch (e) {
      setStatus(null);
      setError(friendlyError(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <BookAdd
        forName={forName}
        busy={busy}
        status={status}
        placeholder={placeholder ?? "Search for a book by title"}
        onAdd={(b: FoundBook) => add(`add:${b.title}`, b)}
        onAddTyped={(title) => add("add", { title: title.slice(0, 120), author: null, isbn: null, coverId: null })}
        onScan={scan}
      />
      {error ? <Notice>{error}</Notice> : null}
    </div>
  );
}

/** "Got a list of your own?": start a friend's list beside the one they were sent. */
export function StartOwnList({ listName, myName, onStart }: { listName: string; myName: string; onStart: (name: string) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(myName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const first = firstName(listName);

  async function start(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await onStart(name);
    } catch (err) {
      setError(friendlyError(err));
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-[var(--radius-card)] border-2 border-dashed border-line bg-card p-5">
      <h2 className="font-serif text-[1.4rem] leading-tight font-semibold">Got a list of your own?</h2>
      <p className="text-[15px] text-mute">
        Add the books you&apos;d like to read. {first}&apos;s household will see them and can get you one. You don&apos;t need an account.
      </p>
      {open ? (
        <form onSubmit={start} className="flex flex-col gap-2 pt-1">
          <label htmlFor="own-name" className="text-[13.5px] font-semibold">
            Your first name
          </label>
          <div className="flex gap-2">
            <input
              id="own-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={40}
              autoFocus
              autoComplete="given-name"
              placeholder="Carol"
              className="min-h-11 w-full min-w-0 flex-1 rounded-xl border border-line bg-card px-3.5 text-base focus:border-leaf focus:ring-4 focus:ring-leaf/15 focus:outline-none"
            />
            <Button type="submit" busy={busy} disabled={!name.trim()} className="min-h-11 shrink-0 px-4" style={{ background: BOOK_LOOK.cloth, color: BOOK_LOOK.ink }}>
              Start my list
            </Button>
          </div>
        </form>
      ) : (
        <Button onClick={() => setOpen(true)} className="mt-1 self-start" style={{ background: BOOK_LOOK.cloth, color: BOOK_LOOK.ink }}>
          Start my list
        </Button>
      )}
      {error ? <Notice>{error}</Notice> : null}
    </div>
  );
}

/** "Suggest a book" for the list someone was sent: they search for it, then give a first name. */
export function SuggestBook({ listName, myName, onSuggest }: { listName: string; myName: string; onSuggest: (name: string, b: NewBook) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(myName);
  const first = firstName(listName);

  return (
    <div className="flex flex-col gap-2 rounded-[var(--radius-card)] border border-line bg-card p-5 shadow-[var(--shadow-card)]">
      <h2 className="font-display text-[17px] font-bold">Know a book {first} would love?</h2>
      {open ? (
        <>
          <label htmlFor="suggest-name" className="text-[13.5px] font-semibold">
            Your first name, so {first} knows who suggested it
          </label>
          <input
            id="suggest-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
            autoComplete="given-name"
            placeholder="Sue"
            className="min-h-11 rounded-xl border border-line bg-card px-3.5 text-base focus:border-leaf focus:ring-4 focus:ring-leaf/15 focus:outline-none"
          />
          {name.trim() ? (
            <SharedBookAdd forName={first} placeholder="Search for the book by title" onAdd={(b) => onSuggest(name, b)} />
          ) : null}
        </>
      ) : (
        <>
          <p className="text-[15px] text-mute">Suggest one and it goes on the list with your name.</p>
          <Button variant="ghost" onClick={() => setOpen(true)} className="mt-1 self-start">
            Suggest a book
          </Button>
        </>
      )}
    </div>
  );
}

/** A friend's tools on their own list: share it on, or remove it. */
export function OwnListTools({ code, name, onRemove }: { code: string; name: string; onRemove: () => Promise<void> }) {
  const [said, setSaid] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const url = wishShareUrl(publicOrigin(), code);

  async function share() {
    const text = `Here's my book wish list 📚 If you'd like to get me one, tap "I'll get this" so nobody doubles up: ${url}`;
    try {
      if (navigator.share) {
        await navigator.share({ text });
        return;
      }
      await navigator.clipboard.writeText(url);
      setSaid("Link copied. Keep it to come back to your list on another phone or computer.");
    } catch (err) {
      if ((err as { name?: string })?.name !== "AbortError") setSaid(`Your list's link: ${url}`);
    }
  }

  return (
    <div className="flex flex-col gap-2 text-[14px] text-mute">
      <p>
        This list is kept on this phone or computer. To change it somewhere else, keep the link: <span className="break-all text-fg">{url}</span>
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" onClick={share} className="min-h-10 rounded-xl px-3.5 text-[14px]">
          <IconShare className="size-[18px]" /> Share my list
        </Button>
        {confirm ? (
          <span className="flex items-center gap-2">
            <span className="text-fg">Remove {firstName(name)}&apos;s list and all its books?</span>
            <Button
              variant="danger"
              busy={busy}
              onClick={async () => {
                setBusy(true);
                await onRemove();
              }}
              className="min-h-10 px-2 text-[14px]"
            >
              Remove
            </Button>
            <button onClick={() => setConfirm(false)} className="min-h-10 font-semibold">
              Keep it
            </button>
          </span>
        ) : (
          <button onClick={() => setConfirm(true)} className="min-h-10 font-semibold text-warn">
            Remove my list
          </button>
        )}
      </div>
      {said ? <p>{said}</p> : null}
    </div>
  );
}
