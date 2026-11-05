"use client";

import { useEffect, useState } from "react";
import type { StockItem } from "@/lib/domain/stock";
import { checkRemoval, formatQuantity, isCounted, roundQty } from "@/lib/domain/quantity";
import { formatDay } from "@/lib/domain/dates";
import { loadHistory, takeOut, type Movement } from "@/lib/stock";
import { friendlyError } from "@/lib/supabase/errors";
import { Sheet } from "@/components/ui/Sheet";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { Stepper } from "./Stepper";
import { ItemTile, itemContext } from "./ItemRow";

export function TakeOutSheet({
  item,
  placeName,
  names,
  onClose,
  onTaken,
}: {
  item: StockItem | null;
  placeName?: string;
  names: Map<string, string>;
  onClose: () => void;
  onTaken: (before: StockItem, after: StockItem, amount: number, movementId: string | null) => void;
}) {
  return (
    <Sheet open={item !== null} onClose={onClose} title={item?.productName ?? ""}>
      {item ? <Body key={`${item.id}:${item.version}`} item={item} placeName={placeName} names={names} onClose={onClose} onTaken={onTaken} /> : null}
    </Sheet>
  );
}

function Body({
  item,
  placeName,
  names,
  onClose,
  onTaken,
}: {
  item: StockItem;
  placeName?: string;
  names: Map<string, string>;
  onClose: () => void;
  onTaken: (before: StockItem, after: StockItem, amount: number, movementId: string | null) => void;
}) {
  const counted = isCounted(item.unit);
  const qty = roundQty(item.quantity);
  const step = counted && !Number.isInteger(qty) ? 0.5 : 1;
  const [count, setCount] = useState(Math.min(step, qty));
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<Movement[] | null>(null);

  useEffect(() => {
    let active = true;
    loadHistory(item.id)
      .then((h) => active && setHistory(h))
      .catch(() => active && setHistory([]));
    return () => {
      active = false;
    };
  }, [item.id]);

  const amount = counted ? count : roundQty(Number(typed.replace(",", ".")));
  const all = roundQty(amount) === qty;

  async function submit(chosen: number) {
    setError(null);
    const check = checkRemoval(qty, chosen, item.unit);
    if (!check.ok) return setError(friendlyError(check.reason));
    setBusy(true);
    try {
      const { item: after, movementId } = await takeOut(item, chosen);
      onTaken(item, after, chosen, movementId);
      onClose();
    } catch (err) {
      setError(friendlyError(err));
      setBusy(false);
    }
  }

  const addedBy = item.addedBy ? names.get(item.addedBy) : undefined;

  return (
    <div className="flex max-h-[75dvh] flex-col gap-4 overflow-y-auto">
      <div className="flex items-start gap-3.5">
        {item.imagePath ? <ItemTile name={item.productName} imagePath={item.imagePath} size={64} /> : null}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="font-mono text-[12px] text-mute">
            {placeName ? `${placeName} · ` : ""}
            {itemContext(item)}
          </p>
          <p className="text-sm text-mute">
            {formatQuantity(qty, item.unit)} left
            {addedBy ? ` · added by ${addedBy}` : ""}
            {item.brand ? ` · ${item.brand}` : ""}
          </p>
          {item.notes ? <p className="text-sm">{item.notes}</p> : null}
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-line bg-card p-4">
        <p className="text-sm font-bold">How much are you taking?</p>
        {counted ? (
          qty > step ? (
            <Stepper value={count} min={step} max={qty} step={step} onChange={setCount} label="Amount to take out" />
          ) : null
        ) : (
          <Field
            label={`Amount in ${item.unit === "l" ? "litres" : item.unit}`}
            inputMode="decimal"
            placeholder={String(qty)}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
          />
        )}
        <div className="flex gap-2">
          <Button className="flex-1" busy={busy} onClick={() => submit(amount)} disabled={!amount}>
            {all ? "Take out all" : `Take out ${formatQuantity(amount || 0, item.unit)}`}
          </Button>
          {!all ? (
            <Button variant="ghost" onClick={() => submit(qty)} disabled={busy}>
              All
            </Button>
          ) : null}
        </div>
        {all ? <p className="text-xs text-mute">It will move to history as used up. You can undo straight after.</p> : null}
      </div>

      {error ? <Notice>{error}</Notice> : null}

      <section aria-labelledby="hist-h" className="flex flex-col gap-2">
        <h3 id="hist-h" className="font-mono text-[11px] tracking-[0.1em] text-mute uppercase">
          History
        </h3>
        {history === null ? (
          <div className="h-10 animate-pulse rounded-xl bg-card" />
        ) : (
          <ol className="flex flex-col gap-1.5 text-sm">
            {history.map((m) => (
              <li key={m.id} className="flex justify-between gap-3">
                <span>{describe(m, item, names)}</span>
                <span className="shrink-0 font-mono text-[12px] text-mute">{formatDay(m.at.slice(0, 10), { year: false })}</span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

function describe(m: Movement, item: StockItem, names: Map<string, string>): string {
  const who = (m.actor && names.get(m.actor)) || "Someone";
  const amount = formatQuantity(Math.abs(m.delta), item.unit);
  switch (m.action) {
    case "add":
      return `${who} added ${amount}`;
    case "remove":
      return `${who} took out ${amount}`;
    case "undo":
      return `${who} undid a change`;
    default:
      return `${who} changed it to ${formatQuantity(m.after, item.unit)}`;
  }
}
