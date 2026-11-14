/**
 * "Check before you buy": whether something on the shopping list is already at home, or in a place
 * someone shares with you, so nobody buys a third bag of peas.
 */

export type StockLine = { name: string; quantity: number; unit: string; locationId: string };
export type HaveAlready = { count: number; unit: string; places: string[] };

/** Lower case words, with plurals made singular so "eggs" finds "Free-range egg". */
export function words(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1)
    .map((w) => (w.length > 3 && w.endsWith("ies") ? `${w.slice(0, -3)}y` : w.length > 3 && w.endsWith("es") && /(ch|sh|x|ss|o)es$/.test(w) ? w.slice(0, -2) : w.length > 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w));
}

/** Every word of the shopping list entry appears in the stored thing's name ("Milk" finds "Semi-skimmed milk"). */
export function sameThing(wanted: string, stored: string): boolean {
  const want = words(wanted);
  if (want.length === 0) return false;
  const have = new Set(words(stored));
  return want.every((w) => have.has(w));
}

export function haveAlready(wanted: string, stock: StockLine[], placeName: (id: string) => string | undefined): HaveAlready | null {
  const found = stock.filter((s) => sameThing(wanted, s.name));
  if (found.length === 0) return null;
  const units = new Set(found.map((f) => f.unit));
  // Counting only makes sense when everything is counted the same way ("3 items"); otherwise say how many things.
  const count = units.size === 1 && found[0]!.unit === "item" ? found.reduce((n, f) => n + f.quantity, 0) : found.length;
  const places = [...new Set(found.map((f) => placeName(f.locationId)).filter((p): p is string => !!p))];
  return { count, unit: "item", places };
}

/** "You have 2 in the Garage freezer", "You have some in the Pantry and 1 more place". */
export function haveLine(h: HaveAlready): string {
  const where = h.places.length === 0 ? "" : h.places.length === 1 ? ` in ${h.places[0]}` : ` in ${h.places[0]} and ${h.places.length - 1} more ${h.places.length === 2 ? "place" : "places"}`;
  return `You have ${h.count}${where}`;
}
