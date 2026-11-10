"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { friendlyError } from "@/lib/supabase/errors";
import { coverPhotosAvailable, type LocationType } from "@/lib/household";
import { discardLabelPhoto, uploadPlacePhoto } from "@/lib/labelPhoto";
import { PlacePhoto } from "@/components/art/PlacePhoto";
import { Spinner } from "@/components/ui/Spinner";
import { IconCamera } from "@/components/ui/icons";
import { Sheet } from "@/components/ui/Sheet";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { PlaceTypePicker } from "@/components/home/PlaceTypePicker";

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
  place: { id: string; name: string; type: LocationType; householdId: string; imagePath?: string | null };
  itemCount: number;
  onSaved: () => void;
  onRemoved: () => void;
}) {
  const [name, setName] = useState(place.name);
  const [type, setType] = useState<LocationType>(place.type);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState<"save" | "remove" | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The cover photo: "keep" what the place has, a freshly uploaded one, or "none" to go back to ours.
  const [cover, setCover] = useState<{ kind: "keep" } | { kind: "none" } | { kind: "new"; path: string; preview: string }>({ kind: "keep" });
  const [uploading, setUploading] = useState(false);
  const picker = useRef<HTMLInputElement>(null);
  const pending = useRef<{ path: string; preview: string } | null>(null);

  // A photo that was uploaded but never saved is removed when the sheet goes away.
  useEffect(
    () => () => {
      if (pending.current) {
        void discardLabelPhoto(pending.current.path);
        URL.revokeObjectURL(pending.current.preview);
      }
    },
    [],
  );

  function dropPending() {
    if (!pending.current) return;
    void discardLabelPhoto(pending.current.path);
    URL.revokeObjectURL(pending.current.preview);
    pending.current = null;
  }

  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const path = await uploadPlacePhoto(place.householdId, file);
      dropPending();
      pending.current = { path, preview: URL.createObjectURL(file) };
      setCover({ kind: "new", ...pending.current });
    } catch (err) {
      setError(err instanceof Error && err.message === "photo_failed" ? "That photo couldn't be opened. Try another one." : friendlyError(err));
    } finally {
      setUploading(false);
    }
  }

  const hasOwn = cover.kind === "new" || (cover.kind === "keep" && !!place.imagePath);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const finalName = name.trim().slice(0, 60);
    if (!finalName) return setError("Give it a name.");
    setBusy("save");
    setError(null);
    const changes: Record<string, unknown> = { name: finalName, type };
    if (cover.kind === "new") changes.image_path = cover.path;
    if (cover.kind === "none") changes.image_path = null;
    const { error } = await supabase().from("storage_locations").update(changes).eq("id", place.id);
    setBusy(null);
    if (error) return setError(friendlyError(error));
    if (cover.kind !== "keep") {
      // The new photo now belongs to the place; the one it replaced is no longer needed.
      if (pending.current && cover.kind === "new") {
        URL.revokeObjectURL(pending.current.preview);
        pending.current = null;
      }
      if (place.imagePath) void discardLabelPhoto(place.imagePath);
    }
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
      <form onSubmit={save} className="-mx-1 flex max-h-[62dvh] flex-col gap-4 overflow-y-auto px-1 pb-1">
        <Field label="Name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} hint="Stickers keep working when you rename." />
        {coverPhotosAvailable() ? (
          <div className="flex min-w-0 flex-col gap-2">
            <span className="font-display text-sm font-bold">Photo</span>
            <div className="flex items-center gap-3.5 rounded-2xl border border-line bg-card p-2.5">
              <span className="relative block h-[72px] w-24 shrink-0 overflow-hidden rounded-xl bg-sunk">
                {cover.kind === "new" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={cover.preview} alt="Your new photo" className="h-full w-full object-cover" />
                ) : (
                  <PlacePhoto type={type} imagePath={cover.kind === "keep" ? place.imagePath : null} eager />
                )}
                {uploading ? (
                  <span className="absolute inset-0 grid place-items-center bg-black/40 text-white">
                    <Spinner />
                  </span>
                ) : null}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] text-mute">{hasOwn ? "Your own photo of this place." : "Use a photo of your own so you can tell places apart."}</p>
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm font-bold">
                  <button type="button" className="flex min-h-9 items-center gap-1.5 text-go" disabled={uploading} onClick={() => picker.current?.click()}>
                    <IconCamera className="size-4" /> {hasOwn ? "Change photo" : "Add your photo"}
                  </button>
                  {hasOwn ? (
                    <button
                      type="button"
                      className="min-h-9 text-mute"
                      disabled={uploading}
                      onClick={() => {
                        dropPending();
                        setCover(place.imagePath ? { kind: "none" } : { kind: "keep" });
                      }}
                    >
                      Use ours
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
            <input ref={picker} type="file" accept="image/*" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={onPhoto} />
          </div>
        ) : null}
        <PlaceTypePicker value={type} onChange={setType} name="edit-type" />
        {error ? <Notice>{error}</Notice> : null}
        <Button type="submit" busy={busy === "save"} disabled={uploading}>
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
