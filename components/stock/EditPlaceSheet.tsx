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
import { aKind, kindFromName } from "@/lib/domain/kindFromName";

export function EditPlaceSheet({
  open,
  onClose,
  place,
  itemCount,
  onSaved,
  onRemoved,
  homes = [],
  boxCount = 0,
  removeOnly = false,
}: {
  open: boolean;
  onClose: () => void;
  place: { id: string; name: string; type: LocationType; householdId: string; imagePath?: string | null; parentId?: string | null };
  itemCount: number;
  /** Places this one could sit inside. Empty when it holds boxes itself. */
  homes?: { id: string; name: string }[];
  /** Boxes inside this place, for the remove warning. */
  boxCount?: number;
  /** Opened from "Remove this place" on the place's page: just the confirmation. */
  removeOnly?: boolean;
  onSaved: () => void;
  onRemoved: () => void;
}) {
  const [name, setName] = useState(place.name);
  const [type, setType] = useState<LocationType>(place.type);
  const [parent, setParent] = useState<string>(place.parentId ?? "");
  const [confirm, setConfirm] = useState(removeOnly);
  // "Book shelf" saved as a Cupboard: offer the kind its name says.
  const suggested = kindFromName(name, type);
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
    if ((place.parentId ?? "") !== parent) changes.parent_id = parent || null;
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
    <Sheet open={open} onClose={onClose} title={removeOnly ? `Remove ${place.name}?` : "Edit place"}>
      {removeOnly ? null : (
        <form onSubmit={save} className="flex flex-col gap-3">
          {/* Everything to edit scrolls; Save stays in view below it. */}
          <div className="-mx-1 flex max-h-[52dvh] flex-col gap-4 overflow-y-auto px-1 pb-1">
            <Field label="Name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} hint="Stickers keep working when you rename." />
            {suggested ? (
              <button
                type="button"
                onClick={() => setType(suggested)}
                className="-mt-2 flex min-h-11 items-center gap-2 self-start rounded-xl bg-check px-3 text-left text-[14px] font-semibold text-fg ring-1 ring-check-line"
              >
                Sounds like {aKind(suggested)}. Make it one?
              </button>
            ) : null}
            <PlaceTypePicker value={type} onChange={setType} name="edit-type" />
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
                    <p className="text-[13px] text-mute">
                      {hasOwn ? "Your own photo of this place." : "Use a photo of your own so you can tell places apart."}
                    </p>
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
            {homes.length > 0 ? (
              <div className="flex min-w-0 flex-col gap-1.5">
                <label htmlFor="edit-place-parent" className="font-display text-sm font-bold">
                  Inside
                </label>
                <select
                  id="edit-place-parent"
                  value={parent}
                  onChange={(e) => setParent(e.target.value)}
                  className="min-h-12 w-full rounded-2xl border border-line bg-card px-4 text-base text-fg focus:border-leaf focus:ring-4 focus:ring-leaf/15 focus:outline-none"
                >
                  <option value="">Nothing, it&apos;s a place of its own</option>
                  {homes.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name}
                    </option>
                  ))}
                </select>
                <p className="text-sm text-mute">For a box, shelf or drawer that lives in another place. Moving it takes everything in it along.</p>
              </div>
            ) : null}
          </div>
          {error ? <Notice>{error}</Notice> : null}
          <Button type="submit" busy={busy === "save"} disabled={uploading}>
            Save
          </Button>
        </form>
      )}

      <div className={removeOnly ? "" : "border-t border-line pt-3"}>
        {confirm ? (
          <div className="flex flex-col gap-3">
            {removeOnly && error ? <Notice>{error}</Notice> : null}
            <p className="text-sm">
              {itemCount > 0
                ? `${place.name} still has ${itemCount === 1 ? "1 thing" : `${itemCount} things`} in it. They'll be hidden along with it, and its sticker will stop working.`
                : `Its sticker will stop working.`}
              {boxCount > 0 ? ` The ${boxCount === 1 ? "box" : `${boxCount} boxes`} inside it will stay, as places of their own.` : ""}
            </p>
            <div className="flex gap-2">
              <Button variant="ghost" className="flex-1" onClick={() => (removeOnly ? onClose() : setConfirm(false))}>
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
