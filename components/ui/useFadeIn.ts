"use client";

import { useCallback, useState } from "react";

/**
 * Lets a picture fade in once it has loaded, so lists don't flash blank tiles while scrolling.
 * Pictures already in the browser's cache show straight away.
 */
export function useFadeIn() {
  const [loaded, setLoaded] = useState(false);
  const seen = useCallback((img: HTMLImageElement | null) => {
    if (img?.complete) setLoaded(true);
  }, []);
  return {
    seen,
    onLoad: () => setLoaded(true),
    className: `transition-opacity duration-300 motion-reduce:transition-none ${loaded ? "opacity-100" : "opacity-0"}`,
  };
}
