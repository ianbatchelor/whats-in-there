"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { LocationType } from "@/lib/household";
import type { StockItem } from "@/lib/domain/stock";
import { OTHER, groupByCategory, kindWords, listError, markAlreadyHere, mergeLists, newKey, type ListItem, type ListKind } from "@/lib/domain/manyItems";
import { addMany } from "@/lib/stock";
import { SHELF_EDGE, discardLabelPhoto, readListPhoto, shrinkPhoto, uploadReadingPhoto } from "@/lib/labelPhoto";
import { friendlyError } from "@/lib/supabase/errors";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { Spinner } from "@/components/ui/Spinner";
import { IconCamera, IconCheck, IconPlus } from "@/components/ui/icons";
import { useAiConsent } from "@/components/stock/AiConsent";

type SheetPlace = {
  id: string;
  name: string;
  type: LocationType;
  householdId: string;
};

type Stage = { state: "start" } | { state: "reading"; preview: string; more: boolean } | { state: "review" } | { state: "saving"; done: number; total: number };

/** What to photograph, in words that fit the place. */
function tips(type: LocationType): {
  title: string;
  body: string;
  reading: string;
} {
  if (type === "wardrobe")
    return {
      title: "Snap the rail or a pile",
      body: "Open the doors so the whole rail fits, in good light. For drawers, lay things out side by side. Each thing is listed with a name and a type, like Jumpers or Coats.",
      reading: "Looking through the clothes…",
    };
  return {
    title: "Snap a whole shelf",
    body: "Stand back so the shelf fits, with spines or labels facing you and good light. Books are listed by title and author and sorted into sections. About one shelf per photo reads best.",
    reading: "Reading the shelf…",
  };
}

