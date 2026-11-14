"use client";

import type { Place } from "@/lib/household";
import { useMemo, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { AuthGate } from "@/components/AuthGate";
import { AppShell } from "@/components/AppShell";
import { PageHeader, HouseholdLoading } from "@/components/common/PageHeader";
import { useHousehold } from "@/lib/hooks/useHousehold";
import { useQueryParam } from "@/lib/hooks/useQueryParam";
import { countThings, nestedOrder } from "@/lib/domain/places";
import type { StockItem } from "@/lib/domain/stock";
import { KEYS, readLocal, writeLocal } from "@/lib/storage";
import { loadItems } from "@/lib/stock";
import { Notice } from "@/components/ui/Notice";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { Toast } from "@/components/ui/Toast";
import { IconCheck, IconChevronRight, IconList, IconPencil, IconPlus, IconScan, IconStack } from "@/components/ui/icons";
import { placeType } from "@/components/home/placeTypes";
import { PlacePhoto } from "@/components/art/PlacePhoto";
import { AddPlaceSheet } from "@/components/home/AddPlaceSheet";
import { AddItemSheet, type AddItemHandle } from "@/components/stock/AddItemSheet";
import { AddManySheet } from "@/components/stock/AddManySheet";
import { AddToListSheet } from "@/components/add/AddToListSheet";
import { useUndoToast } from "@/components/stock/useUndoToast";

export default function AddPage() {
  return <AuthGate>{(session) => <Add session={session} />}</AuthGate>;
}

type Choice = "scan" | "many" | "type" | "list";

const CHOICES: { key: Choice; title: string; sub: string; Icon: (p: { className?: string }) => React.ReactNode; primary?: boolean }[] = [
  { key: "scan", title: "Scan a label", sub: "One thing, details filled in", Icon: IconScan, primary: true },
  { key: "many", title: "Scan a shelf", sub: "Several things from one photo", Icon: IconStack },
  { key: "type", title: "Type it in", sub: "A name and how many", Icon: IconPencil },
  { key: "list", title: "Add to a list", sub: "Shopping, presents or jobs", Icon: IconList },
];

type Open = null | "item" | "many" | "list" | "where" | "place";

/**
 * The one way in for adding anything: a thing with a label, a whole shelf, something typed in, or a
 * line on a list. Things go into the place shown at the top, which starts as the place you came
 * from (or used last) and can be changed before or after scanning.
 */
function Add({ session }: { session: Session }) {
  const { current, places, placeById, error, refresh } = useHousehold(session);
  const from = useQueryParam("place");
  const [picked, setPicked] = useState<string | null>(null);
  const [open, setOpen] = useState<Open>(null);
  const [existing, setExisting] = useState<StockItem[]>([]);
  const sheet = useRef<AddItemHandle>(null);
  const { toast, clear, announce } = useUndoToast(() => {
    refresh();
  });

  const target = useMemo(() => {
    if (!places?.length) return null;
    const wanted = picked ?? from ?? readLocal(KEYS.lastPlace);
    return places.find((p) => p.id === wanted) ?? places[0]!;
  }, [places, picked, from]);

  function scan() {
    setOpen("item");
    // Called inside the tap, so the phone lets the camera open.
    sheet.current?.scan();
  }

  async function many() {
    if (!target) return;
    setExisting([]);
    setOpen("many");
    // What's already there, so the same things aren't added twice.
    setExisting(await loadItems(target.id).catch(() => []));
  }

  function choose(key: Choice) {
    if (key === "scan") scan();
    else if (key === "many") void many();
    else setOpen(key === "type" ? "item" : "list");
  }

  return (
    <AppShell>
      <PageHeader title="What would you like to add?" sub="One place to start, for everything in your home." />
      {error ? <Notice>{error}</Notice> : null}
      {!current || places === null ? (
        <HouseholdLoading />
      ) : places.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-2xl border border-line bg-card p-5">
          <h2 className="font-display text-lg font-bold">First, add a place</h2>
          <p className="text-mute">Things live in places, like a freezer, the attic or a wardrobe. Add one and then you can fill it.</p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setOpen("place")}>
              <IconPlus /> Add a place
            </Button>
            <Button variant="ghost" onClick={() => setOpen("list")}>
              <IconList /> Add to a list
            </Button>
          </div>
        </div>
      ) : (
        <>
          {target ? (
            <button
              onClick={() => setOpen("where")}
              className="flex items-center gap-3 rounded-2xl border border-line bg-card py-2 pr-4 pl-2 text-left shadow-[var(--shadow-card)] transition hover:bg-sunk/50"
            >
              <span className="h-12 w-16 shrink-0 overflow-hidden rounded-xl">
                <PlacePhoto type={target.type} imagePath={target.imagePath} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[12.5px] font-semibold tracking-[0.04em] text-mute uppercase">Adding to</span>
                <span className="block truncate font-display text-[16.5px] font-bold">{target.name}</span>
              </span>
              <span className="shrink-0 text-[14px] font-semibold text-leaf">Change</span>
            </button>
          ) : null}

          <ul className="grid grid-cols-2 gap-3">
            {CHOICES.map(({ key, title, sub, Icon, primary }) => (
              <li key={key}>
                <button
                  onClick={() => choose(key)}
                  className={`lift flex h-full min-h-[148px] w-full flex-col justify-between gap-4 rounded-[20px] p-4 text-left ${
                    primary ? "bg-go text-on-go shadow-[0_14px_28px_-16px_rgba(24,63,50,0.9)]" : "border border-line bg-card shadow-[var(--shadow-card)]"
                  }`}
                >
                  <span
                    className={`grid size-12 place-items-center rounded-2xl ${primary ? "bg-white/15" : "bg-sunk text-leaf"}`}
                    aria-hidden="true"
                  >
                    <Icon className="size-6" />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-display text-[17px] leading-snug font-bold">{title}</span>
                    <span className={`mt-0.5 block text-[13.5px] leading-snug ${primary ? "opacity-80" : "text-mute"}`}>{sub}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>

          <button onClick={() => setOpen("place")} className="flex min-h-12 items-center gap-3 rounded-2xl border-[1.5px] border-dashed border-line px-4 text-left transition hover:border-leaf/50 hover:bg-sunk/50">
            <IconPlus className="size-5 shrink-0 text-leaf" />
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-semibold text-leaf">A new place</span>
              <span className="block text-[13px] text-mute">A freezer, a shelf, a box in the loft</span>
            </span>
          </button>
        </>
      )}

      {places && places.length > 0 ? (
        <Sheet open={open === "where"} onClose={() => setOpen(null)} title="Where is it going?">
          <ul className="-mx-2 flex flex-col">
            {nestedOrder(places).map(({ place: p, inside }) => (
              <li key={p.id}>
                <button
                  onClick={() => {
                    setPicked(p.id);
                    setOpen(null);
                  }}
                  aria-pressed={target?.id === p.id}
                  className={`flex w-full items-center gap-3 rounded-xl py-2 pr-3 text-left transition hover:bg-sunk/70 ${inside ? "pl-8" : "pl-2"}`}
                >
                  <span className="h-11 w-14 shrink-0 overflow-hidden rounded-lg">
                    <PlacePhoto type={p.type} imagePath={p.imagePath} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold">{p.name}</span>
                    <span className="block truncate text-[13px] text-mute">{placeLine(p, inside ? (placeById.get(p.parentId ?? "")?.name ?? "a place") : null)}</span>
                  </span>
                  {target?.id === p.id ? <IconCheck className="size-5 shrink-0 text-leaf" /> : <IconChevronRight className="size-4 shrink-0 text-mute/50" />}
                </button>
              </li>
            ))}
          </ul>
          <button
            onClick={() => setOpen("place")}
            className="mt-2 flex min-h-11 items-center gap-2 self-start text-[15px] font-semibold text-leaf"
          >
            <IconPlus className="size-4" /> Add a new place
          </button>
        </Sheet>
      ) : null}

      {target && current ? (
        <AddItemSheet
          ref={sheet}
          open={open === "item"}
          onClose={() => setOpen(null)}
          place={{ ...target, householdId: current.householdId }}
          places={places ?? undefined}
          onPickPlace={(p) => setPicked(p.id)}
          onMany={many}
          onAdded={(item, movementId) => {
            writeLocal(KEYS.lastPlace, target.id);
            refresh();
            announce(`Added ${item.productName} to ${target.name}`, movementId);
          }}
        />
      ) : null}
      {target && current && open === "many" ? (
        <AddManySheet
          open
          onClose={() => setOpen(null)}
          place={{ ...target, householdId: current.householdId }}
          existing={existing}
          onAdded={(words) => {
            writeLocal(KEYS.lastPlace, target.id);
            refresh();
            announce(`Added ${words} to ${target.name}`, null);
          }}
        />
      ) : null}
      {current ? (
        <AddToListSheet
          open={open === "list"}
          onClose={() => setOpen(null)}
          householdId={current.householdId}
          me={session.user.id}
          placeName={(id) => placeById.get(id)?.name}
          onAdded={(message) => announce(message, null)}
        />
      ) : null}
      {current ? (
        <AddPlaceSheet
          open={open === "place"}
          onClose={() => setOpen(null)}
          householdId={current.householdId}
          onAdded={refresh}
        />
      ) : null}
      <Toast toast={toast} onDone={clear} />
    </AppShell>
  );
}

/**
 * "Bookshelf · 4 things", or just "6 things" when the name already says what kind of place it is
 * ("Freezer · Freezer · 6 things" said it twice).
 */
function placeLine(p: { name: string; type: Place["type"]; itemCount: number }, inside: string | null): string {
  const kind = p.type === "other" ? null : placeType(p.type).label;
  const said = !kind || p.name.toLowerCase().includes(kind.toLowerCase());
  const lead = inside ? `Inside ${inside}` : said ? null : kind;
  return [lead, countThings(p.itemCount)].filter(Boolean).join(" · ");
}
