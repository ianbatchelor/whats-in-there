"use client";

import { useMemo, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { AuthGate } from "@/components/AuthGate";
import { AppShell, SectionLabel } from "@/components/AppShell";
import { PageHeader, HouseholdLoading } from "@/components/common/PageHeader";
import { useHousehold } from "@/lib/hooks/useHousehold";
import { countThings } from "@/lib/domain/places";
import { KEYS, readLocal, writeLocal } from "@/lib/storage";
import { Notice } from "@/components/ui/Notice";
import { Button } from "@/components/ui/Button";
import { Toast } from "@/components/ui/Toast";
import { IconChevronRight, IconPencil, IconPlus, IconScan } from "@/components/ui/icons";
import { placeType } from "@/components/home/placeTypes";
import { PlacePhoto } from "@/components/art/PlacePhoto";
import { AddPlaceSheet } from "@/components/home/AddPlaceSheet";
import { AddItemSheet, type AddItemHandle } from "@/components/stock/AddItemSheet";
import { useUndoToast } from "@/components/stock/useUndoToast";

export default function AddPage() {
  return <AuthGate>{(session) => <Add session={session} />}</AuthGate>;
}

function Add({ session }: { session: Session }) {
  const { current, places, error, refresh } = useHousehold(session);
  const [picked, setPicked] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [addingPlace, setAddingPlace] = useState(false);
  const sheet = useRef<AddItemHandle>(null);
  const { toast, clear, announce } = useUndoToast(() => {
    refresh();
  });

  // Start with the place used last time; it can be changed in the sheet after scanning.
  const target = useMemo(() => {
    if (!places?.length) return null;
    const wanted = picked ?? readLocal(KEYS.lastPlace);
    return places.find((p) => p.id === wanted) ?? places[0]!;
  }, [places, picked]);

  function start(placeId: string | null, scan: boolean) {
    if (placeId) setPicked(placeId);
    setOpen(true);
    // Called inside the tap, so the phone lets the camera open.
    if (scan) sheet.current?.scan();
  }

  return (
    <AppShell>
      <PageHeader title="Add something" sub="Scan a label and we'll fill in the details, or type it in." />
      {error ? <Notice>{error}</Notice> : null}
      {!current || places === null ? (
        <HouseholdLoading />
      ) : places.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-2xl border border-line bg-card p-5">
          <h2 className="font-display text-lg font-bold">First, add a place</h2>
          <p className="text-mute">Things live in places, like a freezer, the attic or a wardrobe. Add one and then you can fill it.</p>
          <Button onClick={() => setAddingPlace(true)}>
            <IconPlus /> Add a place
          </Button>
        </div>
      ) : (
        <>
          <div className="grid gap-2.5 sm:grid-cols-2">
            <button
              onClick={() => start(null, true)}
              className="lift flex items-center gap-4 rounded-2xl bg-go p-4 text-left text-on-go"
            >
              <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-white/15" aria-hidden="true">
                <IconScan className="size-6" />
              </span>
              <span className="min-w-0">
                <span className="block font-display text-[17px] font-bold">Scan a label</span>
                <span className="block text-[13.5px] opacity-80">Name, size and dates filled in for you</span>
              </span>
            </button>
            <button
              onClick={() => start(null, false)}
              className="lift flex items-center gap-4 rounded-2xl border border-line bg-card p-4 text-left"
            >
              <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-sunk text-fg" aria-hidden="true">
                <IconPencil className="size-5" />
              </span>
              <span className="min-w-0">
                <span className="block font-display text-[17px] font-bold">Type it in</span>
                <span className="block text-[13.5px] text-mute">For things without a label</span>
              </span>
            </button>
          </div>

          <section className="flex flex-col gap-2.5" aria-labelledby="add-places-h">
            <SectionLabel id="add-places-h">Or go straight to a place</SectionLabel>
            <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card">
              {places.map((p) => (
                <li key={p.id}>
                  <button onClick={() => start(p.id, false)} className="flex w-full items-center gap-3 py-2 pr-3 pl-2 text-left transition hover:bg-sunk/70">
                    <span className="h-11 w-14 shrink-0 overflow-hidden rounded-lg">
                      <PlacePhoto type={p.type} imagePath={p.imagePath} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-semibold">{p.name}</span>
                      <span className="block truncate text-[13px] text-mute">
                        {p.type === "other" ? "Place" : placeType(p.type).label} · {countThings(p.itemCount)}
                      </span>
                    </span>
                    <IconChevronRight className="size-4 shrink-0 text-mute/50" />
                  </button>
                </li>
              ))}
            </ul>
            <button onClick={() => setAddingPlace(true)} className="flex min-h-11 items-center gap-2 self-start text-[15px] font-semibold text-leaf">
              <IconPlus className="size-4" /> Add a new place
            </button>
          </section>
        </>
      )}
      {target && current ? (
        <AddItemSheet
          ref={sheet}
          open={open}
          onClose={() => setOpen(false)}
          place={{ ...target, householdId: current.householdId }}
          places={places ?? undefined}
          onPickPlace={(p) => setPicked(p.id)}
          onAdded={(item, movementId) => {
            writeLocal(KEYS.lastPlace, target.id);
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
