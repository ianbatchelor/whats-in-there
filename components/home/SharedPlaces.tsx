"use client";

import { useEffect, useState } from "react";
import { SectionLabel } from "@/components/AppShell";
import { PlaceCard } from "@/components/home/PlaceCard";
import { loadSharedWithMe, type SharedPlace } from "@/lib/sharedPlaces";

/** Places in other people's homes that they've let you into, like a parent's garage freezer. */
export function SharedPlaces({ version = 0, onLoaded }: { version?: number; onLoaded?: (places: SharedPlace[]) => void }) {
  const [places, setPlaces] = useState<SharedPlace[]>([]);

  useEffect(() => {
    let live = true;
    loadSharedWithMe()
      .then((p) => {
        if (!live) return;
        setPlaces(p);
        onLoaded?.(p);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [version]); // eslint-disable-line react-hooks/exhaustive-deps

  if (places.length === 0) return null;
  return (
    <section className="flex flex-col gap-3" aria-labelledby="shared-h">
      <SectionLabel id="shared-h">Shared with you</SectionLabel>
      <ul className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 sm:gap-x-4 lg:grid-cols-4">
        {places.map((p, i) => (
          <PlaceCard
            key={p.id}
            index={i}
            place={{ id: p.id, name: p.name, type: p.type, itemCount: p.things, imagePath: p.imagePath }}
            sub={p.household}
          />
        ))}
      </ul>
    </section>
  );
}
