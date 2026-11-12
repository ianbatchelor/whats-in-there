"use client";

import { useState } from "react";
import type { LocationType } from "@/lib/household";
import { startersFor } from "@/lib/domain/suggestions";
import { todayIso } from "@/lib/domain/dates";
import { addItem } from "@/lib/stock";
import type { StockItem } from "@/lib/domain/stock";
import { friendlyError } from "@/lib/supabase/errors";
import { IconPlus } from "@/components/ui/icons";

/** One-tap adds for a new or nearly empty place: "+ Ice scraper", "+ First aid kit". */
export function StarterThings({
  placeId,
  type,
  have,
  label,
  onAdded,
  onError,
}: {
  placeId: string;
  type: LocationType;
  have: string[];
  label: string;
  onAdded: (item: StockItem, movementId: string | null) => void;
  onError: (message: string) => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const starters = startersFor(type, have);
  if (starters.length === 0) return null;

  async function add(name: string) {
    setBusy(name);
    try {
      const { item, movementId } = await addItem({
        locationId: placeId,
        productName: name,
        quantity: 1,
        unit: "item",
        frozenAt: type === "freezer" ? todayIso() : null,
      });
      onAdded(item, movementId);
    } catch (e) {
      onError(friendlyError(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-2.5">
      <p className="text-[14px] font-semibold text-mute">{label}</p>
      <ul className="flex flex-wrap gap-2">
        {starters.map((n) => (
          <li key={n}>
            <button
              onClick={() => add(n)}
              disabled={busy !== null}
              aria-label={`Add ${n}`}
              className="flex min-h-11 items-center gap-1.5 rounded-full border border-line bg-card pr-4 pl-3 text-[14.5px] font-semibold transition hover:border-leaf hover:text-leaf active:scale-95 disabled:opacity-50"
            >
              <IconPlus className="size-4 text-leaf" /> {n}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
