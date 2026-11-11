import type { LocationType } from "@/lib/household";
import { itemKind } from "./itemKind";

/** Sections that mean "this is a book" wherever it's kept. */
const BOOK_SECTION = /\b(books?|fiction|non-fiction|novels?|crime|thrillers?|sci-fi|fantasy|children's|biography|memoir|poetry|cookery|cookbooks?|classics|young adult|graphic novels?)\b/i;
/** Things that live on bookshelves but aren't books, so they never go looking for a book cover. */
const NOT_BOOKS = /\b(games?|board games?|puzzles?|films?|dvds?|blu-?rays?|music|albums?|vinyl|records?|cds?|photos?|ornaments?|plants?)\b/i;

/** Names that say "not a book" even on a bookshelf. Narrow on purpose: "The Hunger Games" is a book. */
const NOT_BOOK_NAMES = /\b(photo albums?|photos|dvds?|blu-?rays?|vinyl|cds?|board games?|jigsaws?)\b/i;

/**
 * Whether to look for a book cover for this thing. On a bookshelf, anything that isn't plainly
 * something else; elsewhere, only things filed under a book section ("Fiction", "Cookery").
 */
export function isBook(item: { productName: string; category: string | null }, placeType: LocationType | undefined): boolean {
  const section = item.category ?? "";
  if (NOT_BOOKS.test(section)) return false;
  if (BOOK_SECTION.test(section)) return true;
  if (placeType !== "bookshelf" || NOT_BOOK_NAMES.test(item.productName)) return false;
  const kind = itemKind(item.productName, item.category);
  return kind === "paper" || kind === "thing";
}

/** What's sent to Open Library for a cover, and the key the answer is remembered under. */
export function bookQuery(title: string, author: string | null): { key: string; title: string; author: string | null } {
  const t = title.replace(/\s+/g, " ").trim().slice(0, 120);
  // "Tolkien and others" was written by the app, not the book: only the first name is looked up.
  const a = author?.replace(/\s+and others$/i, "").split(/\s+and\s+|,|;|&/)[0]?.trim().slice(0, 60) || null;
  return { key: `${t}|${a ?? ""}`.toLowerCase(), title: t, author: a };
}
