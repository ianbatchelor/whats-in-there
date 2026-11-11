import type { LocationType, Place } from "@/lib/household";

export type PlaceGroup = { type: LocationType; places: Place[]; itemCount: number };

/** Groups places by kind, keeping the order people created them in. */
export function groupPlaces(places: Place[]): PlaceGroup[] {
  const groups = new Map<LocationType, PlaceGroup>();
  for (const p of places) {
    const g = groups.get(p.type) ?? { type: p.type, places: [], itemCount: 0 };
    g.places.push(p);
    g.itemCount += p.itemCount;
    groups.set(p.type, g);
  }
  return [...groups.values()];
}

export function countThings(n: number): string {
  return n === 1 ? "1 thing" : `${n} things`;
}

export type PlaceSection = "kitchen" | "storage" | "garden";

const SECTION: Record<LocationType, PlaceSection> = {
  freezer: "kitchen",
  fridge: "kitchen",
  pantry: "kitchen",
  cupboard: "kitchen",
  wine: "kitchen",
  attic: "storage",
  garage: "storage",
  shed: "storage",
  wardrobe: "storage",
  box: "storage",
  bookshelf: "storage",
  toybox: "storage",
  desk: "storage",
  medicine: "storage",
  car: "storage",
  other: "storage",
  garden: "garden",
};

export const SECTION_LABELS: Record<PlaceSection, string> = { kitchen: "Kitchen", storage: "Storage", garden: "Garden" };

export function sectionOf(type: LocationType): PlaceSection {
  return SECTION[type];
}

/** The sections this household actually uses, in a fixed order. */
export function usedSections(places: Place[]): PlaceSection[] {
  const used = new Set(places.map((p) => SECTION[p.type]));
  return (["kitchen", "storage", "garden"] as const).filter((s) => used.has(s));
}

/** Places with the most recent activity first, one entry per place. */
export function recentPlaces<T extends { locationId: string | null; at: string }>(rows: T[], limit = 3): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const r of [...rows].sort((a, b) => b.at.localeCompare(a.at))) {
    if (!r.locationId || seen.has(r.locationId)) continue;
    seen.add(r.locationId);
    out.push(r);
    if (out.length === limit) break;
  }
  return out;
}

/** How many things in each place have a printed date within the "use soon" window (or past it). */
export function soonCounts(rows: { locationId: string; useByDate: string | null; bestBeforeDate: string | null }[], cutoff: string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const r of rows) {
    const dates = [r.useByDate, r.bestBeforeDate].filter((d): d is string => !!d);
    if (dates.some((d) => d <= cutoff)) counts.set(r.locationId, (counts.get(r.locationId) ?? 0) + 1);
  }
  return counts;
}

/**
 * Places you use things up from (food, drink, medicine, the garden) and places you keep things in
 * (shelves, wardrobes, boxes). Things in keep places have no quick minus and no "use first" order,
 * can be lent out, and can show as a grid of pictures.
 */
const USE_UP: readonly LocationType[] = ["freezer", "fridge", "pantry", "wine", "garden", "medicine"];

export function isUseUpPlace(type: LocationType): boolean {
  return USE_UP.includes(type);
}

export function isKeepPlace(type: LocationType): boolean {
  return !USE_UP.includes(type);
}

type Nested = { id: string; name: string; parentId?: string | null; itemCount: number };

/** The place itself, or the place it sits inside. */
export function topPlaceId<T extends Nested>(id: string, byId: Map<string, T>): string {
  const p = byId.get(id);
  return p?.parentId && byId.has(p.parentId) ? p.parentId : id;
}

/**
 * Places as Home shows them: only the ones not inside anything, each counting the things in its
 * boxes too, and how many boxes it holds.
 */
export function rollUp<T extends Nested>(places: T[]): (T & { boxCount: number })[] {
  const byId = new Map(places.map((p) => [p.id, p]));
  const top = places.filter((p) => !p.parentId || !byId.has(p.parentId));
  return top.map((p) => {
    const kids = places.filter((c) => c.parentId === p.id);
    return { ...p, itemCount: p.itemCount + kids.reduce((n, c) => n + c.itemCount, 0), boxCount: kids.length };
  });
}

/** The boxes and shelves inside a place, in the household's order. */
export function boxesIn<T extends Nested>(places: T[], parentId: string): T[] {
  return places.filter((p) => p.parentId === parentId);
}

/** "Blue box, in Garage" for a box, or just the name for a place that isn't inside anything. */
export function placeLabel<T extends Nested>(place: T, byId: Map<string, T>): string {
  const parent = place.parentId ? byId.get(place.parentId) : undefined;
  return parent ? `${place.name}, in ${parent.name}` : place.name;
}

/** Each place followed by the boxes inside it, for pickers. A box whose place is missing stands on its own. */
export function nestedOrder<T extends Nested>(places: T[]): { place: T; inside: boolean }[] {
  const byId = new Map(places.map((p) => [p.id, p]));
  const out: { place: T; inside: boolean }[] = [];
  for (const p of places) {
    if (p.parentId && byId.has(p.parentId)) continue;
    out.push({ place: p, inside: false });
    for (const c of places) if (c.parentId === p.id) out.push({ place: c, inside: true });
  }
  return out;
}
