import type { StockUnit } from "./quantity";

export type StockItem = {
  id: string;
  locationId: string;
  productName: string;
  brand: string | null;
  category: string | null;
  quantity: number;
  unit: StockUnit;
  weightValue: number | null;
  weightUnit: StockUnit | null;
  useByDate: string | null;
  bestBeforeDate: string | null;
  frozenAt: string | null;
  addedAt: string;
  addedBy: string | null;
  notes: string | null;
  /** Private storage path of the label photo, when the item was added from one. */
  imagePath?: string | null;
  version: number;
};

type Dated = Pick<StockItem, "useByDate" | "bestBeforeDate" | "frozenAt" | "addedAt">;

/** Days ahead within which a printed date jumps the queue. */
export const SOON_DAYS = 14;

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * "Use first" order: anything whose printed use-by or best-before date is close (or past) comes
 * first, soonest first; everything else is the longest stored first. The app never decides food is
 * unsafe; it only sorts by the dates people entered.
 */
export function useFirstKey(item: Dated, today: string): string {
  const printed = [item.useByDate, item.bestBeforeDate].filter(Boolean).sort()[0];
  if (printed && printed <= addDays(today, SOON_DAYS)) return `0${printed}`;
  return `1${(item.frozenAt ?? item.addedAt).slice(0, 10)}`;
}

export function sortUseFirst<T extends Dated>(items: T[], today: string = new Date().toISOString().slice(0, 10)): T[] {
  return [...items].sort((a, b) => {
    const ka = useFirstKey(a, today);
    const kb = useFirstKey(b, today);
    return ka < kb ? -1 : ka > kb ? 1 : a.addedAt < b.addedAt ? -1 : 1;
  });
}

/**
 * Builds an ilike pattern for a PostgREST or() filter. Commas, brackets and quotes would break the
 * filter syntax, so they become spaces; % and _ are escaped so "50%" doesn't match everything.
 */
export function likePattern(query: string): string {
  const cleaned = query.replace(/[(),"'*]/g, " ").replace(/\s+/g, " ").trim();
  return `%${cleaned.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}
