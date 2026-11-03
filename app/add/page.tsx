"use client";

import { useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { AuthGate } from "@/components/AuthGate";
import { AppShell } from "@/components/AppShell";
import { PageHeader, HouseholdLoading } from "@/components/common/PageHeader";
import { useHousehold } from "@/lib/hooks/useHousehold";
import { countThings } from "@/lib/domain/places";
import type { Place } from "@/lib/household";
import { Notice } from "@/components/ui/Notice";
import { Toast } from "@/components/ui/Toast";
import { IconPlus } from "@/components/ui/icons";
import { placeType } from "@/components/home/placeTypes";
import { PlaceArt } from "@/components/art/PlaceArt";
import { AddPlaceSheet } from "@/components/home/AddPlaceSheet";
import { AddItemSheet } from "@/components/stock/AddItemSheet";
import { useUndoToast } from "@/components/stock/useUndoToast";

export default function AddPage() {
  return <AuthGate>{(session) => <Add session={session} />}</AuthGate>;
}

function Add({ session }: { session: Session }) {
  const { current, places, error, refresh } = useHousehold(session);
  const [target, setTarget] = useState<Place | null>(null);
  const [addingPlace, setAddingPlace] = useState(false);
  const { toast, clear, announce } = useUndoToast(() => {
    refresh();
  });

  return (
    <AppShell>
      <PageHeader title="Add something" sub="Where are you putting it?" />
      {error ? <Notice>{error}</Notice> : null}
      {!current || places === null ? (
        <HouseholdLoading />
      ) : (
        <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {places.map((p, i) => (
            <li key={p.id} className="rise" style={{ animationDelay: `${Math.min(i, 8) * 35}ms` }}>
              <button
                onClick={() => setTarget(p)}
                className="lift flex w-full items-center gap-3.5 overflow-hidden rounded-2xl border border-line bg-card pr-4 text-left shadow-[var(--shadow-card)]"
              >
                <span className="h-[72px] w-24 shrink-0 overflow-hidden">
                  <PlaceArt type={p.type} />
                </span>
                <span className="min-w-0 flex-1 py-2">
                  <span className="block truncate font-display text-[16px] font-bold">{p.name}</span>
                  <span className="block truncate text-[13px] text-mute">
                    {placeType(p.type).label === "Something else" ? "Place" : placeType(p.type).label} · {countThings(p.itemCount)}
                  </span>
                </span>
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-ice text-leaf" aria-hidden="true">
                  <IconPlus className="size-4" />
                </span>
              </button>
            </li>
          ))}
          <li>
            <button
              onClick={() => setAddingPlace(true)}
              className="flex min-h-[74px] w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line bg-sunk/50 font-display font-bold text-leaf transition hover:bg-sunk"
            >
              <IconPlus className="size-4" /> Add a new place
            </button>
          </li>
        </ul>
      )}
      {target ? (
        <AddItemSheet
          open
          onClose={() => setTarget(null)}
          place={target}
          onAdded={(item, movementId) => {
            refresh();
            announce(`Added ${item.productName} to ${target.name}`, movementId);
          }}
        />
      ) : null}
      {current ? <AddPlaceSheet open={addingPlace} onClose={() => setAddingPlace(false)} householdId={current.householdId} onAdded={refresh} /> : null}
      <Toast toast={toast} onDone={clear} />
    </AppShell>
  );
}
