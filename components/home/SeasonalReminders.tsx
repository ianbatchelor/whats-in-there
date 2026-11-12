"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Place } from "@/lib/household";
import type { ToastData } from "@/components/ui/Toast";
import { IconCheck, IconX } from "@/components/ui/icons";
import { placeType } from "@/components/home/placeTypes";
import { formatDay, todayIso } from "@/lib/domain/dates";
import { deviceTimeZone, doneKey, dueReminders, isSouthern, seasonName, type DueReminder } from "@/lib/domain/seasons";
import { loadSeasonDone, loadSnoozes, markSeasonDone, snoozeReminder } from "@/lib/seasons";

/** How long the Undo on "Done" lasts before it's saved for everyone at home. */
const UNDO_MS = 7000;

/**
 * Jobs that come round with the seasons (swap the wardrobe over, winter kit for the car), shown only
 * for the kinds of place the household has. Done hides one for everyone until it comes round again;
 * the × hides it on this phone for a week.
 */
export function useSeasonal(householdId: string | undefined, places: Place[] | null, onToast?: (t: ToastData) => void) {
  const [today] = useState(() => todayIso());
  const [southern] = useState(() => isSouthern(deviceTimeZone()));
  const [done, setDone] = useState<Set<string> | null>(null);
  const [snoozed, setSnoozed] = useState<Record<string, string>>({});
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const toastId = useRef(0);
  const pending = useRef(new Map<string, { timer: ReturnType<typeof setTimeout>; save: () => void }>());

  const types = [...new Set((places ?? []).map((p) => p.type))].sort().join(",");
  const typeList = types ? (types.split(",") as Place["type"][]) : [];
  const due = dueReminders(typeList, today, southern);
  const periods = due.map(doneKey).join(",");

  useEffect(() => {
    if (!householdId) return;
    let live = true;
    setSnoozed(loadSnoozes()); // eslint-disable-line react-hooks/set-state-in-effect
    loadSeasonDone(householdId, dueReminders(types ? (types.split(",") as Place["type"][]) : [], today, southern))
      .catch(() => new Set<string>())
      .then((s) => live && setDone(s));
    return () => {
      live = false;
    };
  }, [householdId, types, today, southern, periods]);

  // Leaving the page saves any tick that was still waiting out its Undo.
  useEffect(() => {
    const waiting = pending.current;
    return () => {
      for (const p of waiting.values()) {
        clearTimeout(p.timer);
        p.save();
      }
      waiting.clear();
    };
  }, []);

  const shown = done ? due.filter((r) => !done.has(doneKey(r)) && !hidden.has(doneKey(r)) && !snoozed[doneKey(r)]) : null;

  function tick(r: DueReminder) {
    if (!householdId) return;
    const k = doneKey(r);
    setHidden((h) => new Set(h).add(k));
    const save = () => {
      pending.current.delete(k);
      markSeasonDone(householdId, r).catch(() => {
        /* Kept on this phone; the next tick on any phone saves it for everyone. */
      });
    };
    pending.current.set(k, { timer: setTimeout(save, UNDO_MS), save });
    onToast?.({
      id: ++toastId.current,
      message: `Done: ${r.title.charAt(0).toLowerCase()}${r.title.slice(1)}`,
      actionLabel: "Undo",
      onAction: () => {
        const p = pending.current.get(k);
        if (p) clearTimeout(p.timer);
        pending.current.delete(k);
        setHidden((h) => {
          const next = new Set(h);
          next.delete(k);
          return next;
        });
      },
    });
  }

  function notNow(r: DueReminder) {
    setSnoozed(snoozeReminder(r));
    onToast?.({ id: ++toastId.current, message: "Hidden for a week" });
  }

  return { shown, season: seasonName(today, southern), tick, notNow };
}

export type Seasonal = ReturnType<typeof useSeasonal>;

/** The jobs themselves, each with a tick, a link to its place and a "not now". */
export function SeasonalList({ seasonal, places }: { seasonal: Seasonal; places: Place[] }) {
  const { shown, tick, notNow } = seasonal;
  if (!shown || shown.length === 0) return null;

  // The first place of the right kind, preferring one with things in it.
  const placeFor = (r: DueReminder) => {
    const options = places.filter((p) => r.types.includes(p.type));
    return [...options].sort((a, b) => Number(b.itemCount > 0) - Number(a.itemCount > 0))[0];
  };

  return (
    <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card">
      {shown.map((r) => {
        const place = placeFor(r);
        const Icon = placeType(place?.type ?? r.types[0]!).Icon;
        return (
          <li key={r.id} className="flex items-start gap-1 py-2 pr-1 pl-1.5">
            <button onClick={() => tick(r)} aria-label={`Done: ${r.title}`} className="group grid size-11 shrink-0 place-items-center rounded-xl">
              <span className="grid size-6 place-items-center rounded-full border-2 border-line text-transparent transition group-hover:border-ok group-hover:text-ok">
                <IconCheck className="size-3.5" />
              </span>
            </button>
            <Link href={place ? `/place/?id=${place.id}` : "/"} className="min-w-0 flex-1 py-1.5">
              <span className="block font-display text-[15.5px] leading-snug font-bold">{r.title}</span>
              <span className="mt-0.5 block text-[14px] leading-snug text-mute">{r.body}</span>
              <span className="mt-1.5 flex items-center gap-1.5 text-[13px] font-semibold text-leaf">
                <Icon className="size-4 shrink-0" />
                <span className="truncate">{place?.name}</span>
                <span className="shrink-0 font-normal text-mute">· until {formatDay(r.until, { year: false })}</span>
              </span>
            </Link>
            <button
              onClick={() => notNow(r)}
              aria-label={`Not now: hide “${r.title}” for a week`}
              title="Not now"
              className="grid size-11 shrink-0 place-items-center rounded-xl text-mute/70 transition hover:bg-sunk hover:text-fg"
            >
              <IconX className="size-4" />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
