/**
 * Wine in a wine rack: colour, vintage and a "best to drink" window in years. The window is people's
 * own (or the label reader's estimate), so the wording says what's best, never what's safe.
 */

export type WineColour = "red" | "white" | "rose" | "sparkling" | "sweet" | "fortified";

export type WineDetails = {
  vintage: number | null;
  wineColour: WineColour | null;
  grape: string | null;
  region: string | null;
  drinkFrom: number | null;
  drinkUntil: number | null;
  savedFor: string | null;
};

export const NO_WINE: WineDetails = {
  vintage: null,
  wineColour: null,
  grape: null,
  region: null,
  drinkFrom: null,
  drinkUntil: null,
  savedFor: null,
};

export const WINE_COLOURS: {
  value: WineColour;
  label: string;
  /** Fill of the dot and bottle. */ dot: string;
}[] = [
  { value: "red", label: "Red", dot: "#7a2335" },
  { value: "white", label: "White", dot: "#d9c25e" },
  { value: "rose", label: "Rosé", dot: "#e99aa6" },
  { value: "sparkling", label: "Fizz", dot: "#b5ae86" },
  { value: "sweet", label: "Sweet", dot: "#c8862a" },
  { value: "fortified", label: "Port & sherry", dot: "#5a2a1c" },
];

export function isWineColour(v: unknown): v is WineColour {
  return WINE_COLOURS.some((c) => c.value === v);
}

export function colourInfo(c: WineColour | null | undefined) {
  return WINE_COLOURS.find((x) => x.value === c) ?? null;
}

type Windowed = {
  drinkFrom?: number | null;
  drinkUntil?: number | null;
  savedFor?: string | null;
};

export function hasWineStatus(w: Windowed): boolean {
  return !!(w.savedFor || w.drinkFrom || w.drinkUntil);
}

export type WineTone = "late" | "soon" | "ok" | "plain";

/** Where a bottle is in its drinking window this year. Null when nobody has said. */
export function wineStatus(w: Windowed, year: number): { tone: WineTone; label: string; detail: string; saved?: boolean } | null {
  const from = w.drinkFrom ?? null;
  const until = w.drinkUntil ?? null;
  const window = from && until ? `Best ${from} to ${until}` : until ? `Best by ${until}` : from ? `Best from ${from}` : "";
  if (w.savedFor)
    return {
      tone: "plain",
      label: `Saved for ${w.savedFor}`,
      detail: window || `Saved for ${w.savedFor}`,
      saved: true,
    };
  if (until !== null && until < year) return { tone: "late", label: `Past its best · ${until}`, detail: window };
  if (until !== null && until === year) return { tone: "soon", label: `Drink by end of ${until}`, detail: window };
  if (from !== null && from > year) return { tone: "plain", label: `Keep until ${from}`, detail: window };
  if (until !== null) return { tone: "ok", label: `Ready now · until ${until}`, detail: window };
  if (from !== null) return { tone: "ok", label: "Ready now", detail: window };
  return null;
}

/** Bottles worth opening soon: at or past the end of their window, and not saved for something. */
export function drinkSoon(w: Windowed, year: number): boolean {
  return !w.savedFor && w.drinkUntil != null && w.drinkUntil <= year;
}

/**
 * "Drink these first" order key: past their best and last-year bottles first (earliest end first),
 * then ones ready now (soonest end first), then ones to keep, then ones with no window, and bottles
 * saved for something last. Food sorts by "0"/"1" keys, so wine slots in beside it.
 */
export function wineKey(w: Windowed, year: number): string | null {
  if (w.savedFor) return "3";
  const until = w.drinkUntil ?? null;
  const from = w.drinkFrom ?? null;
  if (until !== null && until <= year) return `0${until}-12-31`;
  if (from !== null && from > year) return `2${from}`;
  if (until !== null) return `1${until}`;
  return null;
}

/** "Château Musar 2016": the vintage after the name, unless the name already has it. */
export function wineTitle(name: string, vintage: number | null | undefined): string {
  if (!vintage || name.includes(String(vintage))) return name;
  return `${name} ${vintage}`;
}

/** "Tempranillo · Rioja, Spain". */
export function wineLine(w: { grape?: string | null; region?: string | null; brand?: string | null }): string {
  return [w.grape, w.region].filter(Boolean).join(" · ") || w.brand || "";
}

/** Bottles of each colour, in the fixed colour order, leaving out colours with none. */
export function colourCounts(items: { wineColour?: WineColour | null; quantity: number }[]): { colour: WineColour | null; n: number }[] {
  const counts = new Map<WineColour | null, number>();
  for (const i of items) counts.set(i.wineColour ?? null, (counts.get(i.wineColour ?? null) ?? 0) + i.quantity);
  const out: { colour: WineColour | null; n: number }[] = WINE_COLOURS.filter((c) => counts.get(c.value)).map((c) => ({
    colour: c.value,
    n: counts.get(c.value)!,
  }));
  if (counts.get(null)) out.push({ colour: null, n: counts.get(null)! });
  return out;
}

/** A year typed into a form: a whole number in a sensible range, or null when empty. "bad" when it isn't a year. */
export function parseYear(v: string): number | null | "bad" {
  const t = v.trim();
  if (!t) return null;
  if (!/^\d{4}$/.test(t)) return "bad";
  const n = Number(t);
  return n >= 1900 && n <= 2200 ? n : "bad";
}

/** Checks a label reading's wine part. Nothing from the model is trusted as-is. */
export function readWine(raw: unknown, thisYear: number): (WineDetails & { guessed: boolean }) | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const year = (v: unknown, lo: number, hi: number) => (typeof v === "number" && Number.isInteger(v) && v >= lo && v <= hi ? v : null);
  const text = (v: unknown) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, 80) || null : null);
  const vintage = year(r.vintage, 1900, thisYear);
  let drinkFrom = year(r.drink_from, 1900, 2200);
  let drinkUntil = year(r.drink_until, 1900, 2200);
  if (drinkFrom && drinkUntil && drinkFrom > drinkUntil) [drinkFrom, drinkUntil] = [drinkUntil, drinkFrom];
  return {
    vintage,
    wineColour: isWineColour(r.colour) ? r.colour : null,
    grape: text(r.grape),
    region: text(r.region),
    drinkFrom,
    drinkUntil,
    savedFor: null,
    guessed: !!(drinkFrom || drinkUntil),
  };
}

/**
 * The wine rack's own order: like "Drink these first" everywhere, but bottles with no window sit
 * after the ones ready now (they're usually everyday wine) and before ones to keep.
 */
export function sortRack<T extends Windowed & { addedAt: string }>(items: T[], year: number): T[] {
  const key = (w: T) => wineKey(w, year) ?? "1~";
  return [...items].sort((a, b) => {
    const ka = key(a);
    const kb = key(b);
    return ka < kb ? -1 : ka > kb ? 1 : a.addedAt < b.addedAt ? -1 : 1;
  });
}
