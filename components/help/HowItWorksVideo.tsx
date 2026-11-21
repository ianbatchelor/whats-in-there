"use client";

import { useRef, useState } from "react";
import { CHAPTERS, HOW_IT_WORKS, chapterAt, clock, type Chapter } from "@/lib/domain/howItWorks";
import { IconPlay } from "@/components/ui/icons";

/** The How it works video, with its chapters underneath: tap one to play from there. */
export function HowItWorksVideo() {
  const video = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState<string | null>(null);

  function jump(c: Chapter) {
    const v = video.current;
    if (!v) return;
    v.currentTime = c.start;
    v.play().catch(() => {});
    v.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  return (
    <div className="not-doc flex flex-col gap-6">
      <div className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-brand shadow-[var(--shadow-lift)]">
        <video
          ref={video}
          src={HOW_IT_WORKS.src}
          poster={HOW_IT_WORKS.poster}
          controls
          playsInline
          preload="metadata"
          aria-label="How See What's in Here works, a video of just over a minute"
          className="block aspect-video w-full"
          onTimeUpdate={(e) => setPlaying(chapterAt(e.currentTarget.currentTime)?.id ?? null)}
        />
      </div>
      <p className="mt-0! text-[15px] text-mute">
        Just over a minute, with sound. Everything said is also on screen, so it works with the sound off.
      </p>

      <section className="flex flex-col gap-2.5">
        <h2 className="mt-0! font-display text-[17px]! font-bold tracking-[-0.01em]">Jump to a part</h2>
        <ol className="mt-0! list-none! divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-card pl-0! shadow-[var(--shadow-card)]">
          {CHAPTERS.map((c, i) => {
            const now = playing === c.id;
            return (
              <li key={c.id} className="mt-0!">
                <button
                  onClick={() => jump(c)}
                  aria-current={now ? "true" : undefined}
                  className={`flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-sunk/50 ${now ? "bg-check" : ""}`}
                >
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-tape font-display text-[14px] font-bold text-on-tape" aria-hidden="true">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15.5px] font-semibold">{c.title}</span>
                    <span className="block text-[14px] leading-snug text-mute">{c.text}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1 text-[13px] font-semibold text-leaf tabular-nums">
                    <IconPlay className="size-3.5" />
                    {clock(c.start)}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
