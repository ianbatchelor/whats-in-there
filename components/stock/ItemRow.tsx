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
  IconSnow,
  IconSprout,
  IconTin,
  IconWine,
  IconWrench,
} from "@/components/ui/icons";
import { useItemPhoto } from "@/lib/itemPhotos";

/**
 * The quiet line under a name: where it is and what it is. The date lives in the status label,
 * so it isn't repeated here unless there is nothing else to say.
 */
export function itemContext(item: StockItem, place?: string): string {
  const parts: string[] = [];
  if (place) parts.push(place);
  if (item.brand) parts.push(item.brand);
  if (item.weightValue && item.weightUnit) parts.push(formatQuantity(item.weightValue, item.weightUnit));
  if (parts.length > (place ? 1 : 0)) return parts.join(" · ");
  if (item.notes) parts.push(item.notes);
  else if (item.frozenAt) parts.push(`Frozen ${formatDay(item.frozenAt, { year: false })}`);
  else parts.push(`Added ${formatDay(item.addedAt, { year: false })}`);
  return parts.join(" · ");
}

const TONES: Record<StatusTone, string> = {
  late: "bg-late-bg text-late",
  soon: "bg-soon-bg text-soon",
  ok: "bg-ok-bg text-ok",
  plain: "bg-sunk text-mute",
};

/** The small coloured label that says whether a thing needs attention. */
export function StatusPill({ item, className = "" }: { item: StockItem; className?: string }) {
  const status = itemStatus(item);
  if (!status) return null;
  return (
    <span title={status.detail} className={`shrink-0 rounded-full px-2 py-[3px] text-[11.5px] leading-tight font-semibold whitespace-nowrap ${TONES[status.tone]} ${className}`}>
      {status.label}
    </span>
  );
}

const KINDS: Record<ItemKind, { Icon: (p: { className?: string }) => React.ReactNode; tint: string }> = {
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

/** The item's own photo when it has one; otherwise a small drawing of the kind of thing it is. */
export function ItemTile({ name, category, imagePath, size = 44 }: { name: string; category?: string | null; imagePath?: string | null; size?: number }) {
  const photo = useItemPhoto(imagePath);
  const [broken, setBroken] = useState<string | null>(null);
  if (photo && broken !== photo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photo}
        alt=""
        aria-hidden="true"
        loading="lazy"
        decoding="async"
        onError={() => setBroken(photo)}
        className="shrink-0 rounded-xl bg-sunk object-cover"
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

export function ItemRow({ item, place, onOpen, index = 0 }: { item: StockItem; place?: string; onOpen: (item: StockItem) => void; index?: number }) {
  const qty = roundQty(item.quantity);
  const status = itemStatus(item);
  return (
    <li className="rise" style={{ animationDelay: `${Math.min(index, 8) * 30}ms` }}>
      <button
        onClick={() => onOpen(item)}
        className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition hover:bg-sunk/70 active:bg-sunk"
        aria-label={`${item.productName}, ${formatQuantity(item.quantity, item.unit)}${place ? `, in ${place}` : ""}${status ? `. ${status.detail}` : ""}. Take out or see details`}
      >
        <ItemTile name={item.productName} category={item.category} imagePath={item.imagePath} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold">{item.productName}</span>
          <span className="mt-0.5 flex items-center gap-2">
            <StatusPill item={item} />
            <span className="min-w-0 truncate text-[13px] text-mute">{itemContext(item, place)}</span>
          </span>
        </span>
        <span className="min-w-9 shrink-0 text-right leading-tight">
          <span className="block text-[15px] font-semibold tabular-nums">{isCounted(item.unit) ? qty : formatQuantity(qty, item.unit)}</span>
          {isCounted(item.unit) ? <span className="block text-[11px] text-mute">{formatQuantity(qty, item.unit).replace(/^[\d.]+ /, "")}</span> : null}
        </span>
        <IconChevronRight className="size-4 shrink-0 text-mute/50" />
      </button>
    </li>
  );
}

/** The list container used everywhere items are shown. */
export function ItemList({ children }: { children: React.ReactNode }) {
  return <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card">{children}</ul>;
}
