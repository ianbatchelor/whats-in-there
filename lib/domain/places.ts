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
