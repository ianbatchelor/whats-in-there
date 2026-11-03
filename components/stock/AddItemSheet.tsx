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

type Photo =
  | { state: "none" }
  | { state: "reading"; preview: string }
  | { state: "read"; preview: string; path: string; check: ExtractField[] }
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
  const keptPath = useRef<string | null>(null);

  // A photo that was uploaded but never saved with an item is removed when the sheet goes away.
  useEffect(() => {
    return () => {
      if (keptPath.current) void discardLabelPhoto(keptPath.current);
    };
  }, []);

  const preview = photo.state === "none" ? null : photo.preview;
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const check = new Set(photo.state === "read" ? photo.check : []);

  function dropPhoto() {
    attempt.current += 1;
    if (keptPath.current) void discardLabelPhoto(keptPath.current);
    keptPath.current = null;
    setPhoto({ state: "none" });
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
    keptPath.current = null;
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

  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (keptPath.current) void discardLabelPhoto(keptPath.current);
    keptPath.current = null;
    const mine = ++attempt.current;
    setError(null);
    let shown: string | null = null;
    try {
      const small = await shrinkPhoto(file);
      shown = URL.createObjectURL(small);
      if (mine !== attempt.current) return URL.revokeObjectURL(shown);
      setPhoto({ state: "reading", preview: shown });
      const path = await uploadLabelPhoto(place.householdId, small);
      if (mine !== attempt.current) return void discardLabelPhoto(path);
      const result = await readLabelPhoto(place.householdId, path);
      if (mine !== attempt.current) return void discardLabelPhoto(path);
      if (!result.ok) {
        void discardLabelPhoto(path);
        setPhoto({ state: "failed", preview: shown, message: readerError(result.code) });
        return;
      }
      keptPath.current = path;
      fill(result.reading);
      setPhoto({ state: "read", preview: shown, path, check: result.reading.check });
    } catch (err) {
      if (mine !== attempt.current) return;
      const message = err instanceof Error && err.message === "photo_failed" ? "That photo couldn't be opened. Try another one." : friendlyError(err);
      setPhoto({ state: "failed", preview: shown, message });
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
        imagePath: photo.state === "read" ? photo.path : null,
      });
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
            onClick={() => camera.current?.click()}
            className="lift flex items-center gap-3.5 rounded-2xl border border-line bg-sunk/60 p-3.5 text-left"
          >
            <span className="grid size-12 shrink-0 place-items-center rounded-full bg-tape text-on-tape" aria-hidden="true">
              <IconCamera className="size-6" />
            </span>
            <span className="min-w-0">
              <span className="block font-display text-[15px] font-bold">Snap the label</span>
              <span className="block text-[13px] text-mute">We&apos;ll fill in the name, size and dates for you to check.</span>
            </span>
          </button>
        ) : (
          <div className="flex items-center gap-3.5 rounded-2xl border border-line bg-sunk/60 p-3" aria-live="polite">
            {photo.preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photo.preview} alt="Your label photo" className="size-16 shrink-0 rounded-xl object-cover" />
            ) : null}
            <div className="min-w-0 flex-1">
              {reading ? (
                <p className="flex items-center gap-2 font-display text-[15px] font-bold">
                  <Spinner /> Reading the label…
                </p>
              ) : photo.state === "read" ? (
                <>
                  <p className="font-display text-[15px] font-bold">Filled in from your photo</p>
                  <p className="text-[13px] text-mute">{photo.check.length ? "Check the highlighted fields, then add it." : "Have a quick look, then add it."}</p>
                </>
              ) : (
                <p className="text-[13px]">{photo.state === "failed" ? photo.message : null}</p>
              )}
              {!reading ? (
                <div className="mt-1.5 flex gap-4 text-sm font-bold">
                  <button type="button" className="text-go" onClick={() => camera.current?.click()}>
                    {photo.state === "read" ? "Retake" : "Try another photo"}
                  </button>
                  <button type="button" className="text-mute" onClick={dropPhoto}>
                    Remove photo
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
