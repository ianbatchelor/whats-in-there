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
      <form onSubmit={save} className="-mx-1 flex max-h-[78dvh] flex-col gap-4 overflow-y-auto px-1 pb-1">
        <PlaceTypePicker value={type} onChange={setType} name="add-type" />
        <Field label="Name" placeholder={example} value={name} onChange={(e) => setName(e.target.value)} maxLength={60} hint="Give it its own name, so three freezers or two raised beds are easy to tell apart. You can rename it any time." />
        {error ? <Notice>{error}</Notice> : null}
        <Button type="submit" busy={busy} className="w-full">
          Add {name.trim() || example}
        </Button>
      </form>
    </Sheet>
  );
}
