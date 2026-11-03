"use client";

import { useState } from "react";
import type { LocationType } from "@/lib/household";
import type { StockItem } from "@/lib/domain/stock";
import { isCounted, roundQty, type StockUnit } from "@/lib/domain/quantity";
import { todayIso } from "@/lib/domain/dates";
import { addItem } from "@/lib/stock";
import { friendlyError } from "@/lib/supabase/errors";
import { Sheet } from "@/components/ui/Sheet";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { Stepper } from "./Stepper";

const UNITS: { value: StockUnit; label: string }[] = [
  { value: "item", label: "Items" },
  { value: "portion", label: "Portions" },
  { value: "pack", label: "Packs" },
  { value: "g", label: "g" },
  { value: "kg", label: "kg" },
  { value: "ml", label: "ml" },
  { value: "l", label: "litres" },
];

export function AddItemSheet({
  open,
  onClose,
  place,
  onAdded,
}: {
  open: boolean;
  onClose: () => void;
  place: { id: string; name: string; type: LocationType };
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
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | undefined>();

  function reset() {
    setName("");
    setUnit("item");
    setAmount("1");
    setFrozenAt(todayIso());
    setMore(false);
    setUseBy("");
    setBestBefore("");
    setBrand("");
    setNotes("");
    setError(null);
    setNameError(undefined);
  }

  function pickUnit(u: StockUnit) {
    if (isCounted(u) !== isCounted(unit)) setAmount(isCounted(u) ? "1" : "");
    setUnit(u);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const productName = name.trim();
    if (!productName) return setNameError("Say what it is, for example Chicken curry.");
    setNameError(undefined);
    const qty = roundQty(Number(amount.replace(",", ".")));
    if (!Number.isFinite(qty) || qty <= 0) return setError("Enter how much there is.");
    setBusy(true);
    try {
      const { item, movementId } = await addItem({
        locationId: place.id,
        productName: productName.slice(0, 120),
        quantity: qty,
        unit,
        brand: brand.trim(),
        frozenAt: isFreezer ? frozenAt || null : null,
        useByDate: useBy || null,
        bestBeforeDate: bestBefore || null,
        notes: notes.trim(),
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

  return (
    <Sheet open={open} onClose={onClose} title={`Add to ${place.name}`}>
      <form onSubmit={save} className="flex max-h-[75dvh] flex-col gap-4 overflow-y-auto" noValidate>
        <Field
          label="What is it?"
          placeholder="Chicken curry"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={120}
          autoComplete="off"
          enterKeyHint="next"
          error={nameError}
        />

        <fieldset className="flex min-w-0 flex-col gap-2">
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
            />
          )}
        </fieldset>

        {isFreezer ? (
          <Field label="Frozen on" type="date" value={frozenAt} max={todayIso()} onChange={(e) => setFrozenAt(e.target.value)} hint="Leave as today if it's going in now." />
        ) : null}

        {more ? (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Use by" type="date" value={useBy} onChange={(e) => setUseBy(e.target.value)} />
              <Field label="Best before" type="date" value={bestBefore} onChange={(e) => setBestBefore(e.target.value)} />
            </div>
            <Field label="Brand" placeholder="Optional" value={brand} onChange={(e) => setBrand(e.target.value)} maxLength={80} />
            <Field label="Notes" placeholder="Optional, e.g. for Sunday" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} />
          </div>
        ) : (
          <button type="button" onClick={() => setMore(true)} className="self-start text-sm font-bold text-go">
            + Dates printed on the pack, brand, notes
          </button>
        )}

        {error ? <Notice>{error}</Notice> : null}
        <Button type="submit" busy={busy}>
          Add to {place.name}
        </Button>
      </form>
    </Sheet>
  );
}
