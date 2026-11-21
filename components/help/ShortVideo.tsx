"use client";

import { useState } from "react";
import { IconChevronRight, IconPlay, IconX } from "@/components/ui/icons";

/**
 * A short portrait video as a small card: a thumbnail, a title and what it shows. Tapping it opens the
 * video in place and plays it, so a tall video doesn't push the page down until someone wants it.
 */
export function ShortVideo({ src, poster, title, sub, id }: { src: string; poster: string; title: string; sub: string; id?: string }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        id={id}
        type="button"
        onClick={() => setOpen(true)}
        className="not-doc flex w-full scroll-mt-4 items-center gap-3.5 rounded-[var(--radius-card)] border border-line bg-card p-2.5 pr-4 text-left shadow-[var(--shadow-card)] transition hover:bg-sunk/50"
      >
        <span className="relative h-24 w-[54px] shrink-0 overflow-hidden rounded-xl bg-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={poster} alt="" className="h-full w-full object-cover" />
          <span className="absolute inset-0 grid place-items-center bg-black/25" aria-hidden="true">
            <span className="grid size-8 place-items-center rounded-full bg-white/90 text-brand">
              <IconPlay className="size-4 translate-x-px" />
            </span>
          </span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-display text-[16px] font-bold">{title}</span>
          <span className="block text-[14px] leading-snug text-mute">{sub}</span>
        </span>
        <IconChevronRight className="size-4 shrink-0 text-mute/70" />
      </button>
    );
  }

  return (
    <div id={id} className="not-doc relative flex scroll-mt-4 justify-center rounded-[var(--radius-card)] bg-brand p-3 shadow-[var(--shadow-lift)]">
      <video
        src={src}
        poster={poster}
        controls
        autoPlay
        playsInline
        aria-label={title}
        className="block aspect-[9/16] max-h-[78svh] w-auto max-w-full rounded-xl bg-black"
      />
      <button
        type="button"
        onClick={() => setOpen(false)}
        aria-label="Close the video"
        className="absolute top-5 right-5 grid size-10 place-items-center rounded-full bg-black/45 text-white backdrop-blur hover:bg-black/60"
      >
        <IconX className="size-5" />
      </button>
    </div>
  );
}
