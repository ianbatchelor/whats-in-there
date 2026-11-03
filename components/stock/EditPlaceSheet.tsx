"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { friendlyError } from "@/lib/supabase/errors";
import type { LocationType } from "@/lib/household";
import { Sheet } from "@/components/ui/Sheet";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { PLACE_TYPES } from "@/components/home/placeTypes";

export function EditPlaceSheet({
  open,
  onClose,
  place,
  itemCount,
  onSaved,
  onRemoved,
}: {
  open: boolean;
  onClose: () => void;
  place: { id: string; name: string; type: LocationType };
  itemCount: number;
  onSaved: () => void;
  onRemoved: () => void;
}) {
  const [name, setName] = useState(place.name);
  const [type, setType] = useState<LocationType>(place.type);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState<"save" | "remove" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const finalName = name.trim().slice(0, 60);
    if (!finalName) return setError("Give it a name.");
    setBusy("save");
    setError(null);
    const { error } = await supabase().from("storage_locations").update({ name: finalName, type }).eq("id", place.id);
    setBusy(null);
    if (error) return setError(friendlyError(error));
    onSaved();
    onClose();
  }

  async function remove() {
    setBusy("remove");
    setError(null);
    const { error } = await supabase().from("storage_locations").update({ archived_at: new Date().toISOString() }).eq("id", place.id);
    setBusy(null);
    if (error) return setError(friendlyError(error));
    onRemoved();
  }

  return (
    <Sheet open={open} onClose={onClose} title="Edit place">
      <form onSubmit={save} className="flex flex-col gap-4">
        <Field label="Name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} hint="Stickers keep working when you rename." />
        <fieldset className="grid grid-cols-3 gap-2">
          <legend className="mb-2 text-sm font-bold">What is it?</legend>
          {PLACE_TYPES.map(({ value, label, Icon }) => (
            <label
              key={value}
              className={`flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border px-2 py-3 text-sm font-bold has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-go ${
                type === value ? "border-fg bg-fg text-bg" : "border-line bg-card"
              }`}
            >
              <input type="radio" name="edit-type" value={value} checked={type === value} onChange={() => setType(value)} className="sr-only" />
              <Icon className="size-6" />
              {label}
            </label>
          ))}
        </fieldset>
        {error ? <Notice>{error}</Notice> : null}
        <Button type="submit" busy={busy === "save"}>
          Save
        </Button>
      </form>

      <div className="border-t border-line pt-3">
        {confirm ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm">
              {itemCount > 0
                ? `${place.name} still has ${itemCount === 1 ? "1 thing" : `${itemCount} things`} in it. They'll be hidden along with it, and its sticker will stop working.`
                : `Its sticker will stop working.`}
            </p>
            <div className="flex gap-2">
              <Button variant="ghost" className="flex-1" onClick={() => setConfirm(false)}>
                Keep it
              </Button>
              <Button variant="ink" className="flex-1 bg-warn! text-white!" busy={busy === "remove"} onClick={remove}>
                Remove
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="danger" className="w-full" onClick={() => setConfirm(true)}>
            Remove this place
          </Button>
        )}
      </div>
    </Sheet>
  );
}
