"use client";

import { useState } from "react";
import type { StockItem } from "@/lib/domain/stock";
import { formatDay } from "@/lib/domain/dates";
import { formatQuantity, isCounted, roundQty } from "@/lib/domain/quantity";
import { itemStatus, type StatusTone } from "@/lib/domain/status";
import { itemKind, type ItemKind } from "@/lib/domain/itemKind";
import {
  IconBook,
  IconBox,
  IconBread,
  IconBulb,
  IconChevronRight,
  IconCup,
  IconFish,
  IconHanger,
  IconLeaf,
  IconMeat,
  IconMilk,
  IconMinus,
  IconSnow,
  IconSprout,
  IconTin,
  IconWine,
  IconWrench,
} from "@/components/ui/icons";
import { useItemPhoto } from "@/lib/itemPhotos";
import { useBookCover } from "@/lib/covers";
import { isBook } from "@/lib/domain/covers";
import type { LocationType } from "@/lib/household";
import { useFadeIn } from "@/components/ui/useFadeIn";
import { isLongLent, lentFor } from "@/lib/domain/lending";

/**
 * The quiet line under a name: where it is and what it is. The date lives in the status label,
 * so it isn't repeated here unless there is nothing else to say.
 */
export function itemContext(item: StockItem, place?: string, brandFirst = false): string {
  const parts: string[] = [];
  if (brandFirst && item.brand) parts.push(item.brand);
  // In lists that span places (Home, search), where it is matters more than the brand, and the row is short.
  if (place) return [...parts, place].join(" · ");
  if (item.brand && !brandFirst) parts.push(item.brand);
  if (item.weightValue && item.weightUnit) parts.push(formatQuantity(item.weightValue, item.weightUnit));
  if (parts.length > 0) return parts.join(" · ");
  if (item.notes) parts.push(item.notes);
  else if (item.frozenAt) parts.push(`Frozen ${formatDay(item.frozenAt, { year: false })}`);
  // A printed date already shows in the status label; "Added 7 Nov" beside it only crowds the row.
  else if (!item.useByDate && !item.bestBeforeDate) parts.push(`Added ${formatDay(item.addedAt, { year: false })}`);
  return parts.join(" · ");
}

/** Shows the text with the first match of the search marked, so people can see why it came up. */
export function Highlight({ text, match }: { text: string; match?: string }) {
  const q = match?.trim().toLowerCase();
  const at = q ? text.toLowerCase().indexOf(q) : -1;
  if (!q || at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <mark className="rounded-[3px] bg-check px-px text-fg">{text.slice(at, at + q.length)}</mark>
      {text.slice(at + q.length)}
    </>
  );
}

const TONES: Record<StatusTone, string> = {
  late: "bg-late-bg text-late",
  soon: "bg-soon-bg text-soon",
  ok: "bg-ok-bg text-ok",
  plain: "bg-sunk text-fg/80",
};

/** The small coloured label that says whether a thing needs attention. */
export function StatusPill({ item, className = "" }: { item: StockItem; className?: string }) {
  const status = itemStatus(item);
  if (!status) return null;
  return (
    <span
      title={status.detail}
      className={`shrink-0 rounded-full px-2 py-[3px] text-[12.5px] leading-tight font-semibold whitespace-nowrap ${TONES[status.tone]} ${className}`}
    >
      {status.label}
    </span>
  );
}

export const KINDS: Record<ItemKind, { Icon: (p: { className?: string }) => React.ReactNode; tint: string }> = {
  meat: { Icon: IconMeat, tint: "bg-[#f6e7e2] text-[#97452f] dark:bg-[#3a221c] dark:text-[#eba58f]" },
  fish: { Icon: IconFish, tint: "bg-[#e4eef3] text-[#3b6781] dark:bg-[#1c2c36] dark:text-[#9cc4da]" },
  dairy: { Icon: IconMilk, tint: "bg-[#eaeff5] text-[#4a6384] dark:bg-[#20283a] dark:text-[#a9bcd8]" },
  veg: { Icon: IconLeaf, tint: "bg-[#e5f0e4] text-[#3c6e40] dark:bg-[#1c2e1e] dark:text-[#9fd0a3]" },
  bakery: { Icon: IconBread, tint: "bg-[#f5ebd9] text-[#8a6226] dark:bg-[#33281a] dark:text-[#deb97c]" },
  tin: { Icon: IconTin, tint: "bg-[#f3ecdf] text-[#7d6435] dark:bg-[#2f291d] dark:text-[#d4bd8c]" },
  frozen: { Icon: IconSnow, tint: "bg-[#e6eff5] text-[#3d6a87] dark:bg-[#1b2b35] dark:text-[#9cc6de]" },
  drink: { Icon: IconCup, tint: "bg-[#e8f0ee] text-[#3f6f66] dark:bg-[#1c2c29] dark:text-[#9bcdc3]" },
  wine: { Icon: IconWine, tint: "bg-[#f3e6ea] text-[#8a3c55] dark:bg-[#35202a] dark:text-[#e3a0b6]" },
  clothes: { Icon: IconHanger, tint: "bg-[#ece8f3] text-[#5d4a85] dark:bg-[#272136] dark:text-[#bcaedd]" },
  tool: { Icon: IconWrench, tint: "bg-[#e9ebee] text-[#4d5a66] dark:bg-[#23282d] dark:text-[#b0bcc7]" },
  garden: { Icon: IconSprout, tint: "bg-[#e5f0e4] text-[#3c6e40] dark:bg-[#1c2e1e] dark:text-[#9fd0a3]" },
  light: { Icon: IconBulb, tint: "bg-[#f8efd4] text-[#8a6410] dark:bg-[#33290f] dark:text-[#e5c36c]" },
  paper: { Icon: IconBook, tint: "bg-[#efe9e1] text-[#6f573d] dark:bg-[#2c261f] dark:text-[#cdb698]" },
  thing: { Icon: IconBox, tint: "bg-sunk text-mute" },
};

