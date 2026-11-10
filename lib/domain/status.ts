import type { StockItem } from "./stock";
import { SOON_DAYS } from "./stock";
import { formatDay, monthsBetween, parseIsoDate, storageAge, todayIso } from "./dates";

/**
 * How much attention a thing needs, from the dates people entered.
 * "late" is past a printed date, "soon" is close to one (or a long time in the freezer),
 * "ok" has a printed date comfortably ahead, "plain" only has a time in storage.
 * It states facts; the app never decides food is unsafe.
 */
export type StatusTone = "late" | "soon" | "ok" | "plain";
export type ItemStatus = { tone: StatusTone; label: string; /** Fuller wording for screen readers and details. */ detail: string };

type Dated = Pick<StockItem, "useByDate" | "bestBeforeDate" | "frozenAt">;

/** Months in the freezer after which the label turns amber as a nudge. */
export const LONG_FROZEN_MONTHS = 6;

export function daysBetween(a: string, b: string): number | null {
  const pa = parseIsoDate(a.slice(0, 10));
  const pb = parseIsoDate(b.slice(0, 10));
  if (!pa || !pb) return null;
  return Math.round((Date.UTC(pb.y, pb.m - 1, pb.d) - Date.UTC(pa.y, pa.m - 1, pa.d)) / 86_400_000);
}

function span(days: number): string {
  if (days === 1) return "1 day";
  if (days < 14) return `${days} days`;
  if (days < 60) return `${Math.floor(days / 7)} weeks`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} months`;
  return months < 24 ? "over a year" : `over ${Math.floor(months / 12)} years`;
}

export function itemStatus(item: Dated, today: string = todayIso()): ItemStatus | null {
  const printed = [
    item.useByDate ? { date: item.useByDate, kind: "use by" } : null,
    item.bestBeforeDate ? { date: item.bestBeforeDate, kind: "best before" } : null,
  ]
    .filter((d): d is { date: string; kind: string } => d !== null)
    .sort((a, b) => a.date.localeCompare(b.date))[0];

  if (printed) {
    const days = daysBetween(today, printed.date);
    if (days !== null) {
      const full = `${printed.kind === "use by" ? "Use by" : "Best before"} ${formatDay(printed.date)}`;
      if (days < 0) return { tone: "late", label: `${span(-days)} past`, detail: full };
      if (days === 0) return { tone: "soon", label: "Use today", detail: full };
      if (days === 1) return { tone: "soon", label: "Use by tomorrow", detail: full };
      if (days <= SOON_DAYS) return { tone: "soon", label: `Use in ${days} days`, detail: full };
      const sameYear = printed.date.slice(0, 4) === today.slice(0, 4);
      const short = sameYear ? formatDay(printed.date, { year: false }) : formatDay(printed.date).slice(3);
      return { tone: "ok", label: short, detail: full };
    }
  }
  if (item.frozenAt) {
    const age = storageAge(item.frozenAt, today);
    if (!age) return null;
    const long = monthsBetween(item.frozenAt.slice(0, 10), today) >= LONG_FROZEN_MONTHS;
    const detail = `Frozen ${formatDay(item.frozenAt)}`;
    return { tone: long ? "soon" : "plain", label: age === "today" ? "Frozen today" : `${age} in`, detail };
  }
  return null;
}

/** Things that deserve a look: past a printed date or close to one. Long-frozen things are a nudge, not counted here. */
export function needsAttention(item: Dated, today: string = todayIso()): boolean {
  const s = itemStatus(item, today);
  return !!s && (s.tone === "late" || (s.tone === "soon" && !!(item.useByDate || item.bestBeforeDate)));
}
