"use client";

import { useState } from "react";
import type { LocationType } from "@/lib/household";
import { useItemPhoto } from "@/lib/itemPhotos";
import { PlaceArt } from "./PlaceArt";
import { useFadeIn } from "@/components/ui/useFadeIn";

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
  shed: { card: "/places/shed.webp", wide: "/places/shed-wide.webp" },
  cupboard: { card: "/places/cupboard.webp", wide: "/places/cupboard-wide.webp" },
  garage: { card: "/places/garage.webp", wide: "/places/garage-wide.webp" },
  box: { card: "/places/box.webp", wide: "/places/box-wide.webp" },
  wine: { card: "/places/wine.webp", wide: "/places/wine-wide.webp" },
  other: { card: "/places/other.webp", wide: "/places/other-wide.webp" },
};

export function hasPhoto(type: LocationType): boolean {
  return type in PHOTOS;
}

export function PlacePhoto({
  type,
  imagePath,
  variant = "card",
  className = "",
  eager = false,
}: {
  type: LocationType;
  /** The household's own photo of this place. Our photo for the kind of place shows until it loads, or if there is none. */
  imagePath?: string | null;
  variant?: "card" | "wide";
  className?: string;
  eager?: boolean;
}) {
  const own = useItemPhoto(imagePath, variant === "wide");
  const [broken, setBroken] = useState<string | null>(null);
  const { seen, onLoad, className: fadeClass } = useFadeIn();
  if (own && broken !== own) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={own}
        alt=""
        aria-hidden="true"
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        key={own}
        ref={seen}
        onLoad={onLoad}
        onError={() => setBroken(own)}
        className={`block h-full w-full bg-sunk object-cover ${fadeClass} ${className}`}
      />
    );
  }
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
      ref={seen}
      onLoad={onLoad}
      className={`block h-full w-full object-cover saturate-[0.88] ${fadeClass} ${className}`}
      style={photo.position ? { objectPosition: photo.position } : undefined}
    />
  );
}
