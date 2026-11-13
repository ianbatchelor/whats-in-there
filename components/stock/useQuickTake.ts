"use client";

import { useCallback, useState } from "react";
import type { StockItem } from "@/lib/domain/stock";
import { formatQuantity } from "@/lib/domain/quantity";
import { friendlyError } from "@/lib/supabase/errors";
import { takeOut } from "@/lib/stock";
import { wineTitle } from "@/lib/domain/wine";

/** Wording for the toast after something is taken out; shared by the sheet and the one-tap button. */
export function tookOutMessage(before: StockItem, after: StockItem, amount: number, keep = false, wine = false): string {
  if (wine || before.wineColour || before.vintage) {
    const name = wineTitle(before.productName, before.vintage);
    const left = after.quantity > 0 ? `, ${after.quantity === 1 ? "1 bottle" : `${after.quantity} bottles`} left` : ", that was the last";
    return `Opened ${amount === 1 ? "a bottle" : `${amount} bottles`} of ${name}${left}`;
  }
  if (keep) {
    const what = before.unit === "item" ? `${amount} × ${before.productName}` : `${formatQuantity(amount, before.unit)} of ${before.productName}`;
    return after.quantity > 0
      ? `Removed ${what}, ${before.unit === "item" ? after.quantity : formatQuantity(after.quantity, after.unit)} left`
      : `Removed ${before.productName} from the list`;
  }
  const left = after.quantity > 0 ? `, ${formatQuantity(after.quantity, after.unit)} left` : ", all gone";
  return `Took out ${formatQuantity(amount, before.unit)} of ${before.productName}${left}`;
}

/**
 * The one-tap "took one out" on a list row. It goes through the same remove_stock call as the
 * sheet, so the version check and Undo work the same way.
 */
export function useQuickTake(announce: (message: string, movementId: string | null) => void, afterChange: () => void) {
  const [taking, setTaking] = useState<string | null>(null);
  const takeOne = useCallback(
    async (item: StockItem) => {
      if (taking) return;
      setTaking(item.id);
      try {
        const { item: after, movementId } = await takeOut(item, 1);
        afterChange();
        announce(tookOutMessage(item, after, 1), movementId);
      } catch (e) {
        announce(friendlyError(e), null);
      } finally {
        setTaking(null);
      }
    },
    [taking, announce, afterChange],
  );
  return { taking, takeOne };
}
