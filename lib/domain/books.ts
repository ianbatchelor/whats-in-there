/** Book wish lists: the books each reader wants to read, built on the present lists. */

import { firstName } from "./presents";

export type BookSort = "wanted" | "newest" | "author" | "title";

export const BOOK_SORTS: { key: BookSort; label: string }[] = [
  { key: "wanted", label: "Most wanted" },
  { key: "newest", label: "Newest" },
  { key: "author", label: "Author" },
  { key: "title", label: "Title" },
];

type Sortable = { title: string; author: string | null; favourite: boolean; addedAt: string };

/** "The Sea, the Sea" files under S, as in a bookshop. */
export function titleKey(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/^(the|a|an)\s+/, "");
}

/** Authors file by surname: "Hilary Mantel" under M. Books with no author go last. */
export function authorKey(author: string | null): string {
  const first = author?.replace(/\s+and others$/i, "").split(/\s+and\s+|,|;|&/)[0]?.trim() ?? "";
  if (!first) return "￿";
  const words = first.split(/\s+/);
  return `${words[words.length - 1]} ${words.slice(0, -1).join(" ")}`.toLowerCase();
}

export function sortBooks<T extends Sortable>(books: T[], by: BookSort): T[] {
  const list = [...books];
  switch (by) {
    case "newest":
      return list.sort((a, b) => b.addedAt.localeCompare(a.addedAt));
    case "author":
      return list.sort((a, b) => authorKey(a.author).localeCompare(authorKey(b.author)) || titleKey(a.title).localeCompare(titleKey(b.title)));
    case "title":
      return list.sort((a, b) => titleKey(a.title).localeCompare(titleKey(b.title)));
    default:
      return list.sort((a, b) => Number(b.favourite) - Number(a.favourite) || a.addedAt.localeCompare(b.addedAt));
  }
}

/**
 * A title boiled down for matching: lower case, no punctuation, no leading "The", and no subtitle
 * ("Wolf Hall: A Novel" matches "Wolf Hall").
 */
export function matchKey(title: string): string {
  return titleKey(title.split(/[:(]/)[0] ?? title)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Where a wished-for book is already kept, if the household has it: the first match by title. */
export function findOwned<T extends { productName: string }>(title: string, owned: T[]): T | null {
  const key = matchKey(title);
  if (key.length < 2) return null;
  return owned.find((o) => matchKey(o.productName) === key) ?? null;
}

/** ISBN checks, so a misread barcode never goes looking for the wrong book. */
export function isIsbn(code: string): boolean {
  if (/^97[89]\d{10}$/.test(code)) {
    const sum = [...code].reduce((s, d, i) => s + Number(d) * (i % 2 === 0 ? 1 : 3), 0);
    return sum % 10 === 0;
  }
  if (/^\d{9}[\dX]$/.test(code)) {
    const sum = [...code].reduce((s, d, i) => s + (d === "X" ? 10 : Number(d)) * (10 - i), 0);
    return sum % 11 === 0;
  }
  return false;
}

/** "Next up for you…" on your own list, "Ian wants to read…" on someone else's. */
export function wantsToRead(name: string, mine: boolean): string {
  return mine ? "Next up for you…" : `${firstName(name)} wants to read…`;
}

/** The message that goes with a shared book list. */
export function bookShareMessage(name: string, url: string, mine: boolean): string {
  return mine
    ? `Here's my book wish list 📚 If you'd like to get me one, tap "I'll get this" so nobody doubles up: ${url}`
    : `Here's ${firstName(name)}'s book wish list 📚 If you'd like to get one, tap "I'll get this" so nobody doubles up (${firstName(name)} won't see): ${url}`;
}

export function bookCountCaption(n: number): string {
  return n === 0 ? "start a list" : n === 1 ? "book wanted" : "books wanted";
}

/** Cloth colours for book spines and covers drawn when there's no cover picture. */
const CLOTHS = ["#2d4a7a", "#b8383a", "#c99a2e", "#2f6b50", "#7a3b6a", "#c46a3a", "#3b6f6a", "#5a6b8c"] as const;

/** A steady colour for a title, so the same book always gets the same cover. */
export function clothFor(seed: string): string {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return CLOTHS[h % CLOTHS.length]!;
}

/** The colours of a person's little stack of books, from their position, so it stays the same. */
export function stackFor(index: number, count: number): string[] {
  const n = Math.max(1, Math.min(4, count || 1));
  return Array.from({ length: n }, (_, i) => CLOTHS[(index * 3 + i * 5) % CLOTHS.length]!);
}

/** The book list's own look: navy bookcloth with a red ribbon bookmark. */
export const BOOK_LOOK = { cloth: "#22304a", ink: "#f7f1e4", ribbon: "#b8383a", paper: "#f3ead8", soft: "#e6e9f1" } as const;
