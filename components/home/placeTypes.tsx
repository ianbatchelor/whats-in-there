import type { LocationType } from "@/lib/household";
import {
  IconBox,
  IconCupboard,
  IconFridge,
  IconHanger,
  IconHouse,
  IconJar,
  IconShed,
  IconSnow,
  IconSprout,
  IconWine,
  IconWrench,
} from "@/components/ui/icons";

export type PlaceTypeInfo = {
  value: LocationType;
  label: string;
  plural: string;
  /** What each place of this type is called in counts: "2 places", "2 beds". */
  unit: [string, string];
  example: string;
  /** Example thing someone might add here, for placeholders. */
  thing: string;
  blurb: string;
  Icon: (p: { className?: string }) => React.ReactNode;
};

export const PLACE_TYPES: PlaceTypeInfo[] = [
  { value: "freezer", label: "Freezer", plural: "Freezers", unit: ["place", "places"], example: "Garage Freezer", thing: "Chicken curry", blurb: "Frozen food, oldest first.", Icon: IconSnow },
  { value: "fridge", label: "Fridge", plural: "Fridges", unit: ["place", "places"], example: "Kitchen Fridge", thing: "Cheddar", blurb: "Fresh food and leftovers.", Icon: IconFridge },
  { value: "pantry", label: "Pantry", plural: "Pantries", unit: ["place", "places"], example: "Pantry", thing: "Basmati rice", blurb: "Tins, jars and dry goods.", Icon: IconJar },
  { value: "cupboard", label: "Cupboard", plural: "Cupboards", unit: ["place", "places"], example: "Kitchen Cupboard", thing: "Spare light bulbs", blurb: "Everyday things behind closed doors.", Icon: IconCupboard },
  { value: "wardrobe", label: "Wardrobe", plural: "Wardrobes", unit: ["place", "places"], example: "Bedroom Wardrobe", thing: "Winter coat", blurb: "Clothes, shoes and seasonal kit.", Icon: IconHanger },
  { value: "attic", label: "Attic", plural: "Attics", unit: ["place", "places"], example: "Attic", thing: "Christmas lights", blurb: "Long-term storage and seasonal items.", Icon: IconHouse },
  { value: "garage", label: "Garage", plural: "Garages", unit: ["place", "places"], example: "Garage", thing: "Cordless drill", blurb: "Tools, equipment and spares.", Icon: IconWrench },
  { value: "shed", label: "Shed", plural: "Sheds", unit: ["place", "places"], example: "Garden Shed", thing: "Lawn feed", blurb: "Garden tools and outdoor kit.", Icon: IconShed },
  { value: "garden", label: "Garden", plural: "Garden", unit: ["area", "areas"], example: "Raised Bed 1", thing: "Tulip bulbs", blurb: "Beds, pots and what's planted in them.", Icon: IconSprout },
  { value: "box", label: "Box", plural: "Boxes", unit: ["box", "boxes"], example: "Blue Storage Box", thing: "Tree decorations", blurb: "Storage boxes and crates.", Icon: IconBox },
  { value: "wine", label: "Wine", plural: "Wine", unit: ["rack", "racks"], example: "Wine Rack", thing: "Rioja 2019", blurb: "Bottles, vintages and when to drink them.", Icon: IconWine },
  { value: "other", label: "Something else", plural: "Other places", unit: ["place", "places"], example: "Utility Shelf", thing: "Spare phone charger", blurb: "Anywhere you put things.", Icon: IconBox },
];

export function placeType(value: LocationType): PlaceTypeInfo {
  return PLACE_TYPES.find((t) => t.value === value) ?? PLACE_TYPES[PLACE_TYPES.length - 1]!;
}

export function countPlaces(n: number, type: LocationType): string {
  const [one, many] = placeType(type).unit;
  return `${n} ${n === 1 ? one : many}`;
}
