import type { LocationType } from "@/lib/household";
import { PlaceArt } from "./PlaceArt";

/**
 * Photos for each kind of place. Kinds without a photo yet fall back to the illustration,
 * so adding a picture is just dropping a file in public/places and listing it here.
 */
const PHOTOS: Partial<Record<LocationType, { card: string; wide?: string; position?: string }>> = {
  freezer: { card: "/places/freezer.webp", wide: "/places/freezer-wide.webp", position: "50% 60%" },
  fridge: { card: "/places/fridge.webp", wide: "/places/fridge-wide.webp" },
  pantry: { card: "/places/pantry.webp", wide: "/places/pantry-wide.webp" },
  wardrobe: { card: "/places/wardrobe.webp", wide: "/places/wardrobe-wide.webp" },
  attic: { card: "/places/attic.webp", wide: "/places/attic-wide.webp" },
  garden: { card: "/places/garden.webp", wide: "/places/garden-wide.webp" },
  shed: { card: "/places/shed.webp", wide: "/places/welcome.webp", position: "52% 55%" },
  cupboard: { card: "/places/cupboard.webp", wide: "/places/cupboard-wide.webp" },
};

export function hasPhoto(type: LocationType): boolean {
  return type in PHOTOS;
}

export function PlacePhoto({
  type,
  variant = "card",
  className = "",
  eager = false,
}: {
  type: LocationType;
  variant?: "card" | "wide";
  className?: string;
  eager?: boolean;
}) {
  const photo = PHOTOS[type];
  if (!photo) return <PlaceArt type={type} className={className} />;
  const src = variant === "wide" ? (photo.wide ?? photo.card) : photo.card;
  return (
    // Static export: plain img, pre-sized webp files.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      aria-hidden="true"
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      className={`block h-full w-full object-cover ${className}`}
      style={photo.position ? { objectPosition: photo.position } : undefined}
    />
  );
}
