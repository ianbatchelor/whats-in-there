"use client";

import { useState } from "react";
import { KEYS, readLocal, writeLocal } from "@/lib/storage";

export type PlaceView = "list" | "grid";

function saved(): Record<string, PlaceView> {
  try {
    return (JSON.parse(readLocal(KEYS.placeView) ?? "{}") as Record<string, PlaceView>) ?? {};
  } catch {
    return {};
  }
}

/** List or pictures for a place, remembered on this device for each place once someone picks. `pictures` is the starting choice. */
export function usePlaceView(placeId: string | null, pictures: boolean): [PlaceView, (v: PlaceView) => void] {
  const fallback: PlaceView = pictures ? "grid" : "list";
  const [chosen, setChosen] = useState<{ id: string; view: PlaceView } | null>(null);
  // The place only appears once it has loaded on the device, so reading the saved choice here is safe.
  const stored = placeId ? saved()[placeId] : undefined;
  const view = chosen && chosen.id === placeId ? chosen.view : stored === "list" || stored === "grid" ? stored : fallback;
  const set = (v: PlaceView) => {
    if (!placeId) return;
    setChosen({ id: placeId, view: v });
    const all = saved();
    all[placeId] = v;
    const keys = Object.keys(all);
    for (const k of keys.slice(0, Math.max(0, keys.length - 100))) delete all[k];
    writeLocal(KEYS.placeView, JSON.stringify(all));
  };
  return [view, set];
}
