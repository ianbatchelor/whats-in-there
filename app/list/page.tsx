"use client";

import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { AuthGate } from "@/components/AuthGate";
import { AppShell, SectionLabel } from "@/components/AppShell";
import { HouseholdLoading, PageHeader } from "@/components/common/PageHeader";
import { useHousehold } from "@/lib/hooks/useHousehold";
import { supabase } from "@/lib/supabase/client";
import { friendlyError } from "@/lib/supabase/errors";
import { addToList, loadList, putAway, removeFromList, setBought, setPlace } from "@/lib/shopping";
import { splitList, type ShoppingItem } from "@/lib/domain/shopping";
import { nestedOrder, countThings } from "@/lib/domain/places";
import { formatQuantity } from "@/lib/domain/quantity";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { Toast, type ToastData } from "@/components/ui/Toast";
import { IconBasket, IconCheck, IconPlus, IconX } from "@/components/ui/icons";

export default function ShoppingListPage() {
  return <AuthGate>{(session) => <ShoppingList session={session} />}</AuthGate>;
}

type Spot = { id: string; label: string };

function ShoppingList({ session }: { session: Session }) {
  const { current, places, placeById, names, error, setError } = useHousehold(session);
  const [items, setItems] = useState<ShoppingItem[] | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastData | null>(null);
  const say = (message: string, undo?: () => void) =>
    setToast((t) => ({ id: (t?.id ?? 0) + 1, message, actionLabel: undo ? "Undo" : undefined, onAction: undo }));

  const refresh = useCallback(async () => {
    if (!current) return;
    try {
      setItems(await loadList(current.householdId));
    } catch (e) {
      setError(friendlyError(e));
    }
  }, [current, setError]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  // Someone else ticks something off in the shop: see it straight away.
  useEffect(() => {
    if (!current) return;
    const channel = supabase()
      .channel(`list:${current.householdId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "shopping_items", filter: `household_id=eq.${current.householdId}` }, () => refresh())
      .subscribe();
    return () => {
      supabase().removeChannel(channel);
    };
  }, [current, refresh]);

  // Places to put things away in, each followed by the boxes inside it.
  const spots: Spot[] = places ? nestedOrder(places).map(({ place }) => ({ id: place.id, label: placeById.get(place.id)?.name ?? place.name })) : [];
  const spotName = (id: string | null) => (id ? placeById.get(id)?.name : undefined);

  async function run(key: string, work: () => Promise<void>) {
    setError(null);
    setBusy(key);
    try {
      await work();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(null);
      refresh();
    }
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const n = name.trim();
    if (!n || !current) return;
    await run("add", async () => {
      const added = await addToList(current.householdId, { name: n });
      setName("");
      if (!added) say(`${n} is already on the list`);
    });
  }

  const tick = (item: ShoppingItem, bought: boolean) =>
    run(item.id, async () => {
      await setBought(item.id, bought);
      if (bought) say(`Got ${item.name}`, () => run(item.id, () => setBought(item.id, false)));
    });

  const remove = (item: ShoppingItem) =>
    run(item.id, async () => {
      await removeFromList([item.id]);
      say(`Took ${item.name} off the list`, () =>
        run(item.id, async () => {
          await addToList(current!.householdId, { ...item, locationId: item.locationId });
        }),
      );
    });

  const putOne = (item: ShoppingItem) =>
    run(item.id, async () => {
      await putAway(item.id);
      say(`Put ${item.name} in ${spotName(item.locationId) ?? "its place"}`);
    });

  async function putAll(bought: ShoppingItem[]) {
    const ready = bought.filter((i) => i.locationId && placeById.has(i.locationId));
    await run("all", async () => {
      let done = 0;
      for (const i of ready) {
        await putAway(i.id);
        done++;
      }
      const left = bought.length - done;
      say(`Put away ${countThings(done)}${left > 0 ? `. ${left === 1 ? "1 needs" : `${left} need`} a place first` : ""}`);
    });
  }

  const clearBought = (bought: ShoppingItem[]) =>
    run("clear", async () => {
      await removeFromList(bought.map((i) => i.id));
      say(`Cleared ${countThings(bought.length)} from the basket`);
    });

  const { toBuy, bought } = items ? splitList(items) : { toBuy: [], bought: [] };
  const placed = bought.filter((i) => i.locationId && placeById.has(i.locationId)).length;
  const who = (id: string | null) => (id === session.user.id ? "you" : (id && names.get(id)) || null);

  return (
    <AppShell>
      <PageHeader
        title="Shopping list"
        back={{ href: "/lists/", label: "Lists" }}
        sub={current ? `Shared with everyone in ${current.name}. Tick things off as you shop.` : "Tick things off as you shop."}
      />

      <form onSubmit={add} className="flex gap-2">
        <label htmlFor="list-add" className="sr-only">
          Add something to buy
        </label>
        <input
          id="list-add"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Add something to buy"
          maxLength={120}
          autoComplete="off"
          enterKeyHint="done"
          className="min-h-12 w-full min-w-0 flex-1 rounded-2xl border border-line bg-card px-4 text-base text-fg shadow-[inset_0_1px_2px_rgba(23,36,42,0.04)] placeholder:text-mute focus:border-leaf focus:ring-4 focus:ring-leaf/15 focus:outline-none"
        />
        <Button type="submit" busy={busy === "add"} disabled={!name.trim()} className="shrink-0 px-4">
          <IconPlus className="size-[18px]" /> Add
        </Button>
      </form>

      {error ? <Notice>{error}</Notice> : null}

      {items === null ? (
        <HouseholdLoading />
      ) : (
        <>
          <section aria-labelledby="buy-h" className="flex flex-col gap-2.5">
            <SectionLabel id="buy-h">To buy {toBuy.length > 0 ? <span className="font-semibold text-mute">· {toBuy.length}</span> : null}</SectionLabel>
            {toBuy.length === 0 ? (
              <div className="flex items-center gap-3.5 rounded-[var(--radius-card)] border-2 border-dashed border-line bg-sunk/40 p-5">
                <IconBasket className="size-8 shrink-0 text-leaf" />
                <p className="text-[15px] text-mute">
                  {bought.length > 0 ? "That's everything. " : "Nothing to buy. "}
                  When you finish something, tap <b className="text-fg">Add to list</b> on it, or type it above.
                </p>
              </div>
            ) : (
              <ul className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-card shadow-[var(--shadow-card)]">
                {toBuy.map((i) => (
                  <Row
                    key={i.id}
                    item={i}
                    spots={spots}
                    spotName={spotName(i.locationId)}
                    addedBy={who(i.addedBy)}
                    busy={busy === i.id}
                    onTick={tick}
                    onRemove={remove}
                    onPlace={(id) => run(i.id, () => setPlace(i.id, id))}
                  />
                ))}
              </ul>
            )}
          </section>

          {bought.length > 0 ? (
            <section aria-labelledby="basket-h" className="flex flex-col gap-2.5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <SectionLabel id="basket-h">
                  In the basket <span className="font-semibold text-mute">· {bought.length}</span>
                </SectionLabel>
                <button onClick={() => clearBought(bought)} disabled={busy !== null} className="min-h-10 text-[14px] font-semibold text-mute hover:text-fg">
                  Clear
                </button>
              </div>
              <ul className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-card shadow-[var(--shadow-card)]">
                {bought.map((i) => (
                  <Row
                    key={i.id}
                    item={i}
                    spots={spots}
                    spotName={spotName(i.locationId)}
                    busy={busy === i.id}
                    onTick={tick}
                    onRemove={remove}
                    onPlace={(id) => run(i.id, () => setPlace(i.id, id))}
                    // With only one to put away, the big button below does it; a second button on the row would repeat it.
                    onPutAway={placed > 1 && i.locationId && placeById.has(i.locationId) ? () => putOne(i) : undefined}
                  />
                ))}
              </ul>
              {placed > 0 ? (
                <Button onClick={() => putAll(bought)} busy={busy === "all"} className="max-sm:w-full sm:self-start">
                  {placed === 1 ? "Put it away" : `Put ${placed} things away`}
                </Button>
              ) : null}
              <p className="text-[13.5px] text-mute">
                Putting away adds them to their places, so they show up at home. Add dates afterwards if they have them.
              </p>
            </section>
          ) : null}
        </>
      )}
      <Toast toast={toast} onDone={() => setToast(null)} />
    </AppShell>
  );
}

function Row({
  item,
  spots,
  spotName,
  addedBy,
  busy,
  onTick,
  onRemove,
  onPlace,
  onPutAway,
}: {
  item: ShoppingItem;
  spots: Spot[];
  spotName?: string;
  addedBy?: string | null;
  busy: boolean;
  onTick: (item: ShoppingItem, bought: boolean) => void;
  onRemove: (item: ShoppingItem) => void;
  onPlace: (locationId: string | null) => void;
  onPutAway?: () => void;
}) {
  const bought = !!item.boughtAt;
  const amount = item.quantity === 1 && item.unit === "item" ? null : formatQuantity(item.quantity, item.unit);
  return (
    <li className="flex items-center gap-3 border-b border-line py-2 pr-2 pl-3 last:border-b-0" aria-busy={busy || undefined}>
      <button
        onClick={() => onTick(item, !bought)}
        disabled={busy}
        aria-pressed={bought}
        aria-label={bought ? `${item.name}, got it. Put it back on the list` : `Got ${item.name}`}
        className="grid size-11 shrink-0 place-items-center"
      >
        <span
          className={`grid size-7 place-items-center rounded-full border-2 transition ${bought ? "border-go bg-go text-on-go" : "border-line text-transparent hover:border-leaf"}`}
        >
          <IconCheck className="size-4" />
        </span>
      </button>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5 py-1">
        <p className={`truncate font-semibold ${bought ? "text-mute line-through decoration-mute/60" : ""}`}>
          {item.name}
          {amount && !bought ? <span className="font-normal text-mute"> · {amount}</span> : null}
        </p>
        <div className="flex min-w-0 items-center gap-1.5 text-[13px] text-mute">
          <label className="relative inline-flex min-h-8 min-w-0 shrink items-center gap-1 rounded-full bg-sunk pr-2.5 pl-3 font-medium text-fg/80 focus-within:ring-2 focus-within:ring-leaf/40">
            <span className="truncate">{spotName ?? "Goes in…"}</span>
            <span aria-hidden="true" className="text-[12px]">
              ▾
            </span>
            <select
              aria-label={`Where ${item.name} goes`}
              value={spotName ? (item.locationId ?? "") : ""}
              onChange={(e) => onPlace(e.target.value || null)}
              disabled={busy}
              className="absolute inset-x-0 -inset-y-1.5 w-full cursor-pointer opacity-0"
            >
              <option value="">Not sure yet</option>
              {spots.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          {item.brand ? <span className="min-w-0 truncate">{item.brand}</span> : addedBy ? <span className="min-w-0 truncate">added by {addedBy}</span> : null}
        </div>
      </div>
      {onPutAway ? (
        <Button variant="ghost" onClick={onPutAway} disabled={busy} className="min-h-9 shrink-0 rounded-xl px-3 text-[13.5px]">
          Put away
        </Button>
      ) : (
        <button
          onClick={() => onRemove(item)}
          disabled={busy}
          aria-label={`Take ${item.name} off the list`}
          className="grid size-11 shrink-0 place-items-center rounded-xl text-mute hover:bg-sunk hover:text-fg"
        >
          <IconX className="size-[18px]" />
        </button>
      )}
    </li>
  );
}
