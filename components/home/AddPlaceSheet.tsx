"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { friendlyError } from "@/lib/supabase/errors";
import type { LocationType } from "@/lib/household";
import { Sheet } from "@/components/ui/Sheet";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { PLACE_TYPES } from "./placeTypes";

export function AddPlaceSheet({
  open,
  onClose,
  householdId,
  onAdded,
}: {
  open: boolean;
  onClose: () => void;
  householdId: string;
  onAdded: () => void;
}) {
  const [type, setType] = useState<LocationType>("freezer");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const example = PLACE_TYPES.find((t) => t.value === type)?.example ?? "";

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const finalName = (name.trim() || example).slice(0, 60);
    setBusy(true);
    const { error } = await supabase().from("storage_locations").insert({ household_id: householdId, name: finalName, type });
    setBusy(false);
    if (error) return setError(friendlyError(error));
    setName("");
    onAdded();
    onClose();
  }

  return (
    <Sheet open={open} onClose={onClose} title="Add a place">
      <form onSubmit={save} className="flex flex-col gap-4">
        <fieldset className="grid grid-cols-3 gap-2">
          <legend className="mb-2 text-sm font-bold">What is it?</legend>
          {PLACE_TYPES.map(({ value, label, Icon }) => (
            <label
              key={value}
              className={`flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border px-2 py-3 text-sm font-bold has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-go ${
                type === value ? "border-fg bg-fg text-bg" : "border-line bg-card"
              }`}
            >
              <input type="radio" name="type" value={value} checked={type === value} onChange={() => setType(value)} className="sr-only" />
              <Icon className="size-6" />
              {label}
            </label>
          ))}
        </fieldset>
        <Field label="Name" placeholder={example} value={name} onChange={(e) => setName(e.target.value)} maxLength={60} hint="You can rename it any time. Stickers keep working." />
        {error ? <Notice>{error}</Notice> : null}
        <Button type="submit" busy={busy} className="w-full">
          Add {name.trim() || example}
        </Button>
      </form>
    </Sheet>
  );
}
