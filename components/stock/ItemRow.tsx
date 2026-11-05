"use client";

import { useState } from "react";
import type { StockItem } from "@/lib/domain/stock";
import { formatDay, storageAge } from "@/lib/domain/dates";
import { formatQuantity, isCounted, roundQty } from "@/lib/domain/quantity";
import { IconChevronRight } from "@/components/ui/icons";
import { useItemPhoto } from "@/lib/itemPhotos";

/** The one line of context under a name: the most useful date, stated as a fact. */
export function itemContext(item: StockItem, freezer = true): string {
  if (item.useByDate) return `Use by ${formatDay(item.useByDate)}`;
  if (item.bestBeforeDate) return `Best before ${formatDay(item.bestBeforeDate)}`;
  if (item.frozenAt && freezer) return `Frozen ${formatDay(item.frozenAt)} · ${storageAge(item.frozenAt)}`;
  if (item.notes) return item.notes;
  return `Added ${formatDay(item.addedAt)}`;
}

const TILES = [
  "bg-[#f6e3b4] text-[#6b4a0e]",
  "bg-[#d7e7d9] text-[#183f32]",
  "bg-[#f1d9cb] text-[#7a3a20]",
  "bg-[#dde5ea] text-[#2c4552]",
  "bg-[#e8dff0] text-[#4b3566]",
  "bg-[#efe4d2] text-[#5b3a23]",
];

/** The item's own photo when it has one; otherwise a monogram tile: warm, varied, and never a stock emoji. */
export function ItemTile({ name, imagePath, size = 48 }: { name: string; imagePath?: string | null; size?: number }) {
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
        className="shrink-0 rounded-[14px] bg-sunk object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  const letters = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join("");
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return (
    <span
      aria-hidden="true"
      className={`inline-grid shrink-0 place-items-center rounded-[14px] font-display font-extrabold ${TILES[h % TILES.length]}`}
      style={{ width: size, height: size, fontSize: size * 0.34 }}
    >
      {letters || "?"}
    </span>
  );
}

export function ItemRow({ item, place, onOpen, index = 0 }: { item: StockItem; place?: string; onOpen: (item: StockItem) => void; index?: number }) {
  const qty = roundQty(item.quantity);
  return (
    <li className="rise" style={{ animationDelay: `${Math.min(index, 8) * 30}ms` }}>
      <button
        onClick={() => onOpen(item)}
        className="flex w-full items-center gap-3.5 px-3.5 py-3 text-left transition hover:bg-sunk/70 active:bg-sunk"
        aria-label={`${item.productName}, ${formatQuantity(item.quantity, item.unit)}${place ? `, in ${place}` : ""}. Take out or see details`}
      >
        <ItemTile name={item.productName} imagePath={item.imagePath} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-display text-[15.5px] font-bold">{item.productName}</span>
          <span className="block truncate text-[13px] text-mute">
            {place ? <span className="font-semibold text-leaf">{place} · </span> : null}
            {itemContext(item)}
          </span>
        </span>
        <span className="shrink-0 text-right">
          <span className="block font-display text-lg leading-none font-extrabold tabular-nums">
            {isCounted(item.unit) ? qty : formatQuantity(qty, item.unit)}
          </span>
          {isCounted(item.unit) ? (
            <span className="text-[11px] text-mute">{formatQuantity(qty, item.unit).replace(/^[\d.]+ /, "")}</span>
          ) : null}
        </span>
        <IconChevronRight className="size-4 shrink-0 text-mute/60" />
      </button>
    </li>
  );
}

/** The list container used everywhere items are shown. */
export function ItemList({ children }: { children: React.ReactNode }) {
  return <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-card shadow-[var(--shadow-card)]">{children}</ul>;
}
