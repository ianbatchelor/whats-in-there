"use client";

import { useState } from "react";
import type { StockItem } from "@/lib/domain/stock";
import { isCounted, roundQty, type StockUnit } from "@/lib/domain/quantity";
import { todayIso } from "@/lib/domain/dates";
import { updateItem } from "@/lib/stock";
import { friendlyError } from "@/lib/supabase/errors";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { Stepper } from "./Stepper";
import { SIZE_UNITS, UNITS } from "./AddItemSheet";

/** Change any detail of something already added: a misread name, a date, how much there is. */
export function EditItemForm({ item, onSaved, onCancel }: { item: StockItem; onSaved: (after: StockItem) => void; onCancel: () => void }) {
  const [name, setName] = useState(item.productName);
  const [unit, setUnit] = useState<StockUnit>(item.unit);
  const [amount, setAmount] = useState(String(roundQty(item.quantity)));
  const [useBy, setUseBy] = useState(item.useByDate ?? "");
  const [bestBefore, setBestBefore] = useState(item.bestBeforeDate ?? "");
  const [frozenAt, setFrozenAt] = useState(item.frozenAt ?? "");
  const [size, setSize] = useState(item.weightValue ? String(item.weightValue) : "");
  const [sizeUnit, setSizeUnit] = useState<StockUnit>(item.weightUnit ?? "g");
  const [brand, setBrand] = useState(item.brand ?? "");
  const [category, setCategory] = useState(item.category ?? "");
  const [notes, setNotes] = useState(item.notes ?? "");
  const [nameError, setNameError] = useState<string>();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function pickUnit(u: StockUnit) {
    // Counting and measuring don't convert: going from packs to grams asks for the amount again.
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
    if (!Number.isFinite(qty) || qty <= 0) return setError("Enter how much there is. To clear it out, use Take out instead.");
    const sizeValue = size.trim() ? roundQty(Number(size.replace(",", "."))) : null;
    if (sizeValue !== null && (!Number.isFinite(sizeValue) || sizeValue <= 0)) return setError("Enter the pack size as a number, or leave it empty.");
    setBusy(true);
    try {
      const after = await updateItem(item, {
        productName: productName.slice(0, 120),
        quantity: qty,
        unit,
        brand: brand.trim() || null,
        category: category.trim().slice(0, 40) || null,
        weightValue: sizeValue,
        weightUnit: sizeValue ? sizeUnit : null,
        useByDate: useBy || null,
        bestBeforeDate: bestBefore || null,
        frozenAt: frozenAt || null,
        notes: notes.trim() || null,
      });
      onSaved(after);
    } catch (err) {
      setError(friendlyError(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-4" noValidate>
      <Field label="What is it?" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} autoComplete="off" error={nameError} />

      <fieldset className="flex min-w-0 flex-col gap-2">
        <legend className="mb-1.5 text-sm font-bold">How much is there?</legend>
        <div className="flex gap-1.5 overflow-x-auto pb-1" role="radiogroup" aria-label="Unit">
          {UNITS.map((u) => (
            <button
              type="button"
              key={u.value}
              role="radio"
              aria-checked={unit === u.value}
              onClick={() => pickUnit(u.value)}
              className={`min-h-10 shrink-0 rounded-full border px-3.5 text-sm font-bold ${unit === u.value ? "border-fg bg-fg text-bg" : "border-line bg-card text-fg"}`}
            >
              {u.label}
            </button>
          ))}
        </div>
        {isCounted(unit) ? (
          <Stepper
            value={Number(amount) || 0}
            min={Number.isInteger(Number(amount)) ? 1 : 0.5}
            max={999}
            step={Number.isInteger(Number(amount)) ? 1 : 0.5}
            onChange={(n) => setAmount(String(n))}
            label={UNITS.find((u) => u.value === unit)!.label}
          />
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

      <div className="grid grid-cols-2 gap-3">
        <Field label="Use by" type="date" value={useBy} onChange={(e) => setUseBy(e.target.value)} />
        <Field label="Best before" type="date" value={bestBefore} onChange={(e) => setBestBefore(e.target.value)} />
      </div>
      <Field
        label="Frozen on"
        type="date"
        value={frozenAt}
        max={todayIso()}
        onChange={(e) => setFrozenAt(e.target.value)}
        hint={frozenAt ? "Clear it if it's been taken out of the freezer to defrost." : "Only for things in a freezer."}
      />

      <div className="flex min-w-0 flex-col gap-2">
        <Field label="Pack size" inputMode="decimal" placeholder="Optional, e.g. 750" value={size} onChange={(e) => setSize(e.target.value)} />
        <div className="flex gap-1.5" role="radiogroup" aria-label="Pack size unit">
          {SIZE_UNITS.map((u) => (
            <button
              type="button"
              key={u}
              role="radio"
              aria-checked={sizeUnit === u}
              onClick={() => setSizeUnit(u)}
              className={`min-h-9 shrink-0 rounded-full border px-3 text-sm font-bold ${sizeUnit === u ? "border-fg bg-fg text-bg" : "border-line bg-card text-fg"}`}
            >
              {u === "l" ? "litres" : u}
            </button>
          ))}
        </div>
      </div>
      <Field label="Brand or author" placeholder="Optional" value={brand} onChange={(e) => setBrand(e.target.value)} maxLength={80} />
      <Field label="Section" placeholder="Optional, e.g. Fiction or Coats" value={category} onChange={(e) => setCategory(e.target.value)} maxLength={40} />
      <Field label="Notes" placeholder="Optional" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} />

      {error ? <Notice>{error}</Notice> : null}
      <div className="flex gap-2">
        <Button type="submit" className="flex-1" busy={busy}>
          Save changes
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
