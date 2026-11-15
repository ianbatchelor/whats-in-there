/**
 * Phone notifications: which lists can have a bell, and what it starts as. The database decides who
 * actually gets told (public.notify_new_idea and notify_new_entry); this mirrors its starting choices
 * so the bell shows the right state before anyone has touched it.
 */
export type NotifyKind = "wish_list" | "list" | "place";
export type NotifyMode = "every" | "daily" | "off";
export type Visibility = "me" | "household" | "family" | "group";

/** A private list has nobody else to hear from, so it has no bell. */
export function hasBell(kind: NotifyKind, visibility?: Visibility): boolean {
  return kind !== "list" || (visibility !== undefined && visibility !== "me");
}

/** Wish lists and lists shared with family or a group start on; household lists and places start quiet. */
export function startingMode(kind: NotifyKind, visibility?: Visibility): NotifyMode {
  if (kind === "wish_list") return "every";
  if (kind === "place") return "off";
  return visibility === "family" || visibility === "group" ? "every" : "off";
}

export const HOURS = Array.from({ length: 24 }, (_, h) => h);

/** "10 pm", "8 am", "midnight", "noon". */
export function hourLabel(h: number): string {
  if (h === 0) return "midnight";
  if (h === 12) return "noon";
  return h < 12 ? `${h} am` : `${h - 12} pm`;
}

/** "Nothing arrives between 10 pm and 8 am." */
export function quietLine(from: number, to: number): string {
  if (from === to) return "No quiet hours: notifications arrive any time.";
  return `Nothing arrives between ${hourLabel(from)} and ${hourLabel(to)}. Anything from then comes in the morning.`;
}

/** The three choices on a bell, in the words people see. */
export const MODES: { mode: NotifyMode; label: string }[] = [
  { mode: "every", label: "Every change" },
  { mode: "daily", label: "Daily summary" },
  { mode: "off", label: "Off" },
];

/** What a bell on this kind of thing tells you about, for the choice sheet. */
export function modeHelp(kind: NotifyKind, mode: NotifyMode): string {
  const what = kind === "wish_list" ? "new ideas" : kind === "place" ? "things going in or out" : "new things on the list";
  if (mode === "every") return `A message soon after ${what}, a few minutes after the last one.`;
  if (mode === "daily") return `One message at 6 pm with the day's ${what}.`;
  return kind === "place" ? "Nothing about changes. You still won't miss anything: it's all on the place's page." : "No notifications for this.";
}

/** Places also send a morning reminder when something is near its date, if the bell is on. */
export const PLACE_REMINDER_LINE = "While the bell is on, you also get a 9 am reminder when something here needs using soon, and on Saturdays, what's been frozen over 3 months.";
