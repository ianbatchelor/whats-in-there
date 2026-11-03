export type StockUnit = "item" | "portion" | "pack" | "g" | "kg" | "ml" | "l";

const COUNTED: ReadonlySet<StockUnit> = new Set(["item", "portion", "pack"]);

export function isCounted(unit: StockUnit): boolean {
  return COUNTED.has(unit);
}

/** Quantities are numeric(10,3) in the database; round the same way to avoid 0.1 + 0.2 surprises. */
export function roundQty(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export type RemovalCheck = { ok: true; remaining: number } | { ok: false; reason: "invalid_amount" | "insufficient_quantity" };

/** Mirrors remove_stock() so the app can explain a problem before calling the server. The server still decides. */
export function checkRemoval(current: number, amount: number, unit: StockUnit): RemovalCheck {
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, reason: "invalid_amount" };
  if (isCounted(unit) && !Number.isInteger(amount * 2)) return { ok: false, reason: "invalid_amount" }; // halves allowed
  if (roundQty(amount) > roundQty(current)) return { ok: false, reason: "insufficient_quantity" };
  return { ok: true, remaining: roundQty(current - amount) };
}

const UNIT_WORDS: Record<StockUnit, [string, string]> = {
  item: ["item", "items"],
  portion: ["portion", "portions"],
  pack: ["pack", "packs"],
  g: ["g", "g"],
  kg: ["kg", "kg"],
  ml: ["ml", "ml"],
  l: ["l", "l"],
};

export function formatQuantity(value: number, unit: StockUnit): string {
  const n = roundQty(value);
  const text = Number.isInteger(n) ? String(n) : String(n).replace(/0+$/, "");
  const [one, many] = UNIT_WORDS[unit];
  if (isCounted(unit)) return `${text} ${n === 1 ? one : many}`;
  return `${text} ${one}`;
}
