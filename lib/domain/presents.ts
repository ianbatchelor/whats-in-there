/** Present ideas: one wish list per person, shared with the household and, by link, with family. */

export type WishKind = "presents" | "books";

export type WishList = {
  id: string;
  kind: WishKind;
  /** A friend's own book list, started from a share link by someone outside the household. */
  friend: boolean;
  forUser: string | null;
  name: string | null;
  shareCode: string | null;
  createdAt: string;
};

export type WishIdea = {
  id: string;
  listId: string;
  title: string;
  note: string | null;
  link: string | null;
  price: string | null;
  favourite: boolean;
  /** A copy of the shop's picture, in the public wish-pictures bucket. */
  imagePath: string | null;
  /** Books only: the author, the ISBN from a scanned barcode, and Open Library's cover number. */
  author: string | null;
  isbn: string | null;
  coverId: number | null;
  /** The first name of a friend who suggested it through a share link. */
  suggestedBy: string | null;
  addedBy: string | null;
  addedAt: string;
};

/** Who's getting it. Never loaded for your own list: the database doesn't give it to you. */
export type WishClaim = { ideaId: string; claimedBy: string | null; claimedName: string | null };

/** Someone's list on the page: a household member (with or without a list yet) or someone without an account. */
export type Person = { key: string; name: string; userId: string | null; list: WishList | null };

/**
 * Everyone whose list shows: you first, then the rest of the household by name, then lists for
 * people without an account (such as children) by name. Members appear even before they start a list.
 */
export function people(members: { userId: string; displayName: string }[], lists: WishList[], me: string): Person[] {
  const byUser = new Map(lists.filter((l) => l.forUser).map((l) => [l.forUser!, l]));
  const mine = members.filter((m) => m.userId === me);
  const others = members.filter((m) => m.userId !== me).sort((a, b) => a.displayName.localeCompare(b.displayName));
  const asPerson = (m: { userId: string; displayName: string }): Person => ({
    key: m.userId,
    name: m.displayName,
    userId: m.userId,
    list: byUser.get(m.userId) ?? null,
  });
  const extra = lists
    .filter((l) => !l.forUser && l.name)
    .sort((a, b) => a.name!.localeCompare(b.name!))
    .map((l): Person => ({ key: l.id, name: l.name!, userId: null, list: l }));
  return [...mine.map(asPerson), ...others.map(asPerson), ...extra];
}

/** Top of the list first, then in the order they were added. */
export function sortIdeas(ideas: WishIdea[]): WishIdea[] {
  return [...ideas].sort((a, b) => Number(b.favourite) - Number(a.favourite) || a.addedAt.localeCompare(b.addedAt));
}

/** "Ian would love…", or "You'd love…" on your own list. */
export function wouldLove(name: string, mine: boolean): string {
  return mine ? "You'd love…" : `${firstName(name)} would love…`;
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}

/**
 * Tidies a pasted shop link: adds https:// when it's missing, and returns null for anything that
 * isn't a plain web address, so a link can only ever open a web page.
 */
export function cleanLink(raw: string): string | null | "bad" {
  const t = raw.trim();
  if (!t) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(t) ? t : `https://${t}`;
  try {
    const u = new URL(withScheme);
    if ((u.protocol !== "https:" && u.protocol !== "http:") || !u.hostname.includes(".") || /\s/.test(t)) return "bad";
    return withScheme.length > 600 ? "bad" : withScheme;
  } catch {
    return "bad";
  }
}

/** The shop's name for a link, shown instead of the whole address: "amazon.co.uk". */
export function linkLabel(link: string): string {
  try {
    return new URL(link).hostname.replace(/^www\./, "");
  } catch {
    return "Link";
  }
}

/** "£40" stays as typed; a bare number gets a pound sign. */
export function cleanPrice(raw: string): string | null {
  const t = raw.trim().slice(0, 30);
  if (!t) return null;
  return /^\d+([.,]\d{1,2})?$/.test(t) ? `£${t}` : t;
}

/** Wrapping papers, one per person, picked from their position so it stays the same for them. */
export const WRAPS = [
  { paper: "#8f2d2d", ink: "#fff8ef", ribbon: "#e9c46a", soft: "#f8e6e1" }, // cranberry, gold ribbon
  { paper: "#1f4d3d", ink: "#f6f1e3", ribbon: "#e9c46a", soft: "#e2eee7" }, // forest, gold ribbon
  { paper: "#22355c", ink: "#f4f1ea", ribbon: "#d9dbe2", soft: "#e3e8f3" }, // midnight, silver ribbon
  { paper: "#b9852d", ink: "#2a2112", ribbon: "#8f2d2d", soft: "#f7ecd6" }, // gold, cranberry ribbon
  { paper: "#5a3a5e", ink: "#f7eef6", ribbon: "#e9c46a", soft: "#efe5ef" }, // plum, gold ribbon
  { paper: "#2c6a6a", ink: "#effaf8", ribbon: "#f2b8a2", soft: "#e0f0ee" }, // teal, blush ribbon
] as const;
export type Wrap = (typeof WRAPS)[number];

export function wrapFor(index: number): Wrap {
  return WRAPS[((index % WRAPS.length) + WRAPS.length) % WRAPS.length]!;
}

/** The private link family use: https://seewhatsinhere.com/wish/?c=<code>. */
export function wishShareUrl(origin: string, code: string): string {
  return `${origin.replace(/\/+$/, "")}/wish/?c=${code}`;
}

export function wishCodeFrom(search: string): string | null {
  const c = new URLSearchParams(search).get("c");
  return c && /^[0-9A-Za-z]{10}$/.test(c) ? c : null;
}

/** The message that goes with a shared link. */
export function shareMessage(name: string, url: string, mine: boolean): string {
  return mine
    ? `Here are some present ideas for me 🎁 Tap "I'm getting this" on one so nobody doubles up: ${url}`
    : `Here are some present ideas for ${firstName(name)} 🎁 Tap "I'm getting this" on one so nobody doubles up (${firstName(name)} won't see): ${url}`;
}

/** For the Home card: how many ideas there are across the household. */
export function ideaCountCaption(n: number): string {
  return n === 0 ? "start a list" : n === 1 ? "present idea" : "present ideas";
}

/**
 * Whether what was typed in the add box is a shop link rather than a name: no spaces, and either
 * starts like a web address or has a dot and a slash (amzn.eu/d/abc).
 */
export function looksLikeLink(text: string): boolean {
  const t = text.trim();
  if (!t || /\s/.test(t)) return false;
  return /^(https?:\/\/|www\.)/i.test(t) || (/^[a-z0-9-]+(\.[a-z0-9-]+)+\//i.test(t) && cleanLink(t) !== "bad");
}

/** Why a link couldn't be read, in plain words. */
export function linkProblem(code: string, shop?: string): string {
  const where = shop ? shop : "the shop";
  switch (code) {
    case "shop_blocked":
      return `${where} didn't let us read the page this time. Add the name and price yourself, or try again later.`;
    case "too_many_links":
      return "You've filled in 100 links this month. Add the details yourself for now.";
    case "too_many_now":
      return "That's a lot of links at once. Wait a minute and try again.";
    case "bad_link":
      return "That doesn't look like a shop link. Copy it from the shop's page and paste it again.";
    case "not_configured":
      return "Filling in from links needs a quick update first. Add the details yourself for now.";
    default:
      return `Couldn't read ${where}'s page. Add the name and price yourself.`;
  }
}
