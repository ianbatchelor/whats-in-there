"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { IconBook, IconPlus } from "@/components/ui/icons";
import { looksLikeLink } from "@/lib/domain/presents";
import { searchBooks, type FoundBook } from "@/lib/books";
import { BookCover } from "./Book";

/** A barcode, drawn: what to tap to scan the back of a book. */
function IconBarcode({ className = "size-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <g fill="currentColor">
        <rect x="3" y="5" width="2" height="14" rx="0.4" />
        <rect x="6.5" y="5" width="1" height="14" />
        <rect x="9" y="5" width="2" height="14" rx="0.4" />
        <rect x="12.5" y="5" width="1" height="14" />
        <rect x="15" y="5" width="2.5" height="14" rx="0.4" />
        <rect x="19" y="5" width="2" height="14" rx="0.4" />
      </g>
    </svg>
  );
}

/**
 * The add box: type a title to see matching books from the library catalogue, paste a shop link,
 * or tap the barcode button to photograph the back of a book.
 */
export function BookAdd({
  forName,
  busy,
  status,
  ownedIn,
  onAdd,
  onAddTyped,
  onLink,
  onScan,
  placeholder = "Search a title, or paste a link",
}: {
  forName: string;
  busy: string | null;
  status: string | null;
  ownedIn?: (title: string) => string | null;
  onAdd: (book: FoundBook) => Promise<void>;
  onAddTyped: (title: string) => Promise<void>;
  /** Shop links need an account; without this, a link is just text. */
  onLink?: (link: string) => Promise<void>;
  placeholder?: string;
  onScan: (photo: File) => Promise<void>;
}) {
  const [text, setText] = useState("");
  const [found, setFound] = useState<{ q: string; books: FoundBook[] } | null>(null);
  const [searching, setSearching] = useState(false);
  const [offline, setOffline] = useState(false);
  const camera = useRef<HTMLInputElement>(null);
  const q = text.trim();
  const isLink = !!onLink && looksLikeLink(q);

  // Look the title up as they type, after a short pause.
  useEffect(() => {
    if (q.length < 3 || isLink) return;
    const ctl = new AbortController();
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const books = await searchBooks(q, ctl.signal);
        setFound({ q, books });
        setOffline(false);
      } catch {
        if (!ctl.signal.aborted) setOffline(true);
      } finally {
        if (!ctl.signal.aborted) setSearching(false);
      }
    }, 450);
    return () => {
      clearTimeout(t);
      ctl.abort();
    };
  }, [q, isLink]);

  const results = q.length >= 3 && !isLink && found ? found.books : [];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!q) return;
    if (isLink) await onLink!(q);
    else await onAddTyped(q);
    setText("");
    setFound(null);
  }

  async function add(book: FoundBook) {
    await onAdd(book);
    setText("");
    setFound(null);
  }

  return (
    <div className="flex flex-col gap-2">
      <form onSubmit={submit} className="flex gap-2">
        <button
          type="button"
          onClick={() => camera.current?.click()}
          disabled={busy !== null}
          aria-label="Scan the barcode on the back of a book"
          className="grid min-h-12 w-12 shrink-0 place-items-center rounded-2xl border border-line bg-card text-fg shadow-[var(--shadow-card)] transition hover:bg-sunk active:scale-[0.97] disabled:opacity-55"
        >
          <IconBarcode className="size-6" />
        </button>
        <label htmlFor="book-add" className="sr-only">
          Add a book for {forName}: type a title or paste a link
        </label>
        <input
          id="book-add"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder}
          maxLength={200}
          autoComplete="off"
          enterKeyHint="search"
          className="min-h-12 w-full min-w-0 flex-1 rounded-2xl border border-line bg-card px-4 text-base text-fg shadow-[inset_0_1px_2px_rgba(23,36,42,0.04)] placeholder:text-mute focus:border-leaf focus:ring-4 focus:ring-leaf/15 focus:outline-none"
        />
        {isLink ? (
          <Button type="submit" busy={busy === "add"} className="shrink-0 px-4">
            <IconPlus className="size-[18px]" /> Add
          </Button>
        ) : null}
        <input
          ref={camera}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) onScan(f);
          }}
        />
      </form>

      {status ? (
        <p role="status" className="text-[14px] text-mute">
          {status}
        </p>
      ) : null}

      {q.length >= 3 && !isLink ? (
        <div className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-card shadow-[var(--shadow-lift)]">
          {results.length ? (
            <ul className="divide-y divide-line">
              {results.map((b) => {
                const owned = ownedIn?.(b.title) ?? null;
                return (
                  <li key={`${b.title}|${b.author}|${b.coverId}`} className="flex items-center gap-3 px-3 py-2.5">
                    <BookCover title={b.title} author={b.author} coverId={b.coverId} look={false} className="w-10 text-[8px]" />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="line-clamp-2 font-semibold leading-snug">{b.title}</span>
                      <span className="truncate text-[13.5px] text-mute">
                        {[b.author, b.year].filter(Boolean).join(" · ") || "Author not known"}
                      </span>
                      {owned ? (
                        <span className="mt-1 inline-flex w-fit max-w-full items-center gap-1 rounded-full bg-soon-bg px-2 py-0.5 text-[12px] font-semibold text-soon">
                          <IconBook className="size-3.5 shrink-0" />
                          <span className="truncate">You have this in {owned}</span>
                        </span>
                      ) : null}
                    </span>
                    <Button variant={owned ? "ghost" : "go"} onClick={() => add(b)} busy={busy === `add:${b.title}`} disabled={busy !== null} className="min-h-10 shrink-0 rounded-xl px-3.5 text-[14px]">
                      Add
                    </Button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="px-4 py-3 text-[14px] text-mute">
              {searching || !found || found.q !== q ? "Looking in the library catalogue…" : offline ? "Couldn't reach the library catalogue." : "No books found with that title."}
            </p>
          )}
          <button
            type="button"
            onClick={async () => {
              await onAddTyped(q);
              setText("");
              setFound(null);
            }}
            disabled={busy !== null}
            className="flex min-h-11 w-full items-center gap-2 border-t border-line bg-sunk/50 px-4 text-left text-[14px] font-semibold text-leaf hover:bg-sunk"
          >
            <IconPlus className="size-4 shrink-0" />
            <span className="truncate">Add &ldquo;{q}&rdquo; as typed</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}
