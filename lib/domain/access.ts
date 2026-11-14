/**
 * Who can see what, gathered in one place. Sharing happens in several spots (the household, a single
 * place, a list, a wish list link); this puts it together so the People page can say, per person,
 * what they see, and Home and Lists can mark what's shared outside the home.
 */
import type { Role } from "@/lib/household";
import type { ListPerson, OwnList } from "@/lib/domain/ownLists";

export type AccessMember = { userId: string; role: Role; displayName: string };
export type AccessPlace = { id: string; name: string; parentId?: string | null };
export type PlaceGuest = { locationId: string; userId: string };
export type LinkedWishList = { kind: "presents" | "books"; forUser: string | null; name: string | null };

export type Outsider = { userId: string; name: string; sees: string[] };

export type Access = {
  /** What each family member sees on top of present lists: places they use, lists shared with family. */
  family: Map<string, string[]>;
  /** People who don't belong to the household but use one of its places, or are in one of your group lists. */
  outsiders: Outsider[];
  /** Lists anyone with the link can open. */
  links: string[];
  /** For marking places as shared: the top-level place id, and the first names of who else uses it. */
  placeGuests: Map<string, string[]>;
  /** For marking lists as shared outside the home: list id, and who (first names). */
  listGuests: Map<string, string[]>;
};

const first = (name: string) => name.trim().split(/\s+/)[0] || name;

export function gatherAccess(input: {
  me: string;
  householdId: string | null;
  members: AccessMember[];
  places: AccessPlace[];
  guests: PlaceGuest[];
  /** Names for guests who don't live here (members' names come from members). */
  names: Map<string, string>;
  lists: OwnList[];
  listPeople: ListPerson[];
  linked: LinkedWishList[];
}): Access {
  const { me, householdId, members, places, guests, names, lists, listPeople, linked } = input;
  const memberById = new Map(members.map((m) => [m.userId, m]));
  const placeById = new Map(places.map((p) => [p.id, p]));
  // A guest let into a box is shown against the place the box is in.
  const topOf = (id: string) => {
    const p = placeById.get(id);
    return p?.parentId && placeById.has(p.parentId) ? p.parentId : id;
  };
  const nameOf = (id: string) => memberById.get(id)?.displayName ?? names.get(id) ?? listPeople.find((p) => p.userId === id)?.name ?? "Someone";

  const family = new Map<string, string[]>();
  for (const m of members) if (m.role === "family") family.set(m.userId, []);
  const outsiders = new Map<string, Outsider>();
  const add = (userId: string, what: string) => {
    if (userId === me) return;
    const m = memberById.get(userId);
    if (m && m.role !== "family") return; // people at home see everything already
    if (m) {
      const list = family.get(userId)!;
      if (!list.includes(what)) list.push(what);
      return;
    }
    const o = outsiders.get(userId) ?? { userId, name: nameOf(userId), sees: [] };
    if (!o.sees.includes(what)) o.sees.push(what);
    outsiders.set(userId, o);
  };

  const placeGuests = new Map<string, string[]>();
  for (const g of guests) {
    const top = topOf(g.locationId);
    const place = placeById.get(top);
    if (!place) continue;
    add(g.userId, place.name);
    const m = memberById.get(g.userId);
    if (g.userId === me || (m && m.role !== "family")) continue;
    const who = placeGuests.get(top) ?? [];
    const n = first(nameOf(g.userId));
    if (!who.includes(n)) who.push(n);
    placeGuests.set(top, who);
  }

  const listGuests = new Map<string, string[]>();
  const familyNames = members.filter((m) => m.role === "family").map((m) => first(m.displayName));
  for (const l of lists) {
    if (l.visibility === "family" && l.householdId === householdId) {
      for (const m of members) if (m.role === "family") add(m.userId, l.title);
      if (familyNames.length > 0) listGuests.set(l.id, familyNames);
    }
    if (l.visibility === "group") {
      const people = listPeople.filter((p) => p.listId === l.id && p.userId !== me);
      for (const p of people) add(p.userId, l.title);
      if (people.length > 0) listGuests.set(l.id, people.map((p) => first(p.name)));
    }
  }

  const links = linked.map((w) => {
    const what = w.kind === "books" ? "book wish list" : "wish list";
    if (w.forUser === me) return `Your ${what}`;
    const who = w.forUser ? nameOf(w.forUser) : w.name;
    return who ? `${first(who)}'s ${what}` : `A ${what}`;
  });

  return { family, outsiders: [...outsiders.values()], links, placeGuests, listGuests };
}

/** "Jo", "Jo and Carol", "Jo, Carol and 2 more". */
export function shortNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  if (names.length === 3) return `${names[0]}, ${names[1]} and ${names[2]}`;
  return `${names[0]}, ${names[1]} and ${names.length - 2} more`;
}