/** The item's own photo when it has one, then a book's cover; otherwise a small drawing of the kind of thing it is. */
export function ItemTile({
  name,
  category,
  imagePath,
  size = 44,
  book = null,
}: {
  name: string;
  category?: string | null;
  imagePath?: string | null;
  size?: number;
  /** Look for a cover with this title and author, when there's no photo. */
  book?: { title: string; author: string | null } | null;
}) {
  const own = useItemPhoto(imagePath);
  const cover = useBookCover(imagePath ? null : book);
  const photo = own ?? cover;
  const [broken, setBroken] = useState<string | null>(null);
  const { seen, onLoad, className: fadeClass } = useFadeIn();
  if (photo && broken !== photo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photo}
        alt=""
        aria-hidden="true"
        loading="lazy"
        decoding="async"
        ref={seen}
        onLoad={onLoad}
        onError={() => setBroken(photo)}
        className={`shrink-0 rounded-xl bg-sunk object-cover ${fadeClass}`}
        style={{ width: size, height: size }}
      />
    );
  }
  const { Icon, tint } = KINDS[itemKind(name, category)];
  return (
    <span aria-hidden="true" className={`inline-grid shrink-0 place-items-center rounded-xl ${tint}`} style={{ width: size, height: size }}>
      <Icon className="size-[46%]" />
    </span>
  );
}

/**
 * One thing in a list. The row opens the details; the small minus button, when given, takes one
 * out straight away. On wide screens the status and amount line up in columns.
 */
