"use client";

import type { StockItem } from "@/lib/domain/stock";
import { colourCounts, colourInfo, type WineColour } from "@/lib/domain/wine";

/**
 * Bottles of each colour in the rack. Each count is also a filter: tap Red to see only the reds,
 * tap it again to see everything.
 */
export function WineSummary({
  items,
  colour,
  onColour,
}: {
  items: StockItem[] | null;
  colour: WineColour | "none" | null;
  onColour: (c: WineColour | "none" | null) => void;
}) {
  const counts = colourCounts(items ?? []);
  // One colour (or none set yet) says nothing a filter could help with.
  if (counts.length < 2) return null;
  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0" role="group" aria-label="Show one colour">
      <div className="flex min-w-max overflow-hidden rounded-2xl border border-line bg-card sm:min-w-0">
        {counts.map(({ colour: c, n }) => {
          const key = c ?? "none";
          const on = colour === key;
          const info = colourInfo(c);
          return (
            <button
              key={key}
              onClick={() => onColour(on ? null : key)}
              aria-pressed={on}
              className={`flex min-h-14 min-w-[76px] flex-1 flex-col items-center justify-center border-r border-line px-2 py-1.5 last:border-r-0 transition ${
                on ? "bg-go text-on-go" : "hover:bg-sunk/60"
              }`}
            >
              <span className="font-display text-[19px] leading-tight font-bold tabular-nums">{n}</span>
              <span className={`flex items-center gap-1 text-[12px] whitespace-nowrap ${on ? "opacity-90" : "text-mute"}`}>
                <span className="size-2 rounded-full" style={{ background: info?.dot ?? "#9aa29e" }} aria-hidden="true" />
                {info?.label ?? "Not set"}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
