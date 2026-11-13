import type { StockUnit } from "./quantity";
import { readWine, type WineDetails } from "./wine";

/** Fields the label reader can fill in. Names match the Edge Function's JSON output. */
export const EXTRACT_FIELDS = ["product_name", "brand", "quantity", "weight", "use_by_date", "best_before_date", "vintage", "grape", "region"] as const;
export type ExtractField = (typeof EXTRACT_FIELDS)[number];

const UNITS: readonly StockUnit[] = ["item", "portion", "pack", "g", "kg", "ml", "l"];
const WEIGHT_UNITS: readonly StockUnit[] = ["g", "kg", "ml", "l"];

/** What the add form gets back: every value checked, anything doubtful listed in `check`. */
export type LabelReading = {
  productName: string;
  brand: string;
  quantity: number;
  unit: StockUnit;
  weightValue: number | null;
  weightUnit: StockUnit | null;
  useByDate: string | null;
  bestBeforeDate: string | null;
  check: ExtractField[];
  /** For a bottle of wine. `guessed` says the drinking window is the reader's estimate. */
  wine: (WineDetails & { guessed: boolean }) | null;
};

function text(v: unknown, max: number): string {
  return typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

function positive(v: unknown, max: number): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) && n > 0 && n <= max ? Math.round(n * 1000) / 1000 : null;
}

/** A real calendar date in YYYY-MM-DD, no more than a year in the past or ten years ahead. */
export function validDate(v: unknown, today: string): string | null {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(`${v}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v) return null;
  const t = new Date(`${today}T00:00:00Z`).getTime();
  const days = (d.getTime() - t) / 86_400_000;
  return days >= -366 && days <= 3653 ? v : null;
}

/**
 * Turns the reader's raw JSON into form values. Nothing from the model is trusted as-is: text is
 * trimmed and capped, numbers and units are range-checked, and impossible dates are dropped. A field
 * the model marked uncertain, or one that failed a check, is listed in `check` so the form can ask
 * the person to look at it. Returns null when there's no product name to work with.
 */
export function readLabel(raw: unknown, today: string): LabelReading | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (r.readable === false) return null;
  const productName = text(r.product_name, 120);
  if (!productName) return null;

  const check = new Set<ExtractField>(
    Array.isArray(r.uncertain) ? r.uncertain.filter((f): f is ExtractField => EXTRACT_FIELDS.includes(f as ExtractField)) : [],
  );

  const unit = UNITS.includes(r.unit as StockUnit) ? (r.unit as StockUnit) : "item";
  let quantity = positive(r.quantity, unit === "g" || unit === "ml" ? 100_000 : 999);
  if (quantity === null) {
    quantity = 1;
    if (r.quantity !== null && r.quantity !== undefined) check.add("quantity");
  }
  if (unit === "item" || unit === "portion" || unit === "pack") quantity = Math.max(1, Math.round(quantity));

  const weightUnit = WEIGHT_UNITS.includes(r.weight_unit as StockUnit) ? (r.weight_unit as StockUnit) : null;
  const weightValue = weightUnit ? positive(r.weight_value, 100_000) : null;
  if ((r.weight_value != null || r.weight_unit != null) && (weightValue === null || weightUnit === null)) check.add("weight");

  const useByDate = validDate(r.use_by_date, today);
  if (r.use_by_date != null && !useByDate) check.add("use_by_date");
  const bestBeforeDate = validDate(r.best_before_date, today);
  if (r.best_before_date != null && !bestBeforeDate) check.add("best_before_date");

  return {
    productName,
    brand: text(r.brand, 80),
    quantity,
    unit,
    weightValue: weightUnit ? weightValue : null,
    weightUnit: weightValue ? weightUnit : null,
    useByDate,
    bestBeforeDate,
    check: EXTRACT_FIELDS.filter((f) => check.has(f)),
    wine: readWine(r.wine, Number(today.slice(0, 4))),
  };
}

/** Short codes the label reader returns, in plain English. */
const READER_ERRORS: Record<string, string> = {
  not_signed_in: "You've been signed out. Sign in again to carry on.",
  not_member: "That photo isn't in one of your households.",
  too_many_today: "Your household has read a lot of labels today. Fill this one in yourself, and photos will work again tomorrow.",
  too_many_this_month: "You've read a lot of labels this month. Fill this one in yourself for now.",
  too_many_now: "That's a lot of photos in a row. Wait a minute, or fill this one in yourself.",
  image_too_large: "That photo is too big. Try again a little further away.",
  unreadable: "We couldn't read a label in that photo. Try again closer up, or fill it in below.",
  not_configured: "Reading labels isn't switched on yet. Fill it in below for now.",
};

export function readerError(code: string | null | undefined): string {
  return (code && READER_ERRORS[code]) || "We couldn't read that label just now. Fill it in below, or try another photo.";
}
