import type { CSSProperties } from "react";
import type { Wrap } from "@/lib/domain/presents";

/** Wrapping paper: the colour with a faint pattern of tiny stars and dots, like a good gift shop's. */
export function paperStyle(wrap: Wrap): CSSProperties {
  return {
    backgroundColor: wrap.paper,
    backgroundImage: [
      "radial-gradient(circle at 25% 25%, rgba(255,255,255,0.16) 0 1.2px, transparent 1.6px)",
      "radial-gradient(circle at 75% 75%, rgba(255,255,255,0.10) 0 2px, transparent 2.4px)",
      "linear-gradient(160deg, rgba(255,255,255,0.10), rgba(0,0,0,0.12))",
    ].join(","),
    backgroundSize: "18px 18px, 18px 18px, 100% 100%",
    color: wrap.ink,
  };
}

/** A satin bow: two loops, two tails and a knot, shaded so it reads as ribbon, not a drawing. */
export function Bow({ color, className = "" }: { color: string; className?: string }) {
  return (
    <svg viewBox="0 0 64 40" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={`bow-${color.slice(1)}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.45" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.2" />
        </linearGradient>
      </defs>
      <g fill={color}>
        <path d="M30 22 C 22 34, 18 38, 14 40 L 20 40 L 24 36 L 26 40 L 31 26 Z" />
        <path d="M34 22 C 42 34, 46 38, 50 40 L 44 40 L 40 36 L 38 40 L 33 26 Z" />
        <path d="M32 20 C 24 6, 6 2, 6 12 C 6 22, 22 24, 32 22 Z" />
        <path d="M32 20 C 40 6, 58 2, 58 12 C 58 22, 42 24, 32 22 Z" />
      </g>
      <g fill={`url(#bow-${color.slice(1)})`}>
        <path d="M32 20 C 24 6, 6 2, 6 12 C 6 22, 22 24, 32 22 Z" />
        <path d="M32 20 C 40 6, 58 2, 58 12 C 58 22, 42 24, 32 22 Z" />
      </g>
      <path d="M32 21 C 26 13, 15 9, 12 12" fill="none" stroke="rgba(0,0,0,0.22)" strokeWidth="1.2" />
      <path d="M32 21 C 38 13, 49 9, 52 12" fill="none" stroke="rgba(0,0,0,0.22)" strokeWidth="1.2" />
      <rect x="27.5" y="16" width="9" height="10" rx="3.5" fill={color} />
      <rect x="27.5" y="16" width="9" height="10" rx="3.5" fill="rgba(0,0,0,0.14)" />
    </svg>
  );
}

/** A small wrapped box: paper, a ribbon each way and a bow. Children sit on the paper (a count, say). */
export function GiftBox({ wrap, className = "", children }: { wrap: Wrap; className?: string; children?: React.ReactNode }) {
  return (
    <span className={`relative block ${className}`}>
      <Bow color={wrap.ribbon} className="absolute -top-[22%] left-1/2 z-10 w-[56%] -translate-x-1/2 drop-shadow-[0_2px_2px_rgba(0,0,0,0.25)]" />
      <span
        className="relative block h-full w-full overflow-hidden rounded-[14px] shadow-[inset_0_-10px_20px_-12px_rgba(0,0,0,0.45),0_10px_22px_-14px_rgba(21,33,28,0.6)]"
        style={paperStyle(wrap)}
      >
        <span className="absolute inset-y-0 left-1/2 w-[13%] -translate-x-1/2" style={{ background: wrap.ribbon, boxShadow: "inset 2px 0 0 rgba(255,255,255,0.25), inset -2px 0 0 rgba(0,0,0,0.12)" }} />
        <span className="absolute inset-x-0 top-[34%] h-[13%]" style={{ background: wrap.ribbon, boxShadow: "inset 0 2px 0 rgba(255,255,255,0.25), inset 0 -2px 0 rgba(0,0,0,0.12)" }} />
        {children}
      </span>
    </span>
  );
}

/** A luggage-style gift tag with a punched hole and string, for "To:" labels. */
export function GiftTag({ children, className = "", style }: { children: React.ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <span
      className={`relative inline-flex min-w-0 items-center gap-1.5 py-1 pr-2.5 pl-5 font-display text-[12.5px] font-bold ${className}`}
      style={{ clipPath: "polygon(10px 0, 100% 0, 100% 100%, 10px 100%, 0 50%)", ...style }}
    >
      <span aria-hidden="true" className="absolute top-1/2 left-[9px] size-[5px] -translate-y-1/2 rounded-full bg-bg ring-1 ring-black/15" />
      {children}
    </span>
  );
}

/** The wide wrapped band at the top of someone's list: paper, a ribbon across, and a bow. */
export function WrappedBand({ wrap, children, className = "" }: { wrap: Wrap; children: React.ReactNode; className?: string }) {
  return (
    <div className={`relative isolate overflow-hidden rounded-[22px] shadow-[0_18px_38px_-24px_rgba(21,33,28,0.75)] ${className}`} style={paperStyle(wrap)}>
      <span aria-hidden="true" className="absolute inset-y-0 right-[18%] -z-10 w-5" style={{ background: wrap.ribbon, boxShadow: "inset 2px 0 0 rgba(255,255,255,0.25), inset -2px 0 0 rgba(0,0,0,0.12)" }} />
      <Bow color={wrap.ribbon} className="absolute top-1 right-[calc(18%-34px)] -z-10 w-[88px] drop-shadow-[0_3px_3px_rgba(0,0,0,0.3)]" />
      <div className="relative px-5 pt-5 pb-5 pr-[30%] sm:px-7 sm:pt-7 sm:pr-[32%]">{children}</div>
    </div>
  );
}
