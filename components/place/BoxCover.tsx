"use client";

import { useState } from "react";
import type { LocationType } from "@/lib/household";
import { boxColour, coverKind, labelLines, PEEK_MAX, type Peek } from "@/lib/domain/boxLook";
import { isBook } from "@/lib/domain/covers";
import { useItemPhoto } from "@/lib/itemPhotos";
import { useBookCover } from "@/lib/covers";
import { useFadeIn } from "@/components/ui/useFadeIn";
import { PlacePhoto } from "@/components/art/PlacePhoto";
import { IconBox } from "@/components/ui/icons";

function bookOf(p: Peek, type: LocationType) {
  return isBook({ productName: p.name, category: p.category }, type) ? { title: p.name, author: p.brand } : null;
}

/**
 * The picture for a box or shelf inside a place: its own photo if someone took one, otherwise its
 * own colour with what's inside on it, so "Blue box" and "Christmas box" don't look the same.
 * `peeks` is null while the things are still loading.
 */
export function BoxCover({
  id,
  type,
  imagePath,
  peeks,
  total,
  wide = false,
  className = "",
  eager = false,
}: {
  id: string;
  type: LocationType;
  imagePath?: string | null;
  peeks: Peek[] | null;
  total: number;
  wide?: boolean;
  className?: string;
  eager?: boolean;
}) {
  if (imagePath) return <PlacePhoto type={type} imagePath={imagePath} variant={wide ? "wide" : "card"} className={className} eager={eager} />;
  const colour = boxColour(id);
  const kind = peeks === null ? null : coverKind(peeks, (p) => !!p.imagePath || !!bookOf(p, type));
  return (
    <span
      aria-hidden="true"
      data-box-colour={colour.name}
      className={`relative block h-full w-full overflow-hidden ${className}`}
      style={{ backgroundColor: colour.bg, backgroundImage: "radial-gradient(120% 90% at 15% 0%, rgba(255,255,255,0.16), transparent 60%)" }}
    >
      {kind === "photos" ? (
        <Mosaic peeks={peeks!.slice(0, PEEK_MAX)} type={type} wide={wide} />
      ) : wide ? (
        // The page header carries the title over it, and the list is just below: colour alone.
        <IconBox className="absolute top-1/2 right-6 size-28 -translate-y-1/2 -rotate-6 text-white/15 sm:right-12" />
      ) : kind === "label" ? (
        <Label peeks={peeks!} total={total} />
      ) : kind === "empty" ? (
        <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-white/75">
          <IconBox className="size-9" />
          <span className="text-[12.5px] font-semibold">Empty</span>
        </span>
      ) : null}
    </span>
  );
}

/** A paper label stuck on the box with tape, with the first few things written on it. */
function Label({ peeks, total }: { peeks: Peek[]; total: number }) {
  const { lines, more } = labelLines(peeks, total);
  return (
    <span className="absolute top-1/2 left-1/2 flex w-[78%] -translate-x-1/2 -translate-y-1/2 -rotate-[2deg] flex-col rounded-[6px] bg-[#fffdf8] px-2.5 pt-2.5 pb-2 text-[#2a2112] shadow-[0_6px_14px_-6px_rgba(0,0,0,0.45)]">
      <span className="absolute -top-1.5 left-1/2 h-3 w-10 -translate-x-1/2 rotate-[3deg] rounded-[2px] bg-tape/85" />
      {lines.map((l, i) => (
        <span key={i} className="block truncate font-serif text-[12.5px] leading-snug font-medium">
          {l}
        </span>
      ))}
      {more > 0 ? <span className="mt-0.5 block text-[12px] font-semibold text-[#6b5d45]">+{more} more</span> : null}
    </span>
  );
}

const LAYOUT: Record<number, string[]> = {
  1: ["col-span-2 row-span-2"],
  2: ["row-span-2", "row-span-2"],
  3: ["row-span-2", "", ""],
  4: ["", "", "", ""],
};

function Mosaic({ peeks, type, wide }: { peeks: Peek[]; type: LocationType; wide: boolean }) {
  const n = peeks.length;
  return (
    <span
      className={`absolute inset-0 grid gap-[2px] ${wide ? "" : "grid-cols-2 grid-rows-2"}`}
      style={wide ? { gridTemplateColumns: `repeat(${n}, 1fr)` } : undefined}
    >
      {peeks.map((p, i) => (
        <Cell key={i} peek={p} type={type} named={!wide} className={wide ? "" : LAYOUT[n]![i]!} />
      ))}
      {/* Under a page title, the pictures step back so the name stays readable. */}
      {wide ? <span className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-black/30" /> : null}
    </span>
  );
}

function Cell({ peek, type, named, className }: { peek: Peek; type: LocationType; named: boolean; className: string }) {
  const own = useItemPhoto(peek.imagePath);
  const book = bookOf(peek, type);
  const cover = useBookCover(peek.imagePath ? null : book);
  const src = own ?? cover;
  const [broken, setBroken] = useState<string | null>(null);
  const { seen, onLoad, className: fadeClass } = useFadeIn();
  // In a page header the pictures are cut off at the bottom, where the page title sits.
  return (
    <span className={`relative min-h-0 overflow-hidden bg-white/10 ${className}`}>
      {named ? (
        <span className="absolute inset-0 flex items-end p-2">
          <span className="line-clamp-3 text-[12px] leading-tight font-semibold text-white/90">{peek.name}</span>
        </span>
      ) : null}
      {src && broken !== src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          ref={seen}
          onLoad={onLoad}
          onError={() => setBroken(src)}
          className={`absolute inset-x-0 top-0 block w-full object-cover ${named ? "h-full" : "h-[160%] object-top"} ${fadeClass}`}
        />
      ) : null}
    </span>
  );
}
