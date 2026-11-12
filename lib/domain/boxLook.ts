/**
 * Boxes and shelves inside a place used to all show the same stock photo of a cardboard box.
 * Each now gets a colour of its own (the same one every time, on every phone) and shows what's
 * in it: its things' photos when there are some, or a label with the first few names on it.
 */

/** Deep, muted colours that white text reads well on, in light and dark mode. */
export const BOX_COLOURS = [
  { name: "forest", bg: "#2f5d4a" },
  { name: "clay", bg: "#9a4f35" },
  { name: "slate", bg: "#3c5a78" },
  { name: "plum", bg: "#6a4466" },
  { name: "ochre", bg: "#82601a" },
  { name: "teal", bg: "#2c6670" },
  { name: "rose", bg: "#8e4252" },
  { name: "olive", bg: "#585f2e" },
] as const;

export type BoxColour = (typeof BOX_COLOURS)[number];

/** The same colour for a box every time, picked from its id. */
export function boxColour(id: string): BoxColour {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return BOX_COLOURS[(h >>> 0) % BOX_COLOURS.length]!;
}

/** A few of the things in a box, for its cover. */
export type Peek = { name: string; brand: string | null; category: string | null; imagePath: string | null };

export function toPeek(i: { productName: string; brand: string | null; category: string | null; imagePath?: string | null }): Peek {
  return { name: i.productName, brand: i.brand, category: i.category, imagePath: i.imagePath ?? null };
}

/** How many things show on a cover. */
export const PEEK_MAX = 4;

/**
 * What the cover shows: photos when any of the first few things has one (or is a book, which gets
 * its cover), a label with names when there are things but no pictures, or "Empty".
 */
export function coverKind(peeks: Peek[], hasPicture: (p: Peek) => boolean = (p) => !!p.imagePath): "photos" | "label" | "empty" {
  if (peeks.length === 0) return "empty";
  return peeks.slice(0, PEEK_MAX).some(hasPicture) ? "photos" : "label";
}

/** The names written on the label, and how many more there are: "Fairy lights, Baubles, Star +5 more". */
export function labelLines(peeks: Peek[], total: number, max = 3): { lines: string[]; more: number } {
  const lines = peeks
    .slice(0, max)
    .map((p) => p.name.trim())
    .filter(Boolean);
  return { lines, more: Math.max(0, total - lines.length) };
}

/** Pictures first, so a box with two photos among ten things still shows them; newest first otherwise. */
export function pickPeeks(rows: Peek[], max = PEEK_MAX): Peek[] {
  const withPhoto = rows.filter((r) => r.imagePath);
  const without = rows.filter((r) => !r.imagePath);
  return withPhoto.length > 0 ? [...withPhoto, ...without].slice(0, max) : rows.slice(0, max);
}
