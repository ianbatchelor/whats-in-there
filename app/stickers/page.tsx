"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Session } from "@supabase/supabase-js";
import { AuthGate } from "@/components/AuthGate";
import { useHousehold } from "@/lib/hooks/useHousehold";
import { useQueryParam } from "@/lib/hooks/useQueryParam";
import { publicOrigin } from "@/lib/config";
import { friendlyError } from "@/lib/supabase/errors";
import { stickerLink } from "@/lib/domain/sticker";
import { loadStickerCodes } from "@/lib/stickers";
import { QrCode } from "@/components/stickers/QrCode";
import { Splash } from "@/components/ui/Screen";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { IconChevronLeft, IconPrinter } from "@/components/ui/icons";

/** Printable QR labels for your places: the stand-in for NFC stickers, and a backup beside them. */
export default function StickersPage() {
  return <AuthGate>{(session) => <Stickers session={session} />}</AuthGate>;
}

const SIZES = {
  small: { label: "Small", note: "5 cm", width: "50mm", qr: "34mm", name: "text-[13px]" },
  large: { label: "Large", note: "8 cm", width: "80mm", qr: "56mm", name: "text-[19px]" },
} as const;
type Size = keyof typeof SIZES;

function Stickers({ session }: { session: Session }) {
  const only = useQueryParam("id");
  const { places, current, error: householdError } = useHousehold(session);
  const [codes, setCodes] = useState<Map<string, string> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<Set<string> | null>(null);
  const [size, setSize] = useState<Size>("large");

  useEffect(() => {
    if (!current) return;
    loadStickerCodes(current.householdId)
      .then(setCodes)
      .catch((e) => setError(friendlyError(e)));
  }, [current]);

  // Start with the place you came from, or every place.
  const chosen = useMemo(() => {
    if (picked) return picked;
    if (!places || only === undefined) return new Set<string>();
    return new Set(only && places.some((p) => p.id === only) ? [only] : places.map((p) => p.id));
  }, [picked, places, only]);

  if (!places || !codes || only === undefined) {
    const problem = householdError ?? error;
    return problem ? (
      <main className="mx-auto max-w-md p-6">
        <Notice>{problem}</Notice>
      </main>
    ) : (
      <Splash />
    );
  }

  const toggle = (id: string) => {
    const next = new Set(chosen);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setPicked(next);
  };
  const labels = places.filter((p) => chosen.has(p.id) && codes.has(p.id));
  const s = SIZES[size];
  const back = only ? `/place/?id=${only}` : "/";

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col gap-6 px-4 pt-[max(16px,env(safe-area-inset-top))] pb-[max(32px,env(safe-area-inset-bottom))] sm:px-6 lg:pt-10 print:block print:max-w-none print:p-0">
      <header className="flex items-center gap-3 print:hidden">
        <Link href={back} aria-label="Back" className="grid size-11 shrink-0 place-items-center rounded-full bg-card text-fg ring-1 ring-line transition hover:bg-sunk">
          <IconChevronLeft className="size-5" />
        </Link>
        <div className="min-w-0">
          <h1 className="font-display text-[1.6rem] leading-tight font-bold tracking-[-0.02em]">Print QR labels</h1>
          <p className="text-[14px] text-mute">Stick one on each place. Scan it with your phone camera to open that place.</p>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)] print:block">
        <aside className="flex flex-col gap-5 print:hidden">
          <fieldset className="flex flex-col gap-1.5">
            <legend className="mb-1.5 font-display text-sm font-bold">Places</legend>
            {places.length === 0 ? <p className="text-sm text-mute">Add a place first.</p> : null}
            {places.map((p) => (
              <label key={p.id} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl bg-card px-3.5 ring-1 ring-line">
                <input type="checkbox" checked={chosen.has(p.id)} onChange={() => toggle(p.id)} className="size-[18px] accent-[var(--color-go)]" />
                <span className="min-w-0 flex-1 truncate text-[15px] font-medium">{p.name}</span>
              </label>
            ))}
            {places.length > 1 ? (
              <div className="flex gap-3 pt-1 text-[13px] font-semibold text-leaf">
                <button onClick={() => setPicked(new Set(places.map((p) => p.id)))}>Select all</button>
                <button onClick={() => setPicked(new Set())}>Clear</button>
              </div>
            ) : null}
          </fieldset>

          <fieldset className="flex flex-col gap-1.5">
            <legend className="mb-1.5 font-display text-sm font-bold">Label size</legend>
            <div className="grid grid-cols-2 gap-1 rounded-xl bg-sunk p-1">
              {(Object.keys(SIZES) as Size[]).map((k) => (
                <button
                  key={k}
                  onClick={() => setSize(k)}
                  aria-pressed={size === k}
                  className={`min-h-10 rounded-[10px] text-[14px] font-semibold transition ${size === k ? "bg-card text-fg shadow-[var(--shadow-card)]" : "text-mute"}`}
                >
                  {SIZES[k].label} <span className="font-normal text-mute">{SIZES[k].note}</span>
                </button>
              ))}
            </div>
          </fieldset>

          <Button onClick={() => window.print()} disabled={labels.length === 0}>
            <IconPrinter /> Print {labels.length === 1 ? "1 label" : `${labels.length} labels`}
          </Button>
          <p className="text-[13px] text-mute">
            Print at 100% (actual size) on plain paper or sticker sheets, cut along the dotted lines, and cover with clear tape in freezers and sheds.
          </p>
        </aside>

        <section aria-label="Labels" className="rounded-[24px] bg-sunk/60 p-4 sm:p-6 print:rounded-none print:bg-transparent print:p-0">
          {labels.length === 0 ? (
            <p className="py-16 text-center text-mute print:hidden">Pick a place to see its label.</p>
          ) : (
            <div className="flex flex-wrap gap-3 print:gap-[4mm]">
              {labels.map((p) => {
                const link = stickerLink(publicOrigin(), codes.get(p.id)!);
                return (
                  <div
                    key={p.id}
                    style={{ width: s.width }}
                    className="flex break-inside-avoid flex-col items-center gap-[2mm] rounded-[3mm] border border-dashed border-[#9aa69f] bg-white px-[3mm] pt-[3mm] pb-[2.5mm] text-center text-[#15211c]"
                  >
                    <div style={{ width: s.qr, height: s.qr }}>
                      <QrCode value={link} className="size-full" title={`QR code for ${p.name}`} />
                    </div>
                    <span className={`w-full truncate font-display leading-tight font-bold ${s.name}`}>{p.name}</span>
                    <span className="text-[8pt] leading-none text-[#66706b]">Scan to see what&apos;s in here</span>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
