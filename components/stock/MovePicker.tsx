"use client";

import { useEffect, useState } from "react";
import type { StockItem } from "@/lib/domain/stock";
import type { LocationType } from "@/lib/household";
import { loadPlacesBeside, moveItem } from "@/lib/stock";
import { friendlyError } from "@/lib/supabase/errors";
import { PlacePhoto } from "@/components/art/PlacePhoto";
import { nestedOrder, placeLabel } from "@/lib/domain/places";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { Spinner } from "@/components/ui/Spinner";

type Spot = { id: string; name: string; type: LocationType; imagePath: string | null; parentId: string | null; itemCount: number };

/** Every other place in the household as a photo row; tapping one moves the thing there. */
export function MovePicker({
  item,
  onMoved,
  onCancel,
}: {
  item: StockItem;
  onMoved: (after: StockItem, placeName: string, movementId: string | null) => void;
  onCancel: () => void;
}) {
  const [places, setPlaces] = useState<Spot[] | null>(null);
  const [moving, setMoving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    loadPlacesBeside(item.locationId)
      .then((p) => active && setPlaces(p))
      .catch((e) => active && (setError(friendlyError(e)), setPlaces([])));
    return () => {
      active = false;
    };
  }, [item.locationId]);

  async function move(to: Spot) {
    setError(null);
    setMoving(to.id);
    try {
      const { item: after, movementId } = await moveItem(item, to.id);
      onMoved(after, to.name, movementId);
    } catch (e) {
      setError(friendlyError(e));
      setMoving(null);
    }
  }

  // Each place with its boxes under it, so "Blue box" is found where it really is.
  const others = nestedOrder(places ?? []).filter(({ place }) => place.id !== item.locationId);
  const byId = new Map((places ?? []).map((p) => [p.id, p]));
  const here = byId.get(item.locationId);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-bold">Where is it now?</p>
      {places === null ? (
        <div className="flex justify-center py-6 text-mute">
          <Spinner />
        </div>
      ) : others.length === 0 ? (
        <p className="text-sm text-mute">There&apos;s nowhere else to move it yet. Add another place first.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {others.map(({ place: p, inside }) => (
            <li key={p.id} className={inside ? "pl-6" : undefined}>
              <button
                type="button"
                onClick={() => move(p)}
                disabled={moving !== null}
                className="lift flex w-full items-center gap-3 overflow-hidden rounded-2xl border border-line bg-card pr-3 text-left disabled:opacity-60"
              >
                <span className={`${inside ? "h-12 w-16" : "h-14 w-20"} shrink-0 overflow-hidden`}>
                  <PlacePhoto type={p.type} imagePath={p.imagePath} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-display font-bold">{p.name}</span>
                  {inside ? <span className="block truncate text-[13px] text-mute">Inside {byId.get(p.parentId!)?.name}</span> : null}
                </span>
                {moving === p.id ? <Spinner /> : null}
              </button>
            </li>
          ))}
        </ul>
      )}
      {here ? <p className="text-[13px] text-mute">It&apos;s in {placeLabel(here, byId)} now.</p> : null}
      {error ? <Notice>{error}</Notice> : null}
      <Button variant="ghost" onClick={onCancel} disabled={moving !== null}>
        Cancel
      </Button>
    </div>
  );
}
