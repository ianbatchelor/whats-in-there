"use client";

import { useEffect, useState } from "react";
import type { StockItem } from "@/lib/domain/stock";
import { checkRemoval, formatQuantity, isCounted, roundQty } from "@/lib/domain/quantity";
import { formatDay } from "@/lib/domain/dates";
import { lendItem, loadHistory, takeOut, type Movement } from "@/lib/stock";
import { friendlyError } from "@/lib/supabase/errors";
import { Sheet } from "@/components/ui/Sheet";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { Stepper } from "./Stepper";
import { ItemTile, StatusPill } from "./ItemRow";
import { itemStatus } from "@/lib/domain/status";
import { IconBasket, IconCheck, IconHandOver, IconMove, IconPencil } from "@/components/ui/icons";
import { addToList } from "@/lib/shopping";
import { fromStock } from "@/lib/domain/shopping";
import { askBackMessage, isLongLent, lentFor } from "@/lib/domain/lending";
import { EditItemForm } from "./EditItemForm";
import { MovePicker } from "./MovePicker";
import { LendForm } from "./LendForm";

export function TakeOutSheet({
  item,
  placeName,
  keep = false,
  householdId,
  names,
  onClose,
  onTaken,
  onChanged,
}: {
  item: StockItem | null;
  placeName?: string;
  /** It's in a place for keeping things (a shelf, a wardrobe), not using them up. */
  keep?: boolean;
  /** Lets things be put on the household's shopping list. */
  householdId?: string;
  names: Map<string, string>;
  onClose: () => void;
  onTaken: (before: StockItem, after: StockItem, amount: number, movementId: string | null) => void;
  /** After an edit or a move: what to tell the person, and the movement to undo (moves only). */
  onChanged: (message: string, movementId: string | null) => void;
}) {
  return (
    <Sheet side open={item !== null} onClose={onClose} title={item?.productName ?? ""}>
      {item ? (
        <Body
          key={`${item.id}:${item.version}`}
          item={item}
          placeName={placeName}
          keep={keep}
          householdId={householdId}
          names={names}
          onClose={onClose}
          onTaken={onTaken}
          onChanged={onChanged}
        />
      ) : null}
    </Sheet>
  );
}

