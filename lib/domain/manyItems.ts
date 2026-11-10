/**
 * Many things from one photo: a bookshelf, a wardrobe rail, a drawer of games. The reader returns a
 * list; nothing from it is trusted as-is, and nothing is saved until the person has checked it.
 */

export type ListKind = "books" | "clothes" | "shoes" | "games" | "music" | "films" | "food" | "tools" | "mixed" | "other";
const KINDS: readonly ListKind[] = ["books", "clothes", "shoes", "games", "music", "films", "food", "tools", "mixed", "other"];

/** One line of the review list. `key` is only for React; `include` is the tick box. */
export type ListItem = {
  key: string;
  name: string;
  /** A book's author, or a brand. Saved as the item's brand. */
  detail: string;
  category: string;
  quantity: number;
  /** The reader guessed part of it, or the print was hard to read. */
  unsure: boolean;
  /** Something with this name is already recorded in the place. */
  already: boolean;
  include: boolean;
};

export const OTHER = "Other";

function text(v: unknown, max: number): string {
  return typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

const same = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const sameThing = (a: { name: string; detail: string }, b: { name: string; detail: string }) =>
  same(a.name) === same(b.name) && same(a.detail) === same(b.detail);

let counter = 0;
export const newKey = () => `i${Date.now().toString(36)}${(counter++).toString(36)}`;

/**
 * Checks the reader's list: names trimmed and capped, quantities whole and sensible, categories
 * short, and the same thing listed twice (photos that overlap) merged into one line.
 */
export function readList(raw: unknown): { kind: ListKind; items: ListItem[] } | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (!Array.isArray(r.items)) return null;
  const kind = KINDS.includes(r.kind as ListKind) ? (r.kind as ListKind) : "other";
  const items: ListItem[] = [];
  for (const entry of r.items.slice(0, 150)) {
    if (!entry || typeof entry !== "object") continue;
    const e = entry as Record<string, unknown>;
    const name = text(e.name, 120);
    if (!name) continue;
    const detail = text(e.detail, 80);
    const category = text(e.category, 40) || OTHER;
    const q = typeof e.quantity === "number" && Number.isFinite(e.quantity) ? Math.round(e.quantity) : 1;
    const quantity = Math.min(99, Math.max(1, q));
    const unsure = e.unsure === true;
    const twin = items.find((i) => sameThing(i, { name, detail }));
    if (twin) {
      twin.quantity = Math.min(99, twin.quantity + quantity);
      twin.unsure ||= unsure;
      continue;
    }
    items.push({ key: newKey(), name, detail, category, quantity, unsure, already: false, include: true });
  }
  return items.length ? { kind, items } : null;
}

/**
 * Lines that match something already recorded in the place (same name and same author or brand)
 * start unticked, so photographing a shelf twice doesn't double it.
 */
export function markAlreadyHere(items: ListItem[], existing: { productName: string; brand: string | null }[]): ListItem[] {
  return items.map((i) => {
    const already = existing.some((x) => same(x.productName) === same(i.name) && (!x.brand || !i.detail || same(x.brand) === same(i.detail)));
    return already ? { ...i, already, include: false } : i;
  });
}

/** Adds a second photo's things to the list, merging any that were already listed. */
export function mergeLists(current: ListItem[], more: ListItem[]): ListItem[] {
  const out = current.map((i) => ({ ...i }));
  for (const m of more) {
    if (out.some((i) => sameThing(i, m))) continue;
    out.push(m);
  }
  return out;
}

/** "Hilary Mantel" sorts under M, "J.R.R. Tolkien" under T. */
export function surname(person: string): string {
  const words = person.trim().split(/\s+/);
  return (words[words.length - 1] ?? "").toLowerCase();
}

/** Titles sort without a leading "The", "A" or "An", as in a bookshop. */
export function titleKey(title: string): string {
  return title.trim().toLowerCase().replace(/^(the|a|an)\s+/, "");
}

type Sortable = { name: string; detail: string; category: string };

function compareWithin(a: Sortable, b: Sortable, byAuthor: boolean): number {
  if (byAuthor) {
    const s = (a.detail ? surname(a.detail) : "~").localeCompare(b.detail ? surname(b.detail) : "~");
    if (s) return s;
  }
  return titleKey(a.name).localeCompare(titleKey(b.name));
}

/**
 * Groups things by category for a sensible order: categories A to Z with "Other" last, books by
 * author's surname then title, everything else by name.
 */
export function groupByCategory<T>(
  items: T[],
  view: (t: T) => Sortable,
  byAuthor: boolean,
  /** False keeps the order within each group as given, so a list being edited doesn't jump about. */
  sortWithin = true,
): { category: string; items: T[] }[] {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const c = view(item).category.trim() || OTHER;
    groups.set(c, [...(groups.get(c) ?? []), item]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => (a === OTHER ? 1 : b === OTHER ? -1 : a.localeCompare(b)))
    .map(([category, list]) => ({ category, items: sortWithin ? [...list].sort((x, y) => compareWithin(view(x), view(y), byAuthor)) : list }));
}

/** Book sections sort by author; a list counts as books when most of it looks like books. */
const BOOK_SECTIONS = /\b(fiction|crime|thrillers?|sci-fi|fantasy|children's|biography|memoir|history|cookery|travel|nature|poetry|reference|philosophy|religion|art & design|health & wellbeing|business|books?|novels?)\b/i;
export function looksLikeBooks(categories: string[]): boolean {
  if (!categories.length) return false;
  return categories.filter((c) => BOOK_SECTIONS.test(c)).length * 2 > categories.length;
}

/** Words for the review screen. */
export function kindWords(kind: ListKind): { one: string; many: string } {
  switch (kind) {
    case "books":
      return { one: "book", many: "books" };
    case "clothes":
    case "shoes":
      return { one: "thing", many: "things" };
    case "games":
      return { one: "game", many: "games" };
    case "films":
      return { one: "film", many: "films" };
    case "music":
      return { one: "record", many: "records" };
    default:
      return { one: "thing", many: "things" };
  }
}

/** Short codes from the reader, in plain English, for whole-shelf photos. */
const LIST_ERRORS: Record<string, string> = {
  not_signed_in: "You've been signed out. Sign in again to carry on.",
  not_member: "That photo isn't in one of your households.",
  too_many_today: "Your household has read a lot of photos today. Photos will work again tomorrow.",
  too_many_this_month: "You've read a lot of photos this month, so this one can't be read for now.",
  too_many_now: "That's a lot of photos in a row. Wait a minute, then try again.",
  image_too_large: "That photo is too big. Try again a little further away.",
  unreadable: "We couldn't make out separate things in that photo. Try again in better light, a little closer, with spines or labels facing you.",
  not_configured: "Reading whole shelves isn't switched on yet.",
  needs_update: "Reading whole shelves needs the latest update to the photo reader on the server.",
};

export function listError(code: string | null | undefined): string {
  return (code && LIST_ERRORS[code]) || "We couldn't read that photo just now. Try again in a moment.";
}
