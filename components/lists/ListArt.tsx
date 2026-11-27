"use client";

import { useState } from "react";

/**
 * One of the lists' pictures, in a fixed box so nothing moves when it loads. Decoration only:
 * every word is real text beside it. If the picture can't load (offline, say) the box stays empty,
 * so the card keeps its shape and its tint and never shows a broken-image icon.
 */
export function ListArt({ src, className, size = 192 }: { src: string; className: string; size?: number }) {
  const [failed, setFailed] = useState<string | null>(null);
  if (failed === src) return <span aria-hidden="true" className={`shrink-0 ${className}`} />;
  return (
    // Static export: plain img, pre-sized webp files.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      decoding="async"
      onError={() => setFailed(src)}
      className={`shrink-0 object-contain ${className}`}
    />
  );
}