function Body({
  item,
  placeName,
  keep,
  householdId,
  names,
  onClose,
  onTaken,
  onChanged,
}: {
  item: StockItem;
  placeName?: string;
  keep: boolean;
  householdId?: string;
  names: Map<string, string>;
  onClose: () => void;
  onTaken: (before: StockItem, after: StockItem, amount: number, movementId: string | null) => void;
  onChanged: (message: string, movementId: string | null) => void;
}) {
  const [mode, setMode] = useState<"view" | "edit" | "move" | "lend">("view");
  const counted = isCounted(item.unit);
  const qty = roundQty(item.quantity);
  const step = counted && !Number.isInteger(qty) ? 0.5 : 1;
  // One pack, one tin: nothing to choose, so the question is simply whether it's used up.
  const single = counted && qty <= step;
  const [count, setCount] = useState(Math.min(step, qty));
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<Movement[] | null>(null);
  const canList = !keep && !!householdId;
  const [listed, setListed] = useState(false);
  const [rebuy, setRebuy] = useState(false);

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
      // Used the last of it: on the list for next time, if asked. The take-out stands either way.
      if (canList && rebuy && !listed && roundQty(chosen) === qty) await addToList(householdId!, fromStock(item)).catch(() => {});
      onTaken(item, after, chosen, movementId);
      onClose();
    } catch (err) {
      setError(friendlyError(err));
      setBusy(false);
    }
  }

  const addedBy = item.addedBy ? names.get(item.addedBy) : undefined;

  async function addToShopping() {
    setError(null);
    setBusy(true);
    try {
      await addToList(householdId!, fromStock(item));
      setListed(true);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  const [asked, setAsked] = useState<string | null>(null);
  async function askBack() {
    const text = askBackMessage(item.productName, item.lentTo ?? "");
    try {
      if (navigator.share) {
        await navigator.share({ text });
        return;
      }
      await navigator.clipboard.writeText(text);
      setAsked("Message copied. Paste it into a text to them.");
    } catch (err) {
      // Closing the share sheet isn't a failure.
      if ((err as { name?: string })?.name !== "AbortError") setAsked(`Couldn't open sharing. Send them: "${text}"`);
    }
  }

  async function giveBack() {
    setError(null);
    setBusy(true);
    try {
      const after = await lendItem(item, null);
      onChanged(`${after.productName} is back`, null);
      onClose();
    } catch (err) {
      setError(friendlyError(err));
      setBusy(false);
    }
  }

  return (
    <div className="flex max-h-[75dvh] flex-col gap-4 overflow-y-auto lg:max-h-none lg:min-h-0 lg:flex-1">
      <div className="flex items-start gap-3.5">
        {item.imagePath ? <ItemTile name={item.productName} imagePath={item.imagePath} size={64} /> : null}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-mute">
            {/* A far-off date would read twice ("6 Dec", then "Best before 6 Dec 2026"), so the pill is only for dates that need acting on. */}
            {itemStatus(item)?.tone === "ok" ? null : <StatusPill item={item} />}
            <span>{[placeName, itemStatus(item)?.detail].filter(Boolean).join(" · ")}</span>
          </p>
          <p className="text-sm text-mute">
            {[
              // A book is just there; "1 item left" only makes sense for things that get used up.
              keep && counted && qty === 1 ? null : keep ? formatQuantity(qty, item.unit) : `${formatQuantity(qty, item.unit)} left`,
              item.brand,
              addedBy ? `added by ${addedBy}` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {item.notes ? <p className="text-sm">{item.notes}</p> : null}
        </div>
      </div>

      {mode === "edit" ? (
        <EditItemForm
          item={item}
          onCancel={() => setMode("view")}
          onSaved={(after) => {
            onChanged(`Saved changes to ${after.productName}`, null);
            onClose();
          }}
        />
      ) : mode === "lend" ? (
        <LendForm
          item={item}
          onCancel={() => setMode("view")}
          onLent={(after, to) => {
            onChanged(`Lent ${after.productName} to ${to}`, null);
            onClose();
          }}
        />
      ) : mode === "move" ? (
        <MovePicker
          item={item}
          onCancel={() => setMode("view")}
          onMoved={(after, to, movementId) => {
            onChanged(`Moved ${after.productName} to ${to}`, movementId);
            onClose();
          }}
        />
      ) : (
        <>
          {item.lentTo ? (
            <div
              className={`flex flex-col gap-3 rounded-[var(--radius-card)] border p-3.5 ${isLongLent(item) ? "border-late/30 bg-late-bg" : "border-soon/30 bg-soon-bg"}`}
            >
              <div className="flex items-center gap-3">
                <IconHandOver className={`size-5 shrink-0 ${isLongLent(item) ? "text-late" : "text-soon"}`} />
                <p className="min-w-0 flex-1 text-sm">
                  <b>With {item.lentTo}</b>
                  {item.lentOn ? (
                    <span className="text-mute">
                      {" "}
                      {isLongLent(item)
                        ? `for ${lentFor(item.lentOn)}, since ${formatDay(item.lentOn, { year: false })}`
                        : `since ${formatDay(item.lentOn, { year: false })}`}
                    </span>
                  ) : null}
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" className="min-h-10 flex-1 px-3" onClick={askBack}>
                  Ask for it back
                </Button>
                <Button variant="ghost" className="min-h-10 flex-1 px-3" busy={busy} onClick={giveBack}>
                  It&apos;s back
                </Button>
              </div>
              {asked ? (
                <p className="text-[13px] text-mute" aria-live="polite">
                  {asked}
                </p>
              ) : null}
            </div>
          ) : null}

          <div className={canList ? "grid grid-cols-2 gap-2" : "flex gap-2"}>
            <Button variant="ghost" className="min-h-11 flex-1 px-3" onClick={() => setMode("edit")}>
              <IconPencil className="size-[18px]" /> Edit
            </Button>
            <Button variant="ghost" className="min-h-11 flex-1 px-3" onClick={() => setMode("move")}>
              <IconMove className="size-[18px]" /> Move to…
            </Button>
            {canList ? (
              <Button variant="ghost" className="col-span-2 min-h-11 px-3" onClick={addToShopping} disabled={busy || listed} aria-live="polite">
                {listed ? <IconCheck className="size-[18px]" /> : <IconBasket className="size-[18px]" />}{" "}
                {listed ? "On the shopping list" : "Add to shopping list"}
              </Button>
            ) : null}
            {keep && !item.lentTo ? (
              <Button variant="ghost" className="min-h-11 flex-1 px-3" onClick={() => setMode("lend")}>
                <IconHandOver className="size-[18px]" /> Lend…
              </Button>
            ) : null}
          </div>

          <div className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-line bg-card p-4">
            <p className="text-sm font-bold">{keep ? "Not keeping it any more?" : single ? "Used it up?" : "How much are you taking?"}</p>
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
              <Button className="flex-1" variant={keep ? "ghost" : undefined} busy={busy} onClick={() => submit(amount)} disabled={!amount}>
                {keep
                  ? all
                    ? "Remove it"
                    : `Remove ${formatQuantity(amount || 0, item.unit)}`
                  : single
                    ? "Take it out"
                    : all
                      ? "Take out all"
                      : `Take out ${formatQuantity(amount || 0, item.unit)}`}
              </Button>
              {!all ? (
                <Button variant="ghost" onClick={() => submit(qty)} disabled={busy}>
                  All
                </Button>
              ) : null}
            </div>
            {all && canList && !listed ? (
              <label className="flex min-h-11 cursor-pointer items-center gap-3 text-[15px]">
                <input type="checkbox" checked={rebuy} onChange={(e) => setRebuy(e.target.checked)} className="size-5 accent-[var(--color-go)]" />
                Add it to the shopping list
              </label>
            ) : null}
            {all ? (
              <p className="text-xs text-mute">
                {keep
                  ? "Given away, sold or gone? It moves to history. You can undo straight after."
                  : "It will move to history as used up. You can undo straight after."}
              </p>
            ) : null}
          </div>

          {error ? <Notice>{error}</Notice> : null}

          <section aria-labelledby="hist-h" className="flex flex-col gap-2">
            <h3 id="hist-h" className="text-[13px] font-semibold text-mute">
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
        </>
      )}
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
    case "lend":
      return m.person ? `${who} lent it to ${m.person}` : `${who} lent it out`;
    case "return":
      return m.person ? `${who} marked it back from ${m.person}` : `${who} marked it back`;
    case "move":
      return m.toLocationId === item.locationId ? `${who} moved it here` : `${who} moved it`;
    default:
      return m.edited && m.delta === 0 ? `${who} edited the details` : `${who} changed it to ${formatQuantity(m.after, item.unit)}`;
  }
}
