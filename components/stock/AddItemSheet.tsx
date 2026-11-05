"use client";

import { useEffect, useRef, useState } from "react";
import type { LocationType } from "@/lib/household";
import type { StockItem } from "@/lib/domain/stock";
import { isCounted, roundQty, type StockUnit } from "@/lib/domain/quantity";
import { todayIso } from "@/lib/domain/dates";
import { readerError, type ExtractField, type LabelReading } from "@/lib/domain/extraction";
import { addItem } from "@/lib/stock";
import { discardLabelPhoto, readLabelPhoto, shrinkPhoto, uploadLabelPhoto } from "@/lib/labelPhoto";
import { friendlyError } from "@/lib/supabase/errors";
import { Sheet } from "@/components/ui/Sheet";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { Spinner } from "@/components/ui/Spinner";
import { IconCamera } from "@/components/ui/icons";
import { Stepper } from "./Stepper";
import { placeType } from "@/components/home/placeTypes";

const UNITS: { value: StockUnit; label: string }[] = [
  { value: "item", label: "Items" },
  { value: "portion", label: "Portions" },
  { value: "pack", label: "Packs" },
  { value: "g", label: "g" },
  { value: "kg", label: "kg" },
  { value: "ml", label: "ml" },
  { value: "l", label: "litres" },
];
const SIZE_UNITS: StockUnit[] = ["g", "kg", "ml", "l"];
const CHECK_HINT = "From the photo. Worth a quick check.";

const MAX_SHOTS = 3;

/** One uploaded photo of the pack. The first is the front, and the one kept with the item. */
type Shot = { preview: string; path: string };
type Read = { state: "read"; shots: Shot[]; check: ExtractField[]; hasDate: boolean; note?: string };
type Photo =
  | { state: "none" }
  | { state: "reading"; previews: string[]; adding: boolean }
  | Read
  | { state: "failed"; preview: string | null; message: string };

