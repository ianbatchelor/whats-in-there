"use client";

import type { CSSProperties } from "react";
import { useState } from "react";
import { coverUrl, useBookCover } from "@/lib/covers";
import { BOOK_LOOK, clothFor, stackFor } from "@/lib/domain/books";

/** Bookcloth: the colour with a faint woven texture. */
export function clothStyle(color: string = BOOK_LOOK.cloth): CSSProperties {
  return {
    backgroundColor: color,
    backgroundImage: [
      "repeating-linear-gradient(90deg, rgba(255,255,255,0.03) 0 2px, transparent 2px 5px)",
      "repeating-linear-gradient(0deg, rgba(255,255,255,0.025) 0 1px, transparent 1px 4px)",
      "linear-gradient(160deg, rgba(255,255,255,0.06), rgba(0,0,0,0.14))",
    ].join(","),
    color: BOOK_LOOK.ink,
  };
}

/** A ribbon bookmark hanging from the top edge. */
export function Ribbon({ className = "", style }: { className?: string; style?: CSSProperties }) {
  return (
    <span aria-hidden="true" className={`absolute top-0 block w-4 ${className}`} style={style}>
      <svg viewBox="0 0 16 100" preserveAspectRatio="none" className="block h-full w-full drop-shadow-[0_2px_2px_rgba(0,0,0,0.3)]">
        <path d="M0 0h16v100l-8-8-8 8z" fill={BOOK_LOOK.ribbon} />
        <path d="M12.5 0h3.5v96.5L12.5 93z" fill="rgba(0,0,0,0.15)" />
      </svg>
    </span>
  );
}

/** The wide cloth band at the top of someone's list, with a ribbon bookmark. */
export function ClothBand({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`relative isolate overflow-hidden rounded-[22px] shadow-[0_18px_38px_-24px_rgba(21,33,28,0.75)] ${className}`} style={clothStyle()}>
      <Ribbon className="right-[14%] h-[62%] -z-10" />
      <div className="relative px-5 pt-5 pb-5 pr-[24%] sm:px-7 sm:pt-7">{children}</div>
    </div>
  );
}

/**
 * A book's cover: Open Library's picture when there is one, otherwise a cloth cover with the
 * title printed on it, so every book has something to look at.
 */
export function BookCover({
  title,
  author,
  coverId,
  className = "w-12",
  look = true,
}: {
  title: string;
  author: string | null;
  coverId: number | null;
  className?: string;
  /** Look the cover up by title when there's no cover number (lists made by typing a title). */
  look?: boolean;
}) {
  const found = useBookCover(look && !coverId ? { title, author } : null);
  const src = coverId ? coverUrl(coverId) : found;
  const [broken, setBroken] = useState<string | null>(null);
  const surname = author?.replace(/\s+and others$/i, "").split(/\s+and\s+|,/)[0]?.trim().split(/\s+/).pop();
  return (
    <span
      aria-hidden="true"
      className={`relative block aspect-[2/3] shrink-0 overflow-hidden rounded-[2px_5px_5px_2px] shadow-[inset_3px_0_0_rgba(0,0,0,0.18),0_3px_8px_-3px_rgba(21,33,28,0.45)] ${className}`}
      style={clothStyle(clothFor(title))}
    >
      {src && broken !== src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" loading="lazy" onError={() => setBroken(src)} className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <span className="absolute inset-0 flex flex-col gap-1 overflow-hidden px-[10%] pt-[14%]">
          <span className="line-clamp-4 font-serif text-[clamp(6px,0.82em,11px)] leading-[1.1] font-semibold break-words hyphens-auto uppercase">{title}</span>
          {surname ? <span className="truncate text-[clamp(5px,0.6em,8px)] tracking-[0.06em] uppercase opacity-80">{surname}</span> : null}
        </span>
      )}
    </span>
  );
}

/** A small stack of books for someone's tab, with how many they want on it. */
export function BookStack({ index, count, className = "" }: { index: number; count: number; className?: string }) {
  const colours = stackFor(index, count);
  const widths = ["92%", "80%", "98%", "86%"];
  return (
    <span className={`relative flex flex-col items-center justify-end gap-[2px] ${className}`}>
      {colours.map((c, i) => (
        <span
          key={i}
          className="block h-[11px] rounded-[2px] shadow-[inset_0_-2px_0_rgba(0,0,0,0.18),inset_0_1px_0_rgba(255,255,255,0.18)]"
          style={{ background: c, width: widths[i % widths.length], marginLeft: i % 2 ? "6%" : "-4%" }}
        />
      ))}
      {count > 0 ? (
        <span className="absolute -right-1 bottom-0 grid h-5 min-w-5 place-items-center rounded-full bg-fg px-1 text-[11px] font-bold text-bg tabular-nums">{count}</span>
      ) : null}
    </span>
  );
}
