"use client";

import { useEffect, useRef } from "react";

/**
 * A photo header that shrinks into a slim bar as you scroll, on phones.
 *
 * The header is sticky with a negative top, so it scrolls up until only a strip the height of its
 * button row is left showing. While that happens the button row is moved down by the same amount, so
 * it stays in view; the big title fades out and a small one fades in beside the buttons.
 * Nothing changes height, so the list underneath never jumps. Styles are written straight to the
 * elements on each frame instead of through React state, to keep scrolling smooth.
 */
export function useCollapsingHeader(enabled: boolean) {
  const header = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const big = useRef<HTMLDivElement>(null);
  const small = useRef<HTMLSpanElement>(null);
  const shade = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!enabled) return;
    const phone = window.matchMedia("(max-width: 639.98px)");
    let range = 0;
    let frame = 0;

    const paint = () => {
      frame = 0;
      const h = header.current;
      const b = bar.current;
      if (!h || !b) return;
      const shift = phone.matches ? Math.min(Math.max(window.scrollY, 0), range) : 0;
      const p = range > 0 ? shift / range : 0;
      b.style.transform = shift ? `translateY(${shift}px)` : "";
      if (big.current) big.current.style.opacity = String(Math.max(0, 1 - p * 1.6));
      if (small.current) small.current.style.opacity = String(Math.max(0, (p - 0.6) / 0.4));
      if (shade.current) shade.current.style.opacity = String(p);
      h.dataset.collapsed = p >= 1 ? "true" : "false";
    };

    const measure = () => {
      const h = header.current;
      const b = bar.current;
      if (!h || !b) return;
      if (!phone.matches) {
        range = 0;
        h.style.top = "";
      } else {
        // Leave the button row plus a 12px margin under it showing.
        range = Math.max(0, h.offsetHeight - (b.offsetTop + b.offsetHeight + 12));
        h.style.top = `${-range}px`;
      }
      paint();
    };

    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(paint);
    };

    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", measure);
    phone.addEventListener("change", measure);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", measure);
      phone.removeEventListener("change", measure);
    };
  }, [enabled]);

  return { header, bar, big, small, shade };
}
