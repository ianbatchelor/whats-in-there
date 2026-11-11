/** Small wrappers so a blocked or private-mode localStorage never breaks the app. */
export function readLocal(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeLocal(key: string, value: string | null): void {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

export const KEYS = {
  household: "wit.household",
  pendingInvite: "wit.pendingInvite",
  lastPlace: "wit.lastPlace",
  searches: "wit.searches",
  accountDeleted: "wit.accountDeleted",
  aiConsent: "wit.aiConsent",
  covers: "wit.covers",
  placeView: "wit.placeView",
  seasonDone: "wit.seasonDone",
  seasonSnooze: "wit.seasonSnooze",
} as const;
