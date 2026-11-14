/**
 * Search across the lists as well as the places: the shopping list, everyone's present ideas and
 * book wishes, and your own lists. Things in places are searched by the database; lists are small,
 * so they are matched here.
 */

import type { ShoppingItem } from "./shopping";
import type { WishIdea, WishList } from "./presents";
import type { ListEntry, OwnList } from "./ownLists";

export type ListHitKind = "shopping" | "present" | "book" | "list";

export type ListHit = {
  id: string;
  kind: ListHitKind;
  /** What matched: "Pinot Grigio", "Sherlock Holmes: The Complete Stories". */
  title: string;
  /** Where it is, in words: "On the shopping list", "On Michele's present ideas". */
  where: string;
  href: string;
  /** Bought, used or done: still found, but shown quieter. */
  done: boolean;
};

export type ListSources = {
  shopping: ShoppingItem[];
  presents: { lists: WishList[]; ideas: WishIdea[] };
  books: { lists: WishList[]; ideas: WishIdea[] };
  own: { lists: OwnList[]; entries: ListEntry[] };
  /** Display names by user id, for "Michele's present ideas". */
  names: Map<string, string>;
  me: string;
};

/** Lower case, without accents, so "rose" finds "Rosé". */
export function fold(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/** Every word typed appears somewhere in the text, in any order: "pinot grig" finds "Grigio, Pinot". */
export function matches(query: string, ...texts: (string | null | undefined)[]): boolean {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return false;
  const hay = fold(texts.filter(Boolean).join(" "));
  return words.every((w) => hay.includes(w));
}

/** "Your", "Michele's" or the list's own name for someone without an account. */
function whose(list: WishList, names: Map<string, string>, me: string): string {
  if (list.forUser === me) return "Your";
  const name = (list.forUser && names.get(list.forUser)?.trim().split(/\s+/)[0]) || list.name;
  return name ? `${name}'s` : "Someone's";
}

/** The page's own key for a person: their user id, or the list's id for someone without an account. */
function personKey(list: WishList): string {
  return list.forUser ?? list.id;
}

const ORDER: Record<ListHitKind, number> = { shopping: 0, list: 1, present: 2, book: 3 };

export function searchLists(query: string, s: ListSources): ListHit[] {
  if (query.trim().length < 2) return [];
  const hits: ListHit[] = [];

  for (const i of s.shopping) {
    if (!matches(query, i.name, i.brand, i.category)) continue;
    hits.push({
      id: `shop:${i.id}`,
      kind: "shopping",
      title: i.name,
      where: i.boughtAt ? "Bought, on the shopping list" : "On the shopping list",
      href: "/list/",
      done: !!i.boughtAt,
    });
  }

  const listById = new Map(s.own.lists.map((l) => [l.id, l]));
  for (const e of s.own.entries) {
    const list = listById.get(e.listId);
    if (!list || !matches(query, e.text, e.note)) continue;
    hits.push({ id: `list:${e.id}`, kind: "list", title: e.text, where: `On ${list.title}`, href: `/my-list/?id=${list.id}`, done: !!e.doneAt });
  }

  const wishes = (kind: "present" | "book", src: { lists: WishList[]; ideas: WishIdea[] }) => {
    const byId = new Map(src.lists.map((l) => [l.id, l]));
    for (const idea of src.ideas) {
      const list = byId.get(idea.listId);
      if (!list || !matches(query, idea.title, idea.author, idea.note)) continue;
      const label = kind === "present" ? "present ideas" : "book wish list";
      hits.push({
        id: `${kind}:${idea.id}`,
        kind,
        title: idea.title,
        where: `On ${whose(list, s.names, s.me)} ${label}`.replace(/^On Your /, "On your "),
        href: `/${kind === "present" ? "presents" : "books"}/?for=${encodeURIComponent(personKey(list))}`,
        done: false,
      });
    }
  };
  wishes("present", s.presents);
  wishes("book", s.books);

  // Still to do comes before done; within that, shopping first, then your lists, then wishes.
  return hits.sort((a, b) => Number(a.done) - Number(b.done) || ORDER[a.kind] - ORDER[b.kind]);
}
