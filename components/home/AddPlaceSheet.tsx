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
import { PlaceTypePicker } from "./PlaceTypePicker";

export function AddPlaceSheet({
  open,
  onClose,
  householdId,
  onAdded,
  inside,
}: {
  open: boolean;
  onClose: () => void;
  householdId: string;
  onAdded: () => void;
  /** Add a box or shelf inside this place, instead of a place of its own. */
  inside?: { id: string; name: string };
}) {
  const [type, setType] = useState<LocationType>(inside ? "box" : "freezer");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const info = PLACE_TYPES.find((t) => t.value === type);
  const example = info?.example ?? "";
  // Inside a place, the kind's plain name ("Box") beats a made-up one ("Blue Storage Box").
  const fallback = inside ? (info?.label ?? "Box") : example;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const finalName = (name.trim() || fallback).slice(0, 60);
    setBusy(true);
    const row: Record<string, unknown> = { household_id: householdId, name: finalName, type };
    if (inside) row.parent_id = inside.id;
    const { error } = await supabase().from("storage_locations").insert(row);
    setBusy(false);
    if (error) return setError(friendlyError(error));
    setName("");
    onAdded();
    onClose();
  }

  return (
    <Sheet open={open} onClose={onClose} title={inside ? `Add to ${inside.name}` : "Add a place"}>
      <form onSubmit={save} className="-mx-1 flex max-h-[78dvh] flex-col gap-4 overflow-y-auto px-1 pb-1">
        {inside ? (
          <p className="text-sm text-mute">
            A box, a shelf or a drawer in {inside.name}. It gets its own list and sticker, and shows up as &ldquo;in {inside.name}&rdquo; wherever its things
            appear.
          </p>
        ) : null}
        <PlaceTypePicker value={type} onChange={setType} name="add-type" />
        <Field
          label="Name"
          placeholder={inside ? (type === "box" ? "Blue box" : example) : example}
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
          hint={
            inside
              ? "Something you'd say out loud, like Blue box or Top shelf."
              : "Give it its own name, so three freezers or two raised beds are easy to tell apart. You can rename it any time."
          }
        />
        {error ? <Notice>{error}</Notice> : null}
        <Button type="submit" busy={busy} className="w-full">
          Add {name.trim() || fallback}
        </Button>
      </form>
    </Sheet>
  );
}
