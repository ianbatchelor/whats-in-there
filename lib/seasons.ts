import { supabase } from "@/lib/supabase/client";
import { KEYS, readLocal, writeLocal } from "@/lib/storage";
import { addDays } from "@/lib/domain/stock";
import { todayIso } from "@/lib/domain/dates";
import { SNOOZE_DAYS, doneKey, liveSnoozes, type DueReminder } from "@/lib/domain/seasons";

function readJson<T>(k: string, fallback: T): T {
  try {
    const v = readLocal(k);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}

/** This device's own record, so a tick sticks even before the database has the table, or offline. */
const localDone = (householdId: string) => new Set(readJson<string[]>(`${KEYS.seasonDone}.${householdId}`, []));

/** Which of these reminders someone at home has ticked off this time round. */
export async function loadSeasonDone(householdId: string, due: DueReminder[]): Promise<Set<string>> {
  const done = localDone(householdId);
  if (due.length === 0) return done;
  const { data } = await supabase()
    .from("seasonal_done")
    .select("reminder, period")
    .eq("household_id", householdId)
    .in("period", [...new Set(due.map((r) => r.period))]);
  for (const r of data ?? []) done.add(doneKey({ id: r.reminder as string, period: r.period as string }));
  return done;
}

export async function markSeasonDone(householdId: string, r: DueReminder): Promise<void> {
  const mine = localDone(householdId);
  mine.add(doneKey(r));
  // Only this year's ticks are worth keeping on the device.
  const year = todayIso().slice(0, 4);
  writeLocal(`${KEYS.seasonDone}.${householdId}`, JSON.stringify([...mine].filter((k) => k.split("@")[1]! >= String(Number(year) - 1))));
  const { error } = await supabase().from("seasonal_done").insert({ household_id: householdId, reminder: r.id, period: r.period });
  // Someone else ticked it off first: that's fine.
  if (error && error.code !== "23505") throw error;
}

export function loadSnoozes(): Record<string, string> {
  return liveSnoozes(readJson<Record<string, string>>(KEYS.seasonSnooze, {}));
}

export function snoozeReminder(r: DueReminder): Record<string, string> {
  const next = { ...loadSnoozes(), [doneKey(r)]: addDays(todayIso(), SNOOZE_DAYS) };
  writeLocal(KEYS.seasonSnooze, JSON.stringify(next));
  return next;
}
