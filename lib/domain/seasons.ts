import type { LocationType } from "@/lib/household";
import { todayIso } from "./dates";

/** A month and day, e.g. [10, 15] for 15 October. */
type MonthDay = [number, number];

export type SeasonalReminder = {
  id: string;
  title: string;
  body: string;
  /** Shown only to households with one of these kinds of place; it links to the first one. */
  types: LocationType[];
  /** When it comes round, in the northern hemisphere. A window never runs over New Year. */
  windows: [MonthDay, MonthDay][];
  /** Follows the weather, so it moves six months in the southern hemisphere. Festive ones don't. */
  weather: boolean;
};

export const SEASONAL_REMINDERS: SeasonalReminder[] = [
  {
    id: "freezer-clearout",
    title: "Clear out the freezer",
    body: "Eat the oldest things first and make some room.",
    types: ["freezer"],
    windows: [
      [
        [1, 2],
        [1, 31],
      ],
      [
        [7, 1],
        [7, 31],
      ],
    ],
    weather: false,
  },
  {
    id: "cupboard-check",
    title: "New year cupboard check",
    body: "Look at the back for tins and jars past their date.",
    types: ["pantry", "cupboard"],
    windows: [
      [
        [1, 2],
        [1, 31],
      ],
    ],
    weather: false,
  },
  {
    id: "medicine-check",
    title: "Check the medicine cabinet",
    body: "Throw out anything past its date and put what's run low on the shopping list.",
    types: ["medicine"],
    windows: [
      [
        [3, 1],
        [3, 31],
      ],
      [
        [9, 1],
        [9, 30],
      ],
    ],
    weather: false,
  },
  {
    id: "garden-spring",
    title: "Get the garden ready",
    body: "Check seeds, compost and tools before things start growing.",
    types: ["garden", "shed"],
    windows: [
      [
        [3, 1],
        [4, 30],
      ],
    ],
    weather: true,
  },
  {
    id: "summer-clothes",
    title: "Swap to summer clothes",
    body: "Bring the light things out and pack the winter coats away. Move them in the app too, so you can find them in autumn.",
    types: ["wardrobe"],
    windows: [
      [
        [4, 15],
        [5, 31],
      ],
    ],
    weather: true,
  },
  {
    id: "back-to-school",
    title: "Back-to-school check",
    body: "Pens, notebooks, glue sticks and printer ink, before term starts.",
    types: ["desk"],
    windows: [
      [
        [8, 15],
        [9, 10],
      ],
    ],
    weather: true,
  },
  {
    id: "winter-clothes",
    title: "Swap to winter clothes",
    body: "Get the coats and jumpers out, and move the summer things to where they'll live till spring.",
    types: ["wardrobe"],
    windows: [
      [
        [10, 1],
        [11, 15],
      ],
    ],
    weather: true,
  },
  {
    id: "garden-autumn",
    title: "Put the garden to bed",
    body: "Clean the tools, bring tender pots in and drain the hose before the frosts.",
    types: ["garden", "shed"],
    windows: [
      [
        [10, 1],
        [11, 30],
      ],
    ],
    weather: true,
  },
  {
    id: "car-winter",
    title: "Winter kit for the car",
    body: "An ice scraper, de-icer, a blanket, a torch and a phone charger in the boot.",
    types: ["car"],
    windows: [
      [
        [10, 15],
        [12, 15],
      ],
    ],
    weather: true,
  },
  {
    id: "toybox-clearout",
    title: "Make room in the toy box",
    body: "Pass on what isn't played with any more, before new toys arrive.",
    types: ["toybox"],
    windows: [
      [
        [11, 15],
        [12, 20],
      ],
    ],
    weather: false,
  },
  {
    id: "decorations",
    title: "Find the decorations",
    body: "Look them up now, so getting them down isn't a hunt.",
    types: ["attic", "box", "garage"],
    windows: [
      [
        [11, 20],
        [12, 15],
      ],
    ],
    weather: false,
  },
];

/** Time zones south of the equator, where the seasons are the other way round. */
const SOUTHERN = [
  /^Australia\//,
  /^Pacific\/(Auckland|Chatham|Fiji)$/,
  /^Antarctica\//,
  /^America\/(Argentina\/|Santiago|Montevideo|Sao_Paulo|Asuncion|La_Paz|Lima)/,
  /^Africa\/(Johannesburg|Maputo|Harare|Windhoek|Gaborone|Maseru|Mbabane|Lusaka)$/,
  /^Indian\/(Mauritius|Reunion)$/,
];

export function isSouthern(timeZone: string | undefined): boolean {
  return !!timeZone && SOUTHERN.some((r) => r.test(timeZone));
}

export function deviceTimeZone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return undefined;
  }
}

const shift = ([m, d]: MonthDay, by: number): MonthDay => [((m - 1 + by) % 12) + 1, d];
const key = ([m, d]: MonthDay) => m * 100 + d;
const pad = (n: number) => String(n).padStart(2, "0");

export type DueReminder = SeasonalReminder & {
  /** Which time round this is, e.g. "2026-10", so it can be ticked off until it comes round again. */
  period: string;
  /** The last day it shows, as yyyy-mm-dd. */
  until: string;
};

/** The reminders that are around today for a household with these kinds of place, ending soonest first. */
export function dueReminders(types: Iterable<LocationType>, today: string = todayIso(), southern = false): DueReminder[] {
  const have = new Set(types);
  const [y, m, d] = today.split("-").map(Number) as [number, number, number];
  const now = key([m, d]);
  const out: DueReminder[] = [];
  for (const r of SEASONAL_REMINDERS) {
    if (!r.types.some((t) => have.has(t))) continue;
    const by = southern && r.weather ? 6 : 0;
    for (const [a, b] of r.windows) {
      const from = shift(a, by);
      const to = shift(b, by);
      if (now >= key(from) && now <= key(to)) {
        out.push({ ...r, period: `${y}-${pad(from[0])}`, until: `${y}-${pad(to[0])}-${pad(to[1])}` });
        break;
      }
    }
  }
  return out.sort((a, b) => a.until.localeCompare(b.until));
}

/** "Autumn" and so on, for the section heading. */
export function seasonName(today: string = todayIso(), southern = false): string {
  const m = (Number(today.slice(5, 7)) - 1 + (southern ? 6 : 0)) % 12;
  return ["Winter", "Winter", "Spring", "Spring", "Spring", "Summer", "Summer", "Summer", "Autumn", "Autumn", "Autumn", "Winter"][m]!;
}

export const doneKey = (r: { id: string; period: string }) => `${r.id}@${r.period}`;

/** "Not now" hides a reminder on this device for a week. */
export const SNOOZE_DAYS = 7;

/** Drops snoozes that have run out, so the stored list doesn't grow for ever. */
export function liveSnoozes(snoozes: Record<string, string>, today: string = todayIso()): Record<string, string> {
  return Object.fromEntries(Object.entries(snoozes).filter(([, until]) => until > today));
}
