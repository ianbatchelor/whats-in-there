import type { LocationType } from "@/lib/household";

/**
 * A few things most homes keep in each kind of place, offered as one-tap adds on an empty place so
 * the first entries take seconds. Plain, common names only; people rename or remove them as they like.
 */
export const STARTER_THINGS: Record<LocationType, string[]> = {
  freezer: ["Frozen peas", "Ice cream", "Bread", "Chips"],
  fridge: ["Milk", "Butter", "Cheese", "Eggs"],
  pantry: ["Pasta", "Rice", "Tinned tomatoes", "Olive oil"],
  cupboard: ["Light bulbs", "Batteries", "Bin bags", "Washing-up liquid"],
  wine: ["Red wine", "White wine", "Prosecco"],
  attic: ["Christmas decorations", "Suitcases", "Photo albums", "Camping gear"],
  garage: ["Toolbox", "Drill", "Extension lead", "Car shampoo"],
  shed: ["Lawn mower", "Garden gloves", "Hose", "Compost"],
  wardrobe: ["Winter coat", "Rain jacket", "Spare bedding", "Party clothes"],
  box: ["Cables", "Instruction manuals", "Spare keys"],
  bookshelf: ["Cookbooks", "Board games", "Photo albums"],
  toybox: ["Lego", "Jigsaw puzzles", "Board games", "Dressing-up clothes"],
  desk: ["Printer ink", "Notebooks", "Pens", "Phone charger"],
  medicine: ["Paracetamol", "Plasters", "Antihistamines", "Thermometer"],
  car: ["Ice scraper", "First aid kit", "Jump leads", "Phone charger"],
  garden: ["Tulip bulbs", "Herbs", "Tomatoes"],
  other: ["Batteries", "Spare keys", "Torch"],
};

/** The starters not already in the place, so a tapped one disappears from the list. */
export function startersFor(type: LocationType, have: string[]): string[] {
  const owned = new Set(have.map((n) => n.trim().toLowerCase()));
  return STARTER_THINGS[type].filter((n) => !owned.has(n.toLowerCase()));
}