export function AddItemSheet({
  open,
  onClose,
  place,
  onAdded,
}: {
  open: boolean;
  onClose: () => void;
  place: { id: string; name: string; type: LocationType; householdId: string };
  onAdded: (item: StockItem, movementId: string | null) => void;
}) {
  const isFreezer = place.type === "freezer";
  const [name, setName] = useState("");
  const [unit, setUnit] = useState<StockUnit>("item");
  const [amount, setAmount] = useState("1");
  const [frozenAt, setFrozenAt] = useState(todayIso());
  const [more, setMore] = useState(false);
  const [useBy, setUseBy] = useState("");
  const [bestBefore, setBestBefore] = useState("");
  const [brand, setBrand] = useState("");
  const [size, setSize] = useState("");
  const [sizeUnit, setSizeUnit] = useState<StockUnit>("g");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | undefined>();
  const [photo, setPhoto] = useState<Photo>({ state: "none" });
  const camera = useRef<HTMLInputElement>(null);
  const attempt = useRef(0);
  const keptPaths = useRef<string[]>([]);
  const previews = useRef<string[]>([]);
  const adding = useRef(false);

  // Photos that were uploaded but never saved with an item are removed when the sheet goes away.
  useEffect(() => {
    const urls = previews.current;
    return () => {
      void discardLabelPhoto(...keptPaths.current);
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, []);

  const check = new Set(photo.state === "read" ? photo.check : []);

  function forgetPreviews() {
    previews.current.forEach((u) => URL.revokeObjectURL(u));
    previews.current.length = 0;
  }

  function dropPhoto() {
    attempt.current += 1;
    void discardLabelPhoto(...keptPaths.current);
    keptPaths.current = [];
    forgetPreviews();
    setPhoto({ state: "none" });
  }

  function takePhoto(more: boolean) {
    adding.current = more;
    camera.current?.click();
  }

  function reset() {
    setName("");
    setUnit("item");
    setAmount("1");
    setFrozenAt(todayIso());
    setMore(false);
    setUseBy("");
    setBestBefore("");
    setBrand("");
    setSize("");
    setSizeUnit("g");
    setNotes("");
    setError(null);
    setNameError(undefined);
    attempt.current += 1;
    keptPaths.current = [];
    forgetPreviews();
    setPhoto({ state: "none" });
  }

  function close() {
    dropPhoto();
    onClose();
  }

  function pickUnit(u: StockUnit) {
    if (isCounted(u) !== isCounted(unit)) setAmount(isCounted(u) ? "1" : "");
    setUnit(u);
  }

  function fill(r: LabelReading) {
    setName(r.productName);
    setNameError(undefined);
    setUnit(r.unit);
    setAmount(String(r.quantity));
    setBrand(r.brand);
    setSize(r.weightValue ? String(r.weightValue) : "");
    if (r.weightUnit) setSizeUnit(r.weightUnit);
    setUseBy(r.useByDate ?? "");
    setBestBefore(r.bestBeforeDate ?? "");
    if (r.brand || r.weightValue || r.useByDate || r.bestBeforeDate || r.check.some((f) => f !== "product_name" && f !== "quantity")) {
      setMore(true);
    }
  }

  /**
   * A new front photo starts again. An extra photo (the back, a side or the lid) is uploaded and read
   * together with the ones already taken, so dates printed on the back are found too. If an extra
   * photo can't be read, the earlier reading stays as it was.
   */
  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const prev = adding.current && photo.state === "read" && photo.shots.length < MAX_SHOTS ? photo : null;
    if (!prev) {
      void discardLabelPhoto(...keptPaths.current);
      keptPaths.current = [];
      forgetPreviews();
    }
    const mine = ++attempt.current;
    setError(null);
    let shown: string | null = null;
    let path: string | null = null;
    const fail = (message: string) => {
      if (path) void discardLabelPhoto(path);
      setPhoto(prev ? { ...prev, note: message } : { state: "failed", preview: shown, message });
    };
    try {
      const small = await shrinkPhoto(file);
      shown = URL.createObjectURL(small);
      previews.current.push(shown);
      if (mine !== attempt.current) return;
      const before = prev?.shots ?? [];
      setPhoto({ state: "reading", previews: [...before.map((s) => s.preview), shown], adding: !!prev });
      path = await uploadLabelPhoto(place.householdId, small, !prev);
      if (mine !== attempt.current) return void discardLabelPhoto(path);
      const shots = [...before, { preview: shown, path }];
      const result = await readLabelPhoto(place.householdId, shots.map((s) => s.path));
      if (mine !== attempt.current) return void discardLabelPhoto(path);
      if (!result.ok) {
        const limited = result.code.startsWith("too_many");
        return fail(prev && !limited ? "We couldn't read that photo, so the details from the first one are kept." : readerError(result.code));
      }
      keptPaths.current = shots.map((s) => s.path);
      fill(result.reading);
      const r = result.reading;
      setPhoto({ state: "read", shots, check: r.check, hasDate: !!(r.useByDate || r.bestBeforeDate) });
    } catch (err) {
      if (mine !== attempt.current) return;
      fail(err instanceof Error && err.message === "photo_failed" ? "That photo couldn't be opened. Try another one." : friendlyError(err));
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const productName = name.trim();
    if (!productName) return setNameError("Say what it is, for example Chicken curry.");
    setNameError(undefined);
    const qty = roundQty(Number(amount.replace(",", ".")));
    if (!Number.isFinite(qty) || qty <= 0) return setError("Enter how much there is.");
    const sizeValue = size.trim() ? roundQty(Number(size.replace(",", "."))) : null;
    if (sizeValue !== null && (!Number.isFinite(sizeValue) || sizeValue <= 0)) return setError("Enter the pack size as a number, or leave it empty.");
    setBusy(true);
    try {
      const { item, movementId } = await addItem({
        locationId: place.id,
        productName: productName.slice(0, 120),
        quantity: qty,
        unit,
        brand: brand.trim(),
        weightValue: sizeValue,
        weightUnit: sizeValue ? sizeUnit : null,
        frozenAt: isFreezer ? frozenAt || null : null,
        useByDate: useBy || null,
        bestBeforeDate: bestBefore || null,
        notes: notes.trim(),
        imagePath: photo.state === "read" ? (photo.shots[0]?.path ?? null) : null,
      });
      // The front photo stays with the item; the back and side photos were only for reading.
      if (photo.state === "read") void discardLabelPhoto(...photo.shots.slice(1).map((s) => s.path));
      reset();
      onAdded(item, movementId);
      onClose();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  const reading = photo.state === "reading";

  return (
    <Sheet open={open} onClose={close} title={`Add to ${place.name}`}>
      <form onSubmit={save} className="flex max-h-[75dvh] flex-col gap-4 overflow-y-auto" noValidate>
        <input ref={camera} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={onPhoto} />

        {photo.state === "none" ? (
          <button
            type="button"
            onClick={() => takePhoto(false)}
            className="lift flex items-center gap-3.5 rounded-2xl border border-line bg-sunk/60 p-3.5 text-left"
          >
            <span className="grid size-12 shrink-0 place-items-center rounded-full bg-tape text-on-tape" aria-hidden="true">
              <IconCamera className="size-6" />
            </span>
            <span className="min-w-0">
              <span className="block font-display text-[15px] font-bold">Snap the label</span>
              <span className="block text-[13px] text-mute">Start with the front. We&apos;ll fill in the name, size and dates for you to check.</span>
            </span>
          </button>
        ) : (
          <div className="flex items-start gap-3.5 rounded-2xl border border-line bg-sunk/60 p-3" aria-live="polite">
            <PhotoStack previews={shownPreviews(photo)} />
            <div className="min-w-0 flex-1">
              {photo.state === "reading" ? (
                <p className="flex items-center gap-2 font-display text-[15px] font-bold">
                  <Spinner /> {photo.adding ? "Reading both sides…" : "Reading the label…"}
                </p>
              ) : photo.state === "read" ? (
                <>
                  <p className="font-display text-[15px] font-bold">Filled in from {photo.shots.length > 1 ? `${photo.shots.length} photos` : "your photo"}</p>
                  <p className="text-[13px] text-mute">
                    {photo.note
                      ? photo.note
                      : !photo.hasDate && photo.shots.length < MAX_SHOTS
                        ? "No date found. If it's on the back or the lid, add a photo of that."
                        : photo.check.length
                          ? "Check the highlighted fields, then add it."
                          : "Have a quick look, then add it."}
                  </p>
                </>
              ) : (
                <p className="text-[13px]">{photo.state === "failed" ? photo.message : null}</p>
              )}
              {photo.state !== "reading" ? (
                <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm font-bold">
                  {photo.state === "read" && photo.shots.length < MAX_SHOTS ? (
                    <button type="button" className="text-go" onClick={() => takePhoto(true)}>
                      {photo.shots.length === 1 ? "+ Add the back" : "+ Add another side"}
                    </button>
                  ) : null}
                  <button type="button" className={photo.state === "read" ? "text-mute" : "text-go"} onClick={() => takePhoto(false)}>
                    {photo.state === "read" ? "Start again" : "Try another photo"}
                  </button>
                  <button type="button" className="text-mute" onClick={dropPhoto}>
                    {photo.state === "read" && photo.shots.length > 1 ? "Remove photos" : "Remove photo"}
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        )}

        <Field
          label="What is it?"
          placeholder={placeType(place.type).thing}
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={120}
          autoComplete="off"
          enterKeyHint="next"
          error={nameError}
          check={check.has("product_name")}
          hint={check.has("product_name") ? CHECK_HINT : undefined}
          disabled={reading}
        />

        <fieldset className="flex min-w-0 flex-col gap-2" disabled={reading}>
          <legend className="mb-1.5 text-sm font-bold">How much?</legend>
          <div className="flex gap-1.5 overflow-x-auto pb-1" role="radiogroup" aria-label="Unit">
            {UNITS.map((u) => (
              <button
                type="button"
                key={u.value}
                role="radio"
                aria-checked={unit === u.value}
                onClick={() => pickUnit(u.value)}
                className={`min-h-10 shrink-0 rounded-full border px-3.5 text-sm font-bold ${
                  unit === u.value ? "border-fg bg-fg text-bg" : "border-line bg-card text-fg"
                }`}
              >
                {u.label}
              </button>
            ))}
          </div>
          {isCounted(unit) ? (
            <Stepper value={Number(amount) || 0} min={1} max={999} onChange={(n) => setAmount(String(n))} label={UNITS.find((u) => u.value === unit)!.label} />
          ) : (
            <Field
              label={`Amount in ${unit === "l" ? "litres" : unit}`}
              inputMode="decimal"
              placeholder={unit === "g" || unit === "ml" ? "500" : "1.5"}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              check={check.has("quantity")}
            />
          )}
          {check.has("quantity") ? <p className="text-sm text-mute">{CHECK_HINT}</p> : null}
        </fieldset>

        {isFreezer ? (
          <Field label="Frozen on" type="date" value={frozenAt} max={todayIso()} onChange={(e) => setFrozenAt(e.target.value)} hint="Leave as today if it's going in now." />
        ) : null}

        {more ? (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <Field
                label="Use by"
                type="date"
                value={useBy}
                onChange={(e) => setUseBy(e.target.value)}
                check={check.has("use_by_date")}
                hint={check.has("use_by_date") ? "Check this date." : undefined}
              />
              <Field
                label="Best before"
                type="date"
                value={bestBefore}
                onChange={(e) => setBestBefore(e.target.value)}
                check={check.has("best_before_date")}
                hint={check.has("best_before_date") ? "Check this date." : undefined}
              />
            </div>
            <div className="flex min-w-0 flex-col gap-2">
              <Field
                label="Pack size"
                inputMode="decimal"
                placeholder="Optional, e.g. 750"
                value={size}
                onChange={(e) => setSize(e.target.value)}
                check={check.has("weight")}
                hint={check.has("weight") ? CHECK_HINT : undefined}
              />
              <div className="flex gap-1.5" role="radiogroup" aria-label="Pack size unit">
                {SIZE_UNITS.map((u) => (
                  <button
                    type="button"
                    key={u}
                    role="radio"
                    aria-checked={sizeUnit === u}
                    onClick={() => setSizeUnit(u)}
                    className={`min-h-9 shrink-0 rounded-full border px-3 text-sm font-bold ${
                      sizeUnit === u ? "border-fg bg-fg text-bg" : "border-line bg-card text-fg"
                    }`}
                  >
                    {u === "l" ? "litres" : u}
                  </button>
                ))}
              </div>
            </div>
            <Field
              label="Brand"
              placeholder="Optional"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              maxLength={80}
              check={check.has("brand")}
              hint={check.has("brand") ? CHECK_HINT : undefined}
            />
            <Field label="Notes" placeholder="Optional, e.g. for Sunday" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} />
          </div>
        ) : (
          <button type="button" onClick={() => setMore(true)} className="self-start text-sm font-bold text-go">
            + Dates printed on the pack, size, brand, notes
          </button>
        )}

        {error ? <Notice>{error}</Notice> : null}
        <Button type="submit" busy={busy} disabled={reading}>
          Add to {place.name}
        </Button>
      </form>
    </Sheet>
  );
}

function shownPreviews(photo: Photo): string[] {
  if (photo.state === "reading") return photo.previews;
  if (photo.state === "read") return photo.shots.map((s) => s.preview);
  if (photo.state === "failed" && photo.preview) return [photo.preview];
  return [];
}

/** The photos taken so far: the front large, any back or side photos small beneath it. */
function PhotoStack({ previews }: { previews: string[] }) {
  if (!previews.length) return null;
  const [front, ...rest] = previews;
  return (
    <div className="flex shrink-0 flex-col items-center gap-1.5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={front} alt="Front of the pack" className="size-16 rounded-xl object-cover" />
      {rest.length ? (
        <div className="flex gap-1">
          {rest.map((src, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={src} src={src} alt={i === 0 ? "Back of the pack" : "Another side of the pack"} className="size-[30px] rounded-lg object-cover" />
          ))}
        </div>
      ) : null}
    </div>
  );
}