export function AddManySheet({
  open,
  onClose,
  place,
  existing,
  onAdded,
}: {
  open: boolean;
  onClose: () => void;
  place: SheetPlace;
  /** What's already recorded here, so the same things aren't added twice. */
  existing: StockItem[];
  /** How many were added, in words such as "12 books". */
  onAdded: (words: string) => void;
}) {
  const [stage, setStage] = useState<Stage>({ state: "start" });
  const [items, setItems] = useState<ListItem[]>([]);
  const [kind, setKind] = useState<ListKind>("other");
  const [photos, setPhotos] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const camera = useRef<HTMLInputElement>(null);
  const { withConsent, sheet: consentSheet } = useAiConsent();
  const library = useRef<HTMLInputElement>(null);
  const attempt = useRef(0);
  const previews = useRef<string[]>([]);
  const t = tips(place.type);

  useEffect(() => {
    const urls = previews.current;
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, []);

  function reset() {
    attempt.current += 1;
    previews.current.forEach((u) => URL.revokeObjectURL(u));
    previews.current.length = 0;
    setStage({ state: "start" });
    setItems([]);
    setPhotos([]);
    setError(null);
  }

  function close() {
    if (stage.state === "saving") return;
    reset();
    onClose();
  }

  /**
   * Each photo is read on its own and its things are added to the list, so a second shelf (or the
   * other half of a long one) can follow the first. The photo itself is only for reading: it is
   * removed from storage straight after.
   */
  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const more = items.length > 0;
    const mine = ++attempt.current;
    setError(null);
    let path: string | null = null;
    try {
      const small = await shrinkPhoto(file, SHELF_EDGE);
      const preview = URL.createObjectURL(small);
      previews.current.push(preview);
      if (mine !== attempt.current) return;
      setStage({ state: "reading", preview, more });
      path = await uploadReadingPhoto(place.householdId, small);
      const result = await readListPhoto(place.householdId, [path]);
      void discardLabelPhoto(path);
      if (mine !== attempt.current) return;
      if (!result.ok) {
        setError(listError(result.code));
        setStage(more ? { state: "review" } : { state: "start" });
        return;
      }
      const found = markAlreadyHere(result.items, existing);
      const nextKind = !more ? result.kind : result.kind !== kind ? "mixed" : kind;
      setPhotos((p) => [...p, preview]);
      setKind(nextKind);
      // Sorted once when things arrive; edits after that leave each line where it is.
      setItems((now) => groupByCategory(mergeLists(now, found), (i) => i, nextKind === "books").flatMap((g) => g.items));
      setStage({ state: "review" });
    } catch (err) {
      if (path) void discardLabelPhoto(path);
      if (mine !== attempt.current) return;
      setError(err instanceof Error && err.message === "photo_failed" ? "That photo couldn't be opened. Try another one." : friendlyError(err));
      setStage(more ? { state: "review" } : { state: "start" });
    }
  }

  const update = (key: string, patch: Partial<ListItem>) => setItems((list) => list.map((i) => (i.key === key ? { ...i, ...patch } : i)));

  const byAuthor = kind === "books";
  const groups = useMemo(() => groupByCategory(items, (i) => i, byAuthor, false), [items, byAuthor]);
  const categories = useMemo(() => {
    const set = new Set([...items.map((i) => i.category), ...existing.map((i) => i.category ?? "")].filter((c) => c && c !== OTHER));
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [items, existing]);

  const chosen = items.filter((i) => i.include && i.name.trim());
  const words = kindWords(kind);
  const count = (n: number) => `${n} ${n === 1 ? words.one : words.many}`;
  const unsure = items.filter((i) => i.include && i.unsure).length;
  const allOn = items.every((i) => i.include);

  async function save() {
    if (!chosen.length) return;
    setError(null);
    setStage({ state: "saving", done: 0, total: chosen.length });
    const { added, failed } = await addMany(
      chosen.map((i) => ({
        locationId: place.id,
        productName: i.name.trim().slice(0, 120),
        brand: i.detail.trim().slice(0, 80),
        category: i.category.trim() && i.category.trim() !== OTHER ? i.category.trim().slice(0, 40) : undefined,
        quantity: i.quantity,
        unit: "item",
      })),
      (done) => setStage({ state: "saving", done, total: chosen.length }),
    );
    if (failed.length) {
      // Keep only the ones that didn't go in, so trying again can't add anything twice.
      const left = new Set(failed.map((f) => f.productName));
      setItems((list) => list.filter((i) => i.include && left.has(i.name.trim().slice(0, 120))));
      setError(`${added ? `Added ${count(added)}. ` : ""}${failed.length} couldn't be added. Check your connection and try again.`);
      setStage({ state: "review" });
      if (added) onAdded(count(added));
      return;
    }
    reset();
    onAdded(count(added));
    onClose();
  }

  const reading = stage.state === "reading";
  const saving = stage.state === "saving";

  return (
    <Sheet open={open} onClose={close} title={`Add lots to ${place.name}`}>
      <input ref={camera} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={onPhoto} />
      <input ref={library} type="file" accept="image/*" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={onPhoto} />
      {consentSheet}

      {stage.state === "start" ? (
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3.5 rounded-2xl border border-line bg-sunk/60 p-3.5">
            <span className="grid size-12 shrink-0 place-items-center rounded-full bg-tape text-on-tape" aria-hidden="true">
              <IconCamera className="size-6" />
            </span>
            <span className="min-w-0">
              <span className="block font-display text-[15px] font-bold">{t.title}</span>
              <span className="block text-[13px] text-mute">{t.body}</span>
            </span>
          </div>
          {error ? <Notice>{error}</Notice> : null}
          <div className="grid grid-cols-2 gap-2.5">
            <Button onClick={() => withConsent(() => camera.current?.click())}>
              <IconCamera /> Take a photo
            </Button>
            <Button variant="ghost" onClick={() => withConsent(() => library.current?.click())}>
              Choose a photo
            </Button>
          </div>
          <p className="text-center text-[12.5px] text-mute">Nothing is added until you&apos;ve checked the list.</p>
        </div>
      ) : reading && !stage.more ? (
        <ReadingCard preview={stage.preview} label={t.reading} />
      ) : (
        <div className="flex min-h-0 flex-col gap-3">
          <div className="flex items-center gap-3" aria-live="polite">
            <div className="flex -space-x-3">
              {photos.slice(-3).map((src) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={src} src={src} alt="" className="size-12 rounded-xl border-2 border-bg object-cover" />
              ))}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-display text-[15px] font-bold">
                Found {count(items.length)}
                {photos.length > 1 ? ` in ${photos.length} photos` : ""}
              </p>
              <p className="text-[13px] text-mute">
                {unsure ? `Check the ${unsure} marked, untick anything wrong, then add.` : "Untick anything wrong, tap a name to fix it, then add."}
              </p>
            </div>
          </div>

          {reading ? (
            <p className="flex items-center gap-2 rounded-xl bg-sunk/70 px-3 py-2.5 text-sm font-semibold">
              <Spinner /> {t.reading}
            </p>
          ) : null}
          {error ? <Notice>{error}</Notice> : null}

          <div className="-mx-5 max-h-[52dvh] overflow-y-auto border-y border-line px-5 lg:max-h-none lg:flex-1">
            <datalist id="many-categories">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
            {groups.map((g) => (
              <section key={g.category} className="py-2" aria-label={g.category}>
                <h3 className="sticky top-0 z-10 -mx-5 bg-bg/95 px-5 py-1.5 text-[12px] font-bold tracking-[0.06em] text-mute uppercase backdrop-blur">
                  {g.category} <span className="font-semibold">· {g.items.length}</span>
                </h3>
                <ul className="flex flex-col">
                  {g.items.map((i) => (
                    <ListRow key={i.key} item={i} byAuthor={byAuthor} disabled={saving} onChange={(patch) => update(i.key, patch)} />
                  ))}
                </ul>
              </section>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-bold">
            <button type="button" className="text-go disabled:opacity-50" disabled={reading || saving} onClick={() => withConsent(() => camera.current?.click())}>
              + Another photo
            </button>
            <button type="button" className="text-mute disabled:opacity-50" disabled={reading || saving} onClick={() => withConsent(() => library.current?.click())}>
              or choose a photo
            </button>
            <button
              type="button"
              className="text-mute disabled:opacity-50"
              disabled={saving}
              onClick={() =>
                setItems((list) => [
                  {
                    key: newKey(),
                    name: "",
                    detail: "",
                    category: OTHER,
                    quantity: 1,
                    unsure: false,
                    already: false,
                    include: true,
                  },
                  ...list,
                ])
              }
            >
              Add one by hand
            </button>
            <button
              type="button"
              className="ml-auto text-mute disabled:opacity-50"
              disabled={saving}
              onClick={() => setItems((list) => list.map((i) => ({ ...i, include: !allOn })))}
            >
              {allOn ? "Untick all" : "Tick all"}
            </button>
          </div>

          <Button onClick={save} busy={saving} disabled={reading || chosen.length === 0}>
            {saving ? `Adding ${stage.done} of ${stage.total}…` : chosen.length ? `Add ${count(chosen.length)} to ${place.name}` : "Tick something to add"}
          </Button>
        </div>
      )}
    </Sheet>
  );
}

function ReadingCard({ preview, label }: { preview: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-2" aria-live="polite">
      <div className="relative w-full overflow-hidden rounded-2xl">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={preview} alt="Your photo" className="max-h-[44dvh] w-full object-cover" />
        <span className="scan-sweep pointer-events-none absolute inset-x-0 top-0 h-1/3" aria-hidden="true" />
      </div>
      <p className="flex items-center gap-2 font-display text-[15px] font-bold">
        <Spinner /> {label}
      </p>
      <p className="text-center text-[13px] text-mute">A full shelf can take up to half a minute.</p>
    </div>
  );
}

/** One line of the list: tick box, the name and author or brand (both editable), its section and how many. */
function ListRow({
  item,
  byAuthor,
  disabled,
  onChange,
}: {
  item: ListItem;
  byAuthor: boolean;
  disabled: boolean;
  onChange: (patch: Partial<ListItem>) => void;
}) {
  const off = !item.include;
  // The section moves the line to another group, so it is applied when the person leaves the box.
  const [section, setSection] = useState(item.category === OTHER ? "" : item.category);
  return (
    <li className={`flex items-start gap-2.5 border-b border-line/70 py-2 last:border-b-0 ${off ? "opacity-55" : ""}`}>
      <button
        type="button"
        role="checkbox"
        aria-checked={item.include}
        aria-label={`Add ${item.name || "this"}`}
        disabled={disabled}
        onClick={() => onChange({ include: !item.include })}
        className={`mt-1 grid size-7 shrink-0 place-items-center rounded-lg border-2 transition ${
          item.include ? "border-go bg-go text-on-go" : "border-line bg-card text-transparent"
        }`}
      >
        <IconCheck className="size-4" />
      </button>
      <div className="min-w-0 flex-1">
        <input
          value={item.name}
          onChange={(e) => onChange({ name: e.target.value, unsure: false })}
          maxLength={120}
          disabled={disabled}
          aria-label="Name"
          placeholder={byAuthor ? "Title" : "What is it?"}
          className={`w-full rounded-md bg-transparent px-1 py-0.5 text-[15px] leading-snug font-semibold focus:bg-card focus:ring-2 focus:ring-leaf/30 focus:outline-none ${
            item.unsure && item.include ? "bg-check ring-1 ring-check-line" : ""
          }`}
        />
        <div className="mt-0.5 flex items-center gap-1.5">
          <input
            value={item.detail}
            onChange={(e) => onChange({ detail: e.target.value })}
            maxLength={80}
            disabled={disabled}
            aria-label={byAuthor ? "Author" : "Brand"}
            placeholder={byAuthor ? "Author" : "Brand"}
            className="min-w-0 flex-1 rounded-md bg-transparent px-1 py-0.5 text-[13px] text-mute placeholder:text-mute/50 focus:bg-card focus:text-fg focus:ring-2 focus:ring-leaf/30 focus:outline-none"
          />
        </div>
        {item.already || (item.unsure && item.include) ? (
          <p className="mt-1 flex gap-1.5 px-1">
            {item.already ? <span className="rounded-full bg-sunk px-2 py-[2px] text-[12px] font-semibold text-mute">Already here</span> : null}
            {item.unsure && item.include ? (
              <span className="rounded-full bg-soon-bg px-2 py-[2px] text-[12px] font-semibold text-soon">Check the name</span>
            ) : null}
          </p>
        ) : null}
      </div>
      <div className="mt-0.5 flex w-[5.5rem] shrink-0 flex-col items-stretch gap-1.5">
        <div className="flex items-center justify-between rounded-full bg-sunk" role="group" aria-label="How many">
          <button
            type="button"
            aria-label="Fewer"
            disabled={disabled || item.quantity <= 1}
            onClick={() => onChange({ quantity: item.quantity - 1 })}
            className="grid size-8 place-items-center rounded-full text-lg font-bold disabled:opacity-30"
          >
            −
          </button>
          <output className="w-5 text-center text-sm font-bold tabular-nums">{item.quantity}</output>
          <button
            type="button"
            aria-label="More"
            disabled={disabled || item.quantity >= 99}
            onClick={() => onChange({ quantity: item.quantity + 1 })}
            className="grid size-8 place-items-center rounded-full text-lg font-bold disabled:opacity-30"
          >
            <IconPlus className="size-3.5" />
          </button>
        </div>
        <input
          value={section}
          onChange={(e) => setSection(e.target.value)}
          onBlur={() => onChange({ category: section.trim() || OTHER })}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          list="many-categories"
          maxLength={40}
          disabled={disabled}
          aria-label="Section"
          placeholder="Section"
          className="w-full truncate rounded-full bg-sunk px-2.5 py-1 text-center text-[12.5px] font-semibold text-fg/75 placeholder:text-mute/60 focus:bg-card focus:ring-2 focus:ring-leaf/30 focus:outline-none"
        />
      </div>
    </li>
  );
}
