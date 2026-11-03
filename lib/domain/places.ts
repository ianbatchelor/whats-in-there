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
