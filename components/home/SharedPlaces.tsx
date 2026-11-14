"use client";

import { useEffect, useState } from "react";
import { SectionLabel } from "@/components/AppShell";
import { PlaceCard } from "@/components/home/PlaceCard";
import { countThings } from "@/lib/domain/places";
import { loadSharedWithMe, type SharedPlace } from "@/lib/sharedPlaces";

/** Places in other people's homes that they've let you into, like a parent's garage freezer. Null while loading. */
export function useSharedWithMe(version = 0): SharedPlace[] | null {
  const [places, setPlaces] = useState<SharedPlace[] | null>(null);
  useEffect(() => {
    let live = true;
    loadSharedWithMe()
      .then((p) => live && setPlaces(p))
      .catch(() => live && setPlaces([]));
    return () => {
      live = false;
    };
  }, [version]);
  return places;
}

/** Cards for shared places, to sit in a grid of places. Each says whose it is. */
export function SharedPlaceCards({ places, offset = 0 }: { places: SharedPlace[]; offset?: number }) {
  return (
    <>
      {places.map((p, i) => (
        <PlaceCard
          key={p.id}
          index={offset + i}
          place={{ id: p.id, name: p.name, type: p.type, itemCount: p.things, imagePath: p.imagePath }}
          sub={`${p.household} · ${countThings(p.things)}`}
        />
      ))}
    </>
  );
}

/** A section of shared places, for people with no home of their own. */
export function SharedPlaces({ places }: { places: SharedPlace[] }) {
  if (places.length === 0) return null;
  return (
    <section className="flex flex-col gap-3" aria-labelledby="shared-h">
      <SectionLabel id="shared-h">Shared with you</SectionLabel>
      <ul className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 sm:gap-x-4 lg:grid-cols-4">
        <SharedPlaceCards places={places} />
      </ul>
    </section>
  );
}
