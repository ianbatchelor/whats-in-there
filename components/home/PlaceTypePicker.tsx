"use client";

import type { LocationType } from "@/lib/household";
import { PlacePhoto } from "@/components/art/PlacePhoto";
import { IconCheck } from "@/components/ui/icons";
import { PLACE_TYPES } from "./placeTypes";

export function PlaceTypePicker({ value, onChange, name }: { value: LocationType; onChange: (t: LocationType) => void; name: string }) {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-2 font-display text-sm font-bold">What kind of place?</legend>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {PLACE_TYPES.map(({ value: v, label }) => {
          const selected = value === v;
          return (
            <label
              key={v}
              className={`relative cursor-pointer overflow-hidden rounded-2xl border bg-card transition has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-leaf ${
                selected ? "border-go ring-2 ring-go" : "border-line"
              }`}
            >
              <input type="radio" name={name} value={v} checked={selected} onChange={() => onChange(v)} className="sr-only" />
              <span className="block aspect-[4/3]">
                <PlacePhoto type={v} />
              </span>
              <span className="block truncate px-2 py-1.5 text-center text-[12.5px] font-bold">{label}</span>
              {selected ? (
                <span className="absolute top-1.5 right-1.5 grid size-6 place-items-center rounded-full bg-go text-on-go">
                  <IconCheck className="size-4" />
                </span>
              ) : null}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
