import type { LocationType } from "@/lib/household";

/**
 * Places made before a kind existed keep the old one: "Book shelf" saved as a Cupboard shows the
 * cupboard picture and gets no book covers. When a place's name clearly says another kind, the app
 * offers to switch it.
 */
const WORDS: Partial<Record<LocationType, string[]>> = {
  freezer: ["freezer", "chestfreezer"],
  fridge: ["fridge", "refrigerator"],
  pantry: ["pantry", "larder"],
  wardrobe: ["wardrobe", "closet"],
  attic: ["attic", "loft"],
  garage: ["garage"],
  shed: ["shed"],
  wine: ["wine", "winerack", "cellar"],
  bookshelf: ["bookshelf", "bookshelves", "bookcase", "books"],
  toybox: ["toybox", "toychest", "toys"],
  desk: ["desk"],
  medicine: ["medicine", "medicines", "medicinecabinet", "firstaid"],
  car: ["car", "van"],
};

/** The kind a name points to, when it isn't already that kind, or null when unsure. */
export function kindFromName(name: string, current: LocationType): LocationType | null {
  const words = name
    .toLowerCase()
    .replace(/['’]/g, "")
    .split(/[^a-z]+/)
    .filter(Boolean);
  const pieces = new Set([...words, ...words.slice(1).map((w, i) => words[i] + w)]);
  const hits = (Object.keys(WORDS) as LocationType[]).filter((k) => WORDS[k]!.some((w) => pieces.has(w)));
  // "Garage freezer" is a freezer that happens to be in the garage: leave it alone.
  if (hits.includes(current) || hits.length !== 1) return null;
  return hits[0]!;
}

const NAMES: Partial<Record<LocationType, string>> = {
  freezer: "freezer",
  fridge: "fridge",
  pantry: "pantry",
  wardrobe: "wardrobe",
  attic: "attic",
  garage: "garage",
  shed: "shed",
  wine: "wine rack",
  bookshelf: "bookshelf",
  toybox: "toy box",
  desk: "desk",
  medicine: "medicine cabinet",
  car: "car",
};

/** "a bookshelf", "an attic". */
export function aKind(kind: LocationType): string {
  const n = NAMES[kind] ?? kind;
  return `${/^[aeiou]/.test(n) ? "an" : "a"} ${n}`;
}
