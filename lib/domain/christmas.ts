/**
 * Christmas: one page that brings together what the app already knows for it. The present lists,
 * lists made for the day, decorations stored in boxes, and room to make in the freezer.
 */
import type { WishClaim, WishIdea, WishList } from "@/lib/domain/presents";

const DAY = 86_400_000;

/** Whole days from today until 25 December (this year's, or next year's once it has passed). */
export function daysToChristmas(now: Date = new Date()): number {
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  let christmas = Date.UTC(now.getFullYear(), 11, 25);
  if (today > christmas) christmas = Date.UTC(now.getFullYear() + 1, 11, 25);
  return Math.round((christmas - today) / DAY);
}

/** From 1 November to Boxing Day the app shows Christmas on Home and Lists. */
export function isChristmasTime(now: Date = new Date()): boolean {
  const m = now.getMonth();
  return m === 10 || (m === 11 && now.getDate() <= 26);
}

/** "41 days to go", "Tomorrow", "Today". */
export function countdown(days: number): string {
  if (days === 0) return "It's Christmas Day";
  if (days === 1) return "Christmas is tomorrow";
  return `${days} days to go`;
}

const WORDS = /\b(christmas|xmas|festive|advent|boxing day|new year|decorations?|baubles?|tinsel|fairy lights|tree lights|crackers?|wrapping|gift wrap|nativity|wreaths?|stockings?|santa|reindeer|mince pies?|stollen|panettone|yule)\b/i;

/** A list, place or thing that's about Christmas, from its name. */
export function isChristmassy(name: string): boolean {
  return WORDS.test(name);
}

/** The words to look for in what's stored, for one database search. */
export const CHRISTMAS_SEARCH = ["christmas", "xmas", "decoration", "bauble", "tinsel", "fairy light", "cracker", "wrapping", "wreath", "stocking", "advent", "nativity"];

export type PersonPresents = {
  userId: string | null;
  name: string;
  ideas: number;
  /** Ideas someone has said they're getting (never shown for your own list). */
  taken: number;
  /** Ideas you said you're getting. */
  yours: number;
};

/** Per person, how their list is going: ideas, how many are taken, and how many by you. */
export function presentProgress(
  people: { userId: string | null; name: string; list: WishList | null }[],
  ideas: WishIdea[],
  claims: WishClaim[],
  me: string,
): PersonPresents[] {
  const claimed = new Map(claims.map((c) => [c.ideaId, c]));
  return people.map((p) => {
    const mine = p.list ? ideas.filter((i) => i.listId === p.list!.id) : [];
    const own = p.userId === me;
    return {
      userId: p.userId,
      name: p.name,
      ideas: mine.length,
      taken: own ? 0 : mine.filter((i) => claimed.has(i.id)).length,
      yours: own ? 0 : mine.filter((i) => claimed.get(i.id)?.claimedBy === me).length,
    };
  });
}

/** One line for a person's row: "You're getting 1 · 2 of 5 taken", "No ideas yet". */
export function progressLine(p: PersonPresents, own: boolean): string {
  if (own) return p.ideas === 0 ? "Add some ideas so people know what to get you" : `${p.ideas} ${p.ideas === 1 ? "idea" : "ideas"} on your list`;
  if (p.ideas === 0) return "No ideas yet";
  const parts = [p.yours > 0 ? `You're getting ${p.yours}` : null, `${p.taken} of ${p.ideas} taken`];
  return parts.filter(Boolean).join(" · ");
}