export function ItemRow({
  item,
  place,
  onOpen,
  onTakeOne,
  taking = false,
  addedBy,
  index = 0,
  highlight,
  keep = false,
  placeType,
  onReturn,
}: {
  item: StockItem;
  place?: string;
  /** The kind of place it's in, so books on a bookshelf can show their cover. */
  placeType?: LocationType;
  /** It's in a place for keeping things: no quick minus, and no "1 item" when there's just the one. */
  keep?: boolean;
  /** Search words to show in bold. */
  highlight?: string;
  onOpen: (item: StockItem) => void;
  onTakeOne?: (item: StockItem) => void;
  taking?: boolean;
  /** Who put it there. Shown as its own column on very wide screens. */
  addedBy?: string;
  index?: number;
  /** Shows an "It's back" button on things that are lent out. */
  onReturn?: (item: StockItem) => void;
}) {
  const qty = roundQty(item.quantity);
  const status = itemStatus(item);
  const back = !!onReturn && !!item.lentTo;
  const quick = !back && !keep && onTakeOne && isCounted(item.unit) && qty >= 1;
  const showQty = !(keep && isCounted(item.unit) && qty === 1);
  const unitWord = formatQuantity(1, item.unit).replace(/^[\d.]+ /, "");
  // Found by its brand ("Cathedral City" for the cheddar): show the brand first so the reason is visible.
  const q = highlight?.trim().toLowerCase();
  const brandFirst = !!q && !item.productName.toLowerCase().includes(q) && !!item.brand?.toLowerCase().includes(q);
  return (
    <li className="rise flex items-center" style={{ animationDelay: `${Math.min(index, 8) * 30}ms` }}>
      <button
        onClick={() => onOpen(item)}
        className="flex min-w-0 flex-1 items-center gap-3 py-2.5 pr-2 pl-3.5 text-left transition hover:bg-sunk/70 active:bg-sunk"
        aria-label={`${item.productName}${showQty ? `, ${formatQuantity(item.quantity, item.unit)}` : ""}${place ? `, in ${place}` : ""}${item.lentTo ? `, lent to ${item.lentTo}` : ""}${status ? `. ${status.detail}` : ""}. See details`}
      >
        <ItemTile name={item.productName} category={item.category} imagePath={item.imagePath} book={bookOf(item, placeType)} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold">
            <Highlight text={item.productName} match={highlight} />
          </span>
          <span className="mt-0.5 flex items-center gap-2">
            <StatusPill item={item} className="lg:hidden" />
            {item.lentTo ? <LentPill item={item} className={place ? "max-w-[60%]" : "max-w-full"} /> : null}
            <span className="min-w-0 truncate text-[13px] text-mute">
              <Highlight text={itemContext(item, place, brandFirst)} match={brandFirst ? highlight : undefined} />
            </span>
          </span>
        </span>
        {addedBy !== undefined ? <span className="hidden w-28 shrink-0 truncate text-[13px] text-mute xl:block">{addedBy}</span> : null}
        <span className="hidden w-36 shrink-0 justify-start lg:flex">
          <StatusPill item={item} />
        </span>
        {showQty ? (
          <span className="min-w-9 shrink-0 text-right leading-tight lg:w-20">
            <span className="block text-[15px] font-semibold tabular-nums">{isCounted(item.unit) ? qty : formatQuantity(qty, item.unit)}</span>
            {isCounted(item.unit) ? <span className="block text-[12px] text-mute">{formatQuantity(qty, item.unit).replace(/^[\d.]+ /, "")}</span> : null}
          </span>
        ) : (
          // Keeps the columns lined up on wide screens when a row has no amount to show.
          <span className="hidden w-20 shrink-0 lg:block" aria-hidden="true" />
        )}
        {/* On wide screens the chevron takes the same room as the minus button, so columns line up. */}
        {quick || back ? null : <IconChevronRight className="mr-1.5 size-4 shrink-0 text-mute/50 lg:mr-6" />}
      </button>
      {back ? (
        <button
          onClick={() => onReturn!(item)}
          disabled={taking}
          aria-label={`${item.productName} is back from ${item.lentTo}`}
          className="mr-2 min-h-11 shrink-0 rounded-xl border border-line bg-card px-3 text-[14px] font-semibold text-fg transition hover:bg-sunk active:scale-95 disabled:opacity-40"
        >
          It&apos;s back
        </button>
      ) : quick ? (
        <button
          onClick={() => onTakeOne(item)}
          disabled={taking}
          aria-label={`Take out 1 ${unitWord} of ${item.productName}`}
          title="Take one out"
          className="mr-2 grid size-11 shrink-0 place-items-center rounded-xl border border-line bg-card text-fg transition hover:bg-sunk active:scale-95 disabled:opacity-40"
        >
          <IconMinus className="size-4" />
        </button>
      ) : null}
    </li>
  );
}

/** The title and author to find a cover with, for things that are books. */
export function bookOf(item: StockItem, placeType: LocationType | undefined): { title: string; author: string | null } | null {
  return isBook(item, placeType) ? { title: item.productName, author: item.brand } : null;
}

/** "Mum · 5 days", for something that's been lent out; the full date is in its title and details. */
export function LentPill({ item, className = "max-w-[60%]" }: { item: StockItem; className?: string }) {
  if (!item.lentTo) return null;
  // After a month it's worth asking for back, so it says how long, in the colour for "act on this".
  const long = isLongLent(item);
  return (
    <span
      title={item.lentOn ? `Lent to ${item.lentTo} on ${formatDay(item.lentOn)}` : `Lent to ${item.lentTo}`}
      className={`shrink-0 truncate rounded-full px-2 py-[3px] text-[12.5px] leading-tight font-semibold ${long ? "bg-late-bg text-late" : "bg-soon-bg text-soon"} ${className}`}
    >
      {item.lentTo}
      {item.lentOn ? <span className="font-normal"> · {lentFor(item.lentOn)}</span> : null}
    </span>
  );
}

/** The list container used everywhere items are shown. */
export function ItemList({ children }: { children: React.ReactNode }) {
  return <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card">{children}</ul>;
}

/** Loading placeholder shaped like the real list, so the page doesn't jump when things arrive. */
export function ItemListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <ul aria-busy="true" aria-label="Loading" className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card">
      {Array.from({ length: rows }, (_, i) => (
        <li key={i} className="flex animate-pulse items-center gap-3 py-2.5 pr-3.5 pl-3.5" style={{ animationDelay: `${i * 120}ms` }}>
          <span className="size-11 shrink-0 rounded-xl bg-sunk" />
          <span className="flex min-w-0 flex-1 flex-col gap-2">
            <span className="h-3.5 rounded-full bg-sunk" style={{ width: `${[46, 34, 52, 40][i % 4]}%` }} />
            <span className="h-3 rounded-full bg-sunk/70" style={{ width: `${[28, 40, 24, 32][i % 4]}%` }} />
          </span>
          <span className="h-4 w-7 shrink-0 rounded-full bg-sunk" />
          <span className="size-10 shrink-0 rounded-xl bg-sunk/70" />
        </li>
      ))}
    </ul>
  );
}
