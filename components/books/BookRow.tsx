import type { WishIdea } from "@/lib/domain/presents";
import { BOOK_LOOK } from "@/lib/domain/books";
import { IconBook, IconCheck, IconStar } from "@/components/ui/icons";
import { BookCover } from "./Book";

export type ClaimView = { byMe: boolean; name: string; fromLink: boolean };

/**
 * One book on someone's wish list: its cover, title and author, and anything worth knowing: that
 * it's already on one of your shelves, or someone else in the house wants it too. On someone
 * else's list, a button to say you'll get it.
 */
export function BookRow({
  book,
  mine,
  busy,
  addedBy,
  owned,
  alsoWanted,
  claim,
  onClaim,
  onUnclaim,
  onOpen,
  onGotIt,
}: {
  book: WishIdea;
  mine: boolean;
  busy: boolean;
  addedBy: string | null;
  /** The name of the place it's already kept, if the household has it. */
  owned: string | null;
  /** First names of others in the house who want it too. */
  alsoWanted: string[];
  claim: ClaimView | null;
  onClaim: () => void;
  onUnclaim: () => void;
  onOpen: () => void;
  onGotIt: () => void;
}) {
  const taken = !!claim && !claim.byMe;
  return (
    <li className={`rise flex gap-3 rounded-[var(--radius-card)] border border-line bg-card p-3 shadow-[var(--shadow-card)] ${taken ? "opacity-75" : ""}`} aria-busy={busy || undefined}>
      <button onClick={onOpen} tabIndex={-1} aria-hidden="true" className="self-start">
        <BookCover title={book.title} author={book.author} coverId={book.coverId} className="w-[52px] text-[9px]" />
      </button>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <button onClick={onOpen} className="flex min-w-0 flex-col gap-0.5 text-left" aria-label={`${book.title}${book.author ? ` by ${book.author}` : ""}. Open to see or change details`}>
          <span className={`font-semibold leading-snug ${taken ? "line-through decoration-mute/50" : ""}`}>{book.title}</span>
          {book.author ? <span className="text-[14px] leading-snug text-mute">{book.author}</span> : null}
          {book.note ? <span className="line-clamp-2 text-[13.5px] leading-snug text-mute">{book.note}</span> : null}
        </button>
        {book.favourite || owned || alsoWanted.length || addedBy ? (
          <span className="flex flex-wrap items-center gap-1.5 pt-0.5 text-[12.5px]">
            {book.favourite ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-check px-2 py-0.5 font-semibold text-[#7a5508]">
                <IconStar className="size-3.5 fill-[#e9b949]! stroke-[#c8962a]!" /> Most wanted
              </span>
            ) : null}
            {owned ? (
              <span className="inline-flex min-w-0 items-center gap-1 rounded-full bg-soon-bg px-2 py-0.5 font-semibold text-soon">
                <IconBook className="size-3.5 shrink-0" />
                <span className="truncate">Already in {owned}</span>
              </span>
            ) : null}
            {alsoWanted.length ? (
              <span className="rounded-full px-2 py-0.5 font-semibold" style={{ background: BOOK_LOOK.soft, color: BOOK_LOOK.cloth }}>
                {alsoWanted.join(" and ")} too
              </span>
            ) : null}
            {addedBy ? <span className="text-mute">added by {addedBy}</span> : null}
          </span>
        ) : null}
        {claim ? (
          <span className="flex flex-wrap items-center gap-x-3 pt-0.5">
            <span className="flex items-center gap-1.5 text-[13px] font-semibold text-ok">
              <span className="grid size-[18px] place-items-center rounded-full bg-ok-bg">
                <IconCheck className="size-3" />
              </span>
              {claim.byMe ? "You're getting this" : `${claim.name} is getting this`}
            </span>
            {claim.byMe || claim.fromLink ? (
              <button onClick={onUnclaim} disabled={busy} className="min-h-9 text-[13px] font-semibold text-mute hover:text-fg">
                {claim.byMe ? "Undo" : "Clear"}
              </button>
            ) : null}
          </span>
        ) : null}
        <span className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1">
          {mine || claim ? null : (
            <button
              onClick={onClaim}
              disabled={busy}
              className="min-h-10 rounded-xl px-3.5 font-display text-[13.5px] font-bold text-white transition active:scale-[0.97] disabled:opacity-55"
              style={{ background: BOOK_LOOK.ribbon }}
            >
              I&apos;ll get this
            </button>
          )}
          <button onClick={onGotIt} disabled={busy} className="min-h-10 text-[13.5px] font-semibold text-leaf hover:text-fg">
            Got it? Put it on a shelf ›
          </button>
        </span>
      </div>
    </li>
  );
}
