/**
 * Dates are stored as ISO calendar dates (YYYY-MM-DD) and always shown as "3 Nov 2026",
 * never 03/11, so UK and US readers cannot misread them.
 */
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseIsoDate(value: string): { y: number; m: number; d: number } | null {
  const match = ISO_DATE.exec(value);
  if (!match) return null;
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const probe = new Date(Date.UTC(y, m - 1, d));
  if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== m - 1 || probe.getUTCDate() !== d) return null;
  return { y, m, d };
}

export function formatDay(value: string | null | undefined, opts: { year?: boolean } = {}): string {
  if (!value) return "";
  const p = parseIsoDate(value.slice(0, 10));
  if (!p) return "";
  return opts.year === false ? `${p.d} ${MONTHS[p.m - 1]}` : `${p.d} ${MONTHS[p.m - 1]} ${p.y}`;
}

/** "Nov 2026": for dates far enough ahead that the day doesn't matter. */
export function formatMonth(value: string | null | undefined): string {
  if (!value) return "";
  const p = parseIsoDate(value.slice(0, 10));
  return p ? `${MONTHS[p.m - 1]} ${p.y}` : "";
}

/** Today's date in the user's local time zone, as YYYY-MM-DD. */
export function todayIso(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Whole calendar months between two ISO dates (b later than a). Used for "Frozen 5 months ago". */
export function monthsBetween(a: string, b: string): number {
  const pa = parseIsoDate(a);
  const pb = parseIsoDate(b);
  if (!pa || !pb) return 0;
  let months = (pb.y - pa.y) * 12 + (pb.m - pa.m);
  if (pb.d < pa.d) months -= 1;
  return Math.max(0, months);
}

/** Plain description of time in storage. States a fact; never a safety verdict. */
export function storageAge(since: string | null | undefined, today: string = todayIso()): string {
  if (!since) return "";
  const months = monthsBetween(since.slice(0, 10), today);
  if (months >= 12) {
    const years = Math.floor(months / 12);
    return years === 1 ? "over a year" : `over ${years} years`;
  }
  if (months >= 1) return months === 1 ? "1 month" : `${months} months`;
  const pa = parseIsoDate(since.slice(0, 10));
  const pb = parseIsoDate(today);
  if (!pa || !pb) return "";
  const days = Math.round((Date.UTC(pb.y, pb.m - 1, pb.d) - Date.UTC(pa.y, pa.m - 1, pa.d)) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "1 day";
  if (days < 14) return `${days} days`;
  return `${Math.floor(days / 7)} weeks`;
}

/** "just now", "2h ago", "yesterday", "Mon", "3 Nov": short and human. */
export function timeAgo(iso: string, now: Date = new Date()): string {
  const then = new Date(iso);
  const mins = Math.round((now.getTime() - then.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (then.getTime() >= startOfToday) return `${Math.round(mins / 60)}h ago`;
  if (then.getTime() >= startOfToday - 86400000) return "yesterday";
  if (then.getTime() >= startOfToday - 6 * 86400000) return then.toLocaleDateString("en-GB", { weekday: "short" });
  return then.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
