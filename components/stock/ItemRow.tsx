import type { StockItem } from "@/lib/domain/stock";
import { formatDay, storageAge } from "@/lib/domain/dates";
import { formatQuantity, isCounted, roundQty } from "@/lib/domain/quantity";

/** The one line of context under a name: the most useful date, stated as a fact. */
export function itemContext(item: StockItem): string {
  if (item.useByDate) return `Use by ${formatDay(item.useByDate)}`;
  if (item.bestBeforeDate) return `Best before ${formatDay(item.bestBeforeDate)}`;
  if (item.frozenAt) return `Frozen ${formatDay(item.frozenAt)} · ${storageAge(item.frozenAt)}`;
  return `Added ${formatDay(item.addedAt)}`;
}

export function ItemRow({ item, place, onOpen }: { item: StockItem; place?: string; onOpen: (item: StockItem) => void }) {
  const qty = roundQty(item.quantity);
  const counted = isCounted(item.unit);
  return (
    <li>
      <button
        onClick={() => onOpen(item)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition active:bg-ice/60"
        aria-label={`${item.productName}, ${formatQuantity(item.quantity, item.unit)}. Take out or see details`}
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate font-display text-[15px] font-bold">{item.productName}</span>
          <span className="block truncate font-mono text-[12px] text-mute">
            {place ? `${place} · ` : ""}
            {itemContext(item)}
          </span>
        </span>
        <span className="shrink-0 text-right">
          <span className="block font-display text-xl leading-none font-extrabold tabular-nums">
            {counted ? (Number.isInteger(qty) ? qty : qty.toString()) : formatQuantity(qty, item.unit)}
          </span>
          {counted ? <span className="text-[11px] text-mute">{qty === 1 ? item.unit : `${item.unit === "item" ? "items" : `${item.unit}s`}`}</span> : null}
        </span>
      </button>
    </li>
  );
}
