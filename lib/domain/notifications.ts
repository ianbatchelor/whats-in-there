/**
 * Phone notifications: which lists can have a bell, and what it starts as. The database decides who
 * actually gets told (public.notify_new_idea and notify_new_entry); this mirrors its starting choices
 * so the bell shows the right state before anyone has touched it.
 */
export type NotifyKind = "wish_list" | "list";
export type NotifyMode = "every" | "off";
export type Visibility = "me" | "household" | "family" | "group";

/** A private list has nobody else to hear from, so it has no bell. */
export function hasBell(kind: NotifyKind, visibility?: Visibility): boolean {
  return kind === "wish_list" || (visibility !== undefined && visibility !== "me");
}

/** Wish lists and lists shared with family or a group start on; household lists start quiet. */
export function startingMode(kind: NotifyKind, visibility?: Visibility): NotifyMode {
  if (kind === "wish_list") return "every";
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
