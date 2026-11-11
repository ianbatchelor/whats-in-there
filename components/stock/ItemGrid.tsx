"use client";

import { useState } from "react";
import type { StockItem } from "@/lib/domain/stock";
import type { LocationType } from "@/lib/household";
import { formatQuantity, isCounted, roundQty } from "@/lib/domain/quantity";
import { itemKind } from "@/lib/domain/itemKind";
import { useItemPhoto } from "@/lib/itemPhotos";
import { useBookCover } from "@/lib/covers";
import { useFadeIn } from "@/components/ui/useFadeIn";
import { Highlight, KINDS, bookOf } from "./ItemRow";

/**
 * Things you keep as a wall of pictures: book covers, the photo of each coat, so a shelf looks like
 * the shelf. Each tile opens the thing, like a row in the list does.
 */
export function ItemGrid({
  items,
  placeType,
  onOpen,
  highlight,
}: {
  items: StockItem[];
  placeType: LocationType;
  onOpen: (item: StockItem) => void;
  highlight?: string;
}) {
  return (
    <ul className="grid grid-cols-3 gap-x-3 gap-y-4 sm:grid-cols-4 lg:grid-cols-6">
      {items.map((item, i) => (
        <Tile key={item.id} item={item} placeType={placeType} onOpen={onOpen} index={i} highlight={highlight} />
      ))}
    </ul>
  );
}

function Tile({ item, placeType, onOpen, index, highlight }: { item: StockItem; placeType: LocationType; onOpen: (item: StockItem) => void; index: number; highlight?: string }) {
  const book = bookOf(item, placeType);
  const qty = roundQty(item.quantity);
  const many = isCounted(item.unit) ? qty > 1 : true;
  return (
    <li className="rise min-w-0" style={{ animationDelay: `${Math.min(index, 12) * 25}ms` }}>
      <button
        onClick={() => onOpen(item)}
        className="group flex w-full min-w-0 flex-col gap-1.5 text-left"
        aria-label={`${item.productName}${many ? `, ${formatQuantity(qty, item.unit)}` : ""}${item.lentTo ? `, lent to ${item.lentTo}` : ""}. See details`}
      >
        <span className="lift relative block aspect-[3/4] w-full overflow-hidden rounded-xl bg-sunk shadow-[var(--shadow-card)]">
          <Picture item={item} book={book} />
          {many ? (
            <span className="absolute top-1.5 right-1.5 rounded-full bg-white/95 px-2 py-0.5 text-[12px] font-bold text-[#17242a] tabular-nums">
              {isCounted(item.unit) ? `×${qty}` : formatQuantity(qty, item.unit)}
            </span>
          ) : null}
          {item.lentTo ? (
            <span className="absolute inset-x-1.5 bottom-1.5 truncate rounded-full bg-white/95 px-2 py-0.5 text-center text-[12px] font-semibold text-[#855a0b]">
              With {item.lentTo}
            </span>
          ) : null}
        </span>
        <span className="line-clamp-2 px-0.5 text-[13.5px] leading-snug font-semibold">
          <Highlight text={item.productName} match={highlight} />
        </span>
        {item.brand ? <span className="-mt-1 truncate px-0.5 text-[12.5px] text-mute">{item.brand}</span> : null}
      </button>
    </li>
  );
}

/** Photo, then cover, then a made-up cover for books, then the kind-of-thing drawing. */
function Picture({ item, book }: { item: StockItem; book: { title: string; author: string | null } | null }) {
  const own = useItemPhoto(item.imagePath);
  const cover = useBookCover(item.imagePath ? null : book);
  const src = own ?? cover;
  const [broken, setBroken] = useState<string | null>(null);
  const { seen, onLoad, className: fadeClass } = useFadeIn();
  if (src && broken !== src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        aria-hidden="true"
        loading="lazy"
        decoding="async"
        ref={seen}
        onLoad={onLoad}
        onError={() => setBroken(src)}
        className={`block h-full w-full object-cover transition duration-500 group-hover:scale-[1.03] ${fadeClass}`}
      />
    );
  }
  if (book) return <PlainCover title={item.productName} author={item.brand} />;
  const { Icon, tint } = KINDS[itemKind(item.productName, item.category)];
  return (
    <span aria-hidden="true" className={`grid h-full w-full place-items-center ${tint}`}>
      <Icon className="size-[38%]" />
    </span>
  );
}

const COVER_COLOURS = ["#183f32", "#7a3b2e", "#4d5b6a", "#8a5a33", "#5d4a85", "#3e6a7a", "#9a6b1f", "#6b3a4f"];

/** A simple cloth-bound cover with the title, for books Open Library has no picture of. */
function PlainCover({ title, author }: { title: string; author: string | null }) {
  let h = 0;
  for (const c of title) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return (
    <span aria-hidden="true" className="flex h-full w-full flex-col justify-between p-2.5 text-[#fffdf8]" style={{ background: COVER_COLOURS[h % COVER_COLOURS.length] }}>
      <span className="block h-px w-full bg-[#f6c65b]/60" />
      <span className="line-clamp-4 font-display text-[14px] leading-tight font-bold [overflow-wrap:anywhere]">{title}</span>
      <span className="flex flex-col gap-1.5">
        {author ? <span className="line-clamp-2 text-[12px] leading-tight opacity-80">{author}</span> : null}
        <span className="block h-px w-full bg-[#f6c65b]/60" />
      </span>
    </span>
  );
}
