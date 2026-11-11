import { parseIsoDate, storageAge, todayIso } from "./dates";

/** After this long, a lent thing gets a nudge on Home. */
export const LENT_NUDGE_DAYS = 30;

/** Whole days since something was lent, or null if we don't know when. */
export function daysLent(lentOn: string | null | undefined, today: string = todayIso()): number | null {
  const a = lentOn ? parseIsoDate(lentOn.slice(0, 10)) : null;
  const b = parseIsoDate(today);
  if (!a || !b) return null;
  return Math.max(0, Math.round((Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / 86_400_000));
}

/** Lent out long enough that it's worth asking for back. */
export function isLongLent(item: { lentTo?: string | null; lentOn?: string | null }, today: string = todayIso()): boolean {
  const days = daysLent(item.lentOn, today);
  return !!item.lentTo && days !== null && days >= LENT_NUDGE_DAYS;
}

/** "With Mum for 5 weeks" once it's been a while, otherwise "With Mum since 19 Oct" (shown by the caller). */
export function lentFor(lentOn: string | null | undefined, today: string = todayIso()): string {
  return lentOn ? storageAge(lentOn, today) : "";
}

/** A friendly message to send the borrower, by text or however they like. */
export function askBackMessage(thing: string, borrower: string): string {
  const first = borrower.trim().split(/\s+/)[0] || borrower.trim();
  return `Hi ${first}, hope you're enjoying ${thing}! Could I have it back when you're finished with it? Thanks`;
}
