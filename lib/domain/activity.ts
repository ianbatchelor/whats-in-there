import { formatQuantity, roundQty, type StockUnit } from "./quantity";

type Row = { action: "add" | "remove" | "adjust" | "move" | "undo"; delta: number; itemName: string; unit: StockUnit; at: string };

/** "added 2 portions of Chicken curry", read after the person's name. */
export function activitySentence(r: Row): string {
  const n = roundQty(Math.abs(r.delta));
  // Plain items read better without the unit: "added 4 × Chicken breasts", "took out Leg of lamb".
  // A lone "l" is easy to misread in a sentence ("1 l of milk"), so litres are spelled out here.
  const amount = r.unit === "l" ? `${formatQuantity(n, r.unit).slice(0, -2)} ${n === 1 ? "litre" : "litres"}` : formatQuantity(n, r.unit);
  const what = r.unit === "item" ? (n === 1 ? r.itemName : `${n} × ${r.itemName}`) : `${amount} of ${r.itemName}`;
  switch (r.action) {
    case "add":
      return `added ${what}`;
    case "remove":
      return `took out ${what}`;
    case "undo":
      return `undid a change to ${r.itemName}`;
    case "move":
      return `moved ${r.itemName}`;
    default:
      return `changed the amount of ${r.itemName}`;
  }
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/** Splits newest-first rows into Today, Yesterday and dated groups. */
export function groupByDay<T extends { at: string }>(rows: T[], now: Date = new Date()): { label: string; rows: T[] }[] {
  const today = dayKey(now);
  const y = new Date(now);
  y.setDate(y.getDate() - 1);
  const yesterday = dayKey(y);
  const out: { key: string; label: string; rows: T[] }[] = [];
  for (const r of rows) {
    const d = new Date(r.at);
    const key = dayKey(d);
    let g = out[out.length - 1];
    if (!g || g.key !== key) {
      const label =
        key === today ? "Today" : key === yesterday ? "Yesterday" : d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
      g = { key, label, rows: [] };
      out.push(g);
    }
    g.rows.push(r);
  }
  return out.map(({ label, rows }) => ({ label, rows }));
}
