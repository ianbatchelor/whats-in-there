import type { StockUnit } from "./quantity";
import { isCounted } from "./quantity";

export type ShoppingItem = {
  id: string;
  name: string;
  brand: string | null;
  category: string | null;
  quantity: number;
  unit: StockUnit;
  locationId: string | null;
  addedBy: string | null;
  addedAt: string;
  boughtAt: string | null;
  boughtBy: string | null;
};

/** What goes on the list when you run out of something: one of it, in the same kind of amount. */
export function fromStock(item: { productName: string; brand: string | null; category: string | null; unit: StockUnit; locationId: string }) {
  const counted = isCounted(item.unit);
  return {
    name: item.productName.trim().slice(0, 120),
    brand: item.brand,
    category: item.category,
    quantity: 1,
    unit: counted ? item.unit : ("item" as StockUnit),
    locationId: item.locationId,
  };
}

/** Still to buy first, oldest first, so the list reads in the order things ran out; then what's in the basket. */
export function splitList(items: ShoppingItem[]): { toBuy: ShoppingItem[]; bought: ShoppingItem[] } {
  const toBuy = items.filter((i) => !i.boughtAt).sort((a, b) => a.addedAt.localeCompare(b.addedAt));
  const bought = items.filter((i) => i.boughtAt).sort((a, b) => (b.boughtAt ?? "").localeCompare(a.boughtAt ?? ""));
  return { toBuy, bought };
}

/** "Milk, Eggs and 3 more" for the Home card. */
export function listPreview(names: string[], max = 3): string {
  if (names.length === 0) return "";
  if (names.length <= max) return names.length === 1 ? names[0]! : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
  return `${names.slice(0, max).join(", ")} and ${names.length - max} more`;
}

/** Whether a database error means it's already on the list. */
export function isAlreadyOnList(error: unknown): boolean {
  const e = error as { code?: string; message?: string } | null;
  return !!e && (e.code === "23505" || /shopping_items_once_idx/.test(e.message ?? ""));
}
