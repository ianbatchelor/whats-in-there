import type { LocationType } from "@/lib/household";
import { IconBox, IconCupboard, IconFridge, IconJar, IconSnow, IconWine } from "@/components/ui/icons";

export const PLACE_TYPES: { value: LocationType; label: string; example: string; Icon: (p: { className?: string }) => React.ReactNode }[] = [
  { value: "freezer", label: "Freezer", example: "Garage Freezer", Icon: IconSnow },
  { value: "fridge", label: "Fridge", example: "Kitchen Fridge", Icon: IconFridge },
  { value: "pantry", label: "Pantry", example: "Pantry", Icon: IconJar },
  { value: "cupboard", label: "Cupboard", example: "Kitchen Cupboard", Icon: IconCupboard },
  { value: "wine", label: "Wine", example: "Wine Rack", Icon: IconWine },
  { value: "other", label: "Other", example: "Utility Shelf", Icon: IconBox },
];

export function placeType(value: LocationType) {
  return PLACE_TYPES.find((t) => t.value === value) ?? PLACE_TYPES[PLACE_TYPES.length - 1]!;
}
