"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { loadList, putAway } from "@/lib/shopping";
import { splitList, type ShoppingItem } from "@/lib/domain/shopping";
import { basketLine } from "@/lib/domain/basket";
import { friendlyError } from "@/lib/supabase/errors";
import { Button } from "@/components/ui/Button";
import { IconBasket } from "@/components/ui/icons";

/**
 * Back from the shops: what was ticked off in the shop, with one button that puts it all away in
 * its places. Shown at the top of Home only while something is in the basket.
 */
export function BasketCard({
  householdId,
  placeIds,
  version,
  onDone,
}: {
  householdId: string;
  /** Places that still exist: a thing whose place was removed needs choosing again on the list. */
  placeIds: Set<string>;
  version: number;
  onDone: (message: string) => void;
}) {
  const [bought, setBought] = useState<ShoppingItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let live = true;
    loadList(householdId)
      .then((items) => live && setBought(splitList(items).bought))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [householdId, version, reload]);

  if (bought.length === 0) return null;
  const ready = bought.filter((i) => i.locationId && placeIds.has(i.locationId));
  const line = basketLine(bought.length, ready.length);

  async function putAll() {
    setBusy(true);
    let done = 0;
    try {
      for (const i of ready) {
        await putAway(i.id);
        done++;
      }
      const left = bought.length - done;
      onDone(`Put away ${done === 1 ? "1 thing" : `${done} things`}${left > 0 ? `. ${left === 1 ? "1 needs" : `${left} need`} a place on the shopping list` : ""}`);
    } catch (e) {
      onDone(friendlyError(e));
    } finally {
      setBusy(false);
      setReload((n) => n + 1);
    }
  }

  return (
    <section aria-label="Shopping to put away" className="flex flex-wrap items-center gap-x-3 gap-y-2.5 rounded-[var(--radius-card)] border border-line bg-card px-4 py-3 shadow-[var(--shadow-card)]">
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-leaf/10 text-leaf" aria-hidden="true">
        <IconBasket className="size-5" />
      </span>
      <span className="min-w-0 flex-1 text-[14.5px] leading-snug">
        <span className="block font-semibold">{line.title}</span>
        <span className="block truncate text-[13.5px] text-mute">{bought.map((i) => i.name).join(", ")}</span>
      </span>
      {ready.length > 0 ? (
        <Button busy={busy} onClick={putAll} className="min-h-11 shrink-0 px-4 max-[380px]:w-full">
          {line.button}
        </Button>
      ) : null}
      {ready.length < bought.length ? (
        <Link href="/list/" className="w-full text-[13.5px] font-semibold text-leaf">
          {line.choose}
        </Link>
      ) : null}
    </section>
  );
}
