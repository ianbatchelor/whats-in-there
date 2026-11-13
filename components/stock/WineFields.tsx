"use client";

import { Field } from "@/components/ui/Field";
import { parseYear, WINE_COLOURS, type WineColour, type WineDetails } from "@/lib/domain/wine";

/** What the wine part of a form holds while someone types. Years stay text until saved. */
export type WineDraft = {
  vintage: string;
  colour: WineColour | null;
  grape: string;
  region: string;
  from: string;
  until: string;
  savedFor: string;
};

export const EMPTY_WINE: WineDraft = {
  vintage: "",
  colour: null,
  grape: "",
  region: "",
  from: "",
  until: "",
  savedFor: "",
};

export function toDraft(w: Partial<WineDetails> | null | undefined): WineDraft {
  if (!w) return EMPTY_WINE;
  const y = (n: number | null | undefined) => (n ? String(n) : "");
  return {
    vintage: y(w.vintage),
    colour: w.wineColour ?? null,
    grape: w.grape ?? "",
    region: w.region ?? "",
    from: y(w.drinkFrom),
    until: y(w.drinkUntil),
    savedFor: w.savedFor ?? "",
  };
}

/** The draft as details to save, or a sentence saying what to fix. */
export function fromDraft(d: WineDraft): { ok: true; wine: WineDetails } | { ok: false; error: string } {
  const vintage = parseYear(d.vintage);
  const from = parseYear(d.from);
  const until = parseYear(d.until);
  if (vintage === "bad")
    return {
      ok: false,
      error: "Enter the vintage as a year, like 2019, or leave it empty.",
    };
  if (from === "bad" || until === "bad")
    return {
      ok: false,
      error: "Enter the drinking years as years, like 2026, or leave them empty.",
    };
  if (from && until && from > until)
    return {
      ok: false,
      error: "The first year to drink it should come before the last.",
    };
  const text = (s: string, max: number) => s.replace(/\s+/g, " ").trim().slice(0, max) || null;
  return {
    ok: true,
    wine: {
      vintage,
      wineColour: d.colour,
      grape: text(d.grape, 80),
      region: text(d.region, 80),
      drinkFrom: from,
      drinkUntil: until,
      savedFor: text(d.savedFor, 60),
    },
  };
}

/**
 * The wine part of the add and edit forms: vintage and colour first, then when it's best to drink
 * and whether it's being kept for something. Grape and region sit with the other extras.
 */
export function WineMain({
  draft,
  onChange,
  check,
  guessed,
  disabled,
}: {
  draft: WineDraft;
  onChange: (d: WineDraft) => void;
  /** Fields the label reader wasn't sure of, to highlight. */
  check?: Set<string>;
  /** The drinking window came from the label reader, so it's an estimate. */
  guessed?: boolean;
  disabled?: boolean;
}) {
  const set = (patch: Partial<WineDraft>) => onChange({ ...draft, ...patch });
  return (
    <fieldset className="flex min-w-0 flex-col gap-4" disabled={disabled}>
      <Field
        label="Vintage"
        inputMode="numeric"
        placeholder="Year on the label, e.g. 2019"
        value={draft.vintage}
        onChange={(e) => set({ vintage: e.target.value })}
        maxLength={4}
        check={check?.has("vintage")}
      />
      <div className="flex min-w-0 flex-col gap-1.5">
        <span className="font-display text-sm font-bold" id="wine-colour">
          Colour
        </span>
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-labelledby="wine-colour">
          {WINE_COLOURS.map((c) => (
            <button
              type="button"
              key={c.value}
              role="radio"
              aria-checked={draft.colour === c.value}
              onClick={() => set({ colour: draft.colour === c.value ? null : c.value })}
              className={`flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-bold ${
                draft.colour === c.value ? "border-fg bg-fg text-bg" : "border-line bg-card text-fg"
              }`}
            >
              <span className="size-2.5 rounded-full" style={{ background: c.dot }} aria-hidden="true" />
              {c.label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex min-w-0 flex-col gap-1.5">
        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Best to drink from"
            inputMode="numeric"
            placeholder="e.g. 2025"
            value={draft.from}
            onChange={(e) => set({ from: e.target.value })}
            maxLength={4}
            check={guessed}
          />
          <Field
            label="Until"
            inputMode="numeric"
            placeholder="e.g. 2030"
            value={draft.until}
            onChange={(e) => set({ until: e.target.value })}
            maxLength={4}
            check={guessed}
          />
        </div>
        <p className="text-sm text-mute">
          {guessed ? "A guess from the label. Change it if you know better." : "Optional. Bottles near the end show up first, and on Home."}
        </p>
      </div>
      <Field
        label="Keeping it for something?"
        placeholder="Optional, e.g. Our anniversary"
        value={draft.savedFor}
        onChange={(e) => set({ savedFor: e.target.value })}
        maxLength={60}
        hint={draft.savedFor.trim() ? "It goes to the end of the list, so nobody opens it by mistake." : undefined}
      />
    </fieldset>
  );
}

/** Grape and region, shown with the other extras. */
export function WineExtras({ draft, onChange, check }: { draft: WineDraft; onChange: (d: WineDraft) => void; check?: Set<string> }) {
  const set = (patch: Partial<WineDraft>) => onChange({ ...draft, ...patch });
  return (
    <div className="grid grid-cols-2 gap-3">
      <Field
        label="Grape"
        placeholder="Optional, e.g. Merlot"
        value={draft.grape}
        onChange={(e) => set({ grape: e.target.value })}
        maxLength={80}
        check={check?.has("grape")}
      />
      <Field
        label="Region"
        placeholder="Optional, e.g. Rioja"
        value={draft.region}
        onChange={(e) => set({ region: e.target.value })}
        maxLength={80}
        check={check?.has("region")}
      />
    </div>
  );
}
