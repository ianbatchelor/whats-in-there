"use client";

import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { AuthGate } from "@/components/AuthGate";
import { AppShell } from "@/components/AppShell";
import { HouseholdLoading, PageHeader } from "@/components/common/PageHeader";
import { useHousehold } from "@/lib/hooks/useHousehold";
import { friendlyError } from "@/lib/supabase/errors";
import { isKeepPlace } from "@/lib/domain/places";
import { isLongLent } from "@/lib/domain/lending";
import type { StockItem } from "@/lib/domain/stock";
import { lendItem, loadLent } from "@/lib/stock";
import { ItemList, ItemRow } from "@/components/stock/ItemRow";
import { TakeOutSheet } from "@/components/stock/TakeOutSheet";
import { useUndoToast } from "@/components/stock/useUndoToast";
import { tookOutMessage } from "@/components/stock/useQuickTake";
import { Notice } from "@/components/ui/Notice";
import { Toast } from "@/components/ui/Toast";

export default function LentPage() {
  return <AuthGate>{(session) => <Lent session={session} />}</AuthGate>;
}

function Lent({ session }: { session: Session }) {
  const { current, placeById, names, error, setError, version, refresh } = useHousehold(session);
  const [lent, setLent] = useState<StockItem[] | null>(null);
  const [open, setOpen] = useState<StockItem | null>(null);
  const [returningId, setReturningId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!current) return;
    try {
      setLent(await loadLent(current.householdId));
    } catch (e) {
      setError(friendlyError(e));
    }
  }, [current, setError]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load, version]);

  const { toast, clear, announce } = useUndoToast(refresh);
  const keptIn = (i: StockItem) => {
    const type = placeById.get(i.locationId)?.type;
    return !!type && isKeepPlace(type);
  };

  async function giveBack(item: StockItem) {
    setReturningId(item.id);
    try {
      await lendItem(item, null);
      announce(`${item.productName} is back from ${item.lentTo}`, null);
      refresh();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setReturningId(null);
    }
  }

  const longLent = lent?.filter((i) => isLongLent(i)).length ?? 0;
  const sub =
    lent && lent.length > 0
      ? longLent > 0
        ? `${longLent === 1 ? "1 thing has" : `${longLent} things have`} been away over a month. Open one to ask for it back.`
        : "Things you've lent to friends and family. Tap It's back when they return."
      : "Lend something from its details and it shows up here.";

  return (
    <AppShell>
      <PageHeader title="Lent out" back={{ href: "/lists/", label: "Lists" }} sub={sub} />
      {error ? <Notice>{error}</Notice> : null}
      {!lent ? (
        <HouseholdLoading />
      ) : lent.length > 0 ? (
        <ItemList>
          {lent.map((item, i) => (
            <ItemRow
              key={item.id}
              index={i}
              item={item}
              placeType={placeById.get(item.locationId)?.type}
              keep
              onOpen={setOpen}
              onReturn={giveBack}
              taking={returningId === item.id}
            />
          ))}
        </ItemList>
      ) : null}
      {current ? (
        <TakeOutSheet
          item={open}
          placeName={open ? placeById.get(open.locationId)?.name : undefined}
          keep={open ? keptIn(open) : true}
          householdId={current.householdId}
          names={names}
          onClose={() => setOpen(null)}
          onTaken={(before, after, amount, movementId) => {
            refresh();
            announce(tookOutMessage(before, after, amount, keptIn(before)), movementId);
          }}
          onChanged={(message, movementId) => {
            refresh();
            announce(message, movementId);
          }}
        />
      ) : null}
      <Toast toast={toast} onDone={clear} />
    </AppShell>
  );
}
