"use client";

import { useId } from "react";
import type { LocationType } from "@/lib/household";

/**
 * Illustrated scenes for each kind of place. One visual language (warm light, soft shading,
 * the same palette) so a freezer, an attic and a garden all feel like the same app.
 * viewBox is 320 × 220; the parent decides the crop with object-fit style classes.
 */

const C = {
  wall: "#efe6d5",
  wallShade: "#e3d6bf",
  floor: "#d9c7a8",
  wood: "#b98352",
  woodDark: "#8a5a33",
  woodLight: "#d8a873",
  forest: "#183f32",
  leaf: "#3e7a57",
  leafLight: "#74ab7c",
  gold: "#f6c65b",
  goldDeep: "#e0a93a",
  cream: "#fffdf8",
  steel: "#a9bcc0",
  frost: "#e4eef0",
  frostDeep: "#c6d8dc",
  ink: "#17242a",
  soil: "#6b4a33",
  soilDark: "#4f3524",
  sky: "#dfe9df",
};

type ArtProps = { className?: string; title?: string };

function Frame({ id, children, bg, className, title }: { id: string; children: React.ReactNode; bg: [string, string]; className?: string; title?: string }) {
  return (
    <svg viewBox="0 0 320 220" className={className} role={title ? "img" : undefined} aria-hidden={title ? undefined : true} preserveAspectRatio="xMidYMid slice">
      {title ? <title>{title}</title> : null}
      <defs>
        <linearGradient id={`${id}-bg`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={bg[0]} />
          <stop offset="1" stopColor={bg[1]} />
        </linearGradient>
        <radialGradient id={`${id}-glow`} cx="0.5" cy="0.25" r="0.75">
          <stop offset="0" stopColor="#fff6dc" stopOpacity="0.85" />
          <stop offset="1" stopColor="#fff6dc" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}-shine`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.55" />
          <stop offset="0.5" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="320" height="220" fill={`url(#${id}-bg)`} />
      {children}
    </svg>
  );
}

function Floor({ y = 176, color = C.floor }: { y?: number; color?: string }) {
  return (
    <>
      <rect x="0" y={y} width="320" height={220 - y} fill={color} />
      <rect x="0" y={y} width="320" height="3" fill="#000" opacity="0.06" />
    </>
  );
}

function Shadow({ cx, y, rx }: { cx: number; y: number; rx: number }) {
  return <ellipse cx={cx} cy={y} rx={rx} ry="7" fill="#000" opacity="0.12" />;
}

function Freezer({ className, title }: ArtProps) {
  const id = useId().replace(/:/g, "");
  return (
    <Frame id={id} bg={["#e9f1f1", "#d7e5e6"]} className={className} title={title}>
      <rect width="320" height="220" fill={`url(#${id}-glow)`} />
      <Floor y={170} color="#c9d7d6" />
      <Shadow cx={160} y={178} rx={112} />
      {/* chest freezer body */}
      <rect x="54" y="104" width="212" height="72" rx="10" fill={C.cream} />
      <rect x="54" y="150" width="212" height="26" rx="8" fill={C.frostDeep} opacity="0.55" />
      {/* open lid */}
      <path d="M60 104 L84 46 L262 46 L264 104 Z" fill="#f7fafa" />
      <path d="M84 46 L262 46 L262 52 L82 52 Z" fill={C.frostDeep} />
      <path d="M70 100 L90 56 L252 56 L254 100 Z" fill={C.frost} />
      {/* frost inside + food */}
      <rect x="66" y="96" width="188" height="14" rx="4" fill="#ffffff" />
      <rect x="78" y="86" width="40" height="18" rx="4" fill={C.gold} />
      <rect x="122" y="82" width="34" height="22" rx="4" fill="#dd8b5b" />
      <rect x="160" y="88" width="44" height="16" rx="4" fill={C.leafLight} />
      <rect x="208" y="84" width="34" height="20" rx="4" fill="#f2d9b3" />
      <rect x="66" y="96" width="188" height="6" rx="3" fill="#ffffff" opacity="0.9" />
      {/* handle and details */}
      <rect x="140" y="116" width="40" height="6" rx="3" fill={C.steel} />
      <circle cx="244" cy="160" r="3" fill={C.leaf} />
      <path d="M90 60 l8 6 M96 58 l-4 10 M236 62 l6 5 M241 60 l-3 8" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />
      <rect x="54" y="104" width="212" height="72" rx="10" fill={`url(#${id}-shine)`} />
    </Frame>
  );
}

function Fridge({ className, title }: ArtProps) {
  const id = useId().replace(/:/g, "");
  return (
    <Frame id={id} bg={["#f3ece0", "#e6dccb"]} className={className} title={title}>
      <rect width="320" height="220" fill={`url(#${id}-glow)`} />
      <Floor y={182} />
      <rect x="40" y="70" width="60" height="112" rx="4" fill={C.woodLight} opacity="0.6" />
      <rect x="220" y="84" width="70" height="98" rx="4" fill={C.woodLight} opacity="0.6" />
      <Shadow cx={160} y={186} rx={62} />
      <rect x="108" y="22" width="104" height="160" rx="16" fill={C.cream} />
      <rect x="108" y="22" width="104" height="160" rx="16" fill={`url(#${id}-shine)`} />
      <rect x="108" y="78" width="104" height="4" fill={C.wallShade} />
      <rect x="196" y="36" width="5" height="32" rx="2.5" fill={C.steel} />
      <rect x="196" y="92" width="5" height="46" rx="2.5" fill={C.steel} />
      {/* magnets and notes */}
      <rect x="124" y="40" width="22" height="24" rx="2" fill={C.gold} transform="rotate(-6 135 52)" />
      <rect x="152" y="98" width="24" height="18" rx="2" fill="#f4dcc0" transform="rotate(4 164 107)" />
      <circle cx="132" cy="104" r="5" fill="#d9724f" />
      <circle cx="168" cy="44" r="4" fill={C.leaf} />
      <rect x="130" y="126" width="30" height="22" rx="2" fill="#ffffff" stroke={C.wallShade} />
      <path d="M135 133h20M135 139h14" stroke={C.steel} strokeWidth="2" strokeLinecap="round" />
    </Frame>
  );
}

function Pantry({ className, title }: ArtProps) {
  const id = useId().replace(/:/g, "");
  const jar = (x: number, y: number, h: number, fill: string, lid = C.woodDark) => (
    <g key={`${x}-${y}`}>
      <rect x={x} y={y - h} width="24" height={h} rx="5" fill={fill} />
      <rect x={x} y={y - h} width="24" height={h} rx="5" fill="#ffffff" opacity="0.25" />
      <rect x={x + 2} y={y - h - 6} width="20" height="7" rx="2" fill={lid} />
      <rect x={x + 5} y={y - h / 2 - 4} width="14" height="8" rx="1.5" fill={C.cream} opacity="0.9" />
    </g>
  );
  return (
    <Frame id={id} bg={["#f2e8d6", "#e7d7bd"]} className={className} title={title}>
      <rect x="24" y="14" width="272" height="196" rx="6" fill={C.woodDark} />
      <rect x="32" y="20" width="256" height="186" fill="#efe1c8" />
      <rect width="320" height="220" fill={`url(#${id}-glow)`} />
      {[76, 136, 196].map((y) => (
        <rect key={y} x="28" y={y} width="264" height="8" fill={C.wood} />
      ))}
      {[jar(44, 76, 34, "#e9b44c"), jar(74, 76, 40, "#c8573a"), jar(104, 76, 30, "#9cba7b"), jar(134, 76, 38, "#f1dcae"), jar(164, 76, 32, "#d58f4e"), jar(194, 76, 40, "#7c9a5a"), jar(224, 76, 34, "#efc56b"), jar(254, 76, 30, "#c86b4a")]}
      {[jar(48, 136, 42, "#f3e3c3"), jar(80, 136, 36, "#b9804a"), jar(112, 136, 40, "#e6c27a"), jar(208, 136, 38, "#9fbf86"), jar(240, 136, 44, "#e0a35b")]}
      <rect x="146" y="98" width="50" height="38" rx="3" fill="#cfa36f" />
      <rect x="146" y="98" width="50" height="10" fill="#b98352" />
      <rect x="44" y="160" width="70" height="36" rx="3" fill="#d9b585" />
      <rect x="124" y="166" width="54" height="30" rx="14" fill="#c8a06b" />
      <rect x="190" y="152" width="40" height="44" rx="6" fill="#e9b44c" />
      <rect x="238" y="160" width="36" height="36" rx="5" fill="#9cba7b" />
    </Frame>
  );
}

function Cupboard({ className, title }: ArtProps) {
  const id = useId().replace(/:/g, "");
  return (
    <Frame id={id} bg={["#f3ebdc", "#e8dcc7"]} className={className} title={title}>
      <rect width="320" height="220" fill={`url(#${id}-glow)`} />
      <Floor y={184} />
      <Shadow cx={160} y={188} rx={120} />
      <rect x="44" y="40" width="232" height="146" rx="8" fill={C.forest} />
      <rect x="54" y="50" width="104" height="128" rx="5" fill="#f1e6d2" />
      {/* open left door */}
      <path d="M54 50 L28 40 L28 192 L54 178 Z" fill="#245a46" />
      {/* contents */}
      <rect x="54" y="98" width="104" height="5" fill={C.wood} />
      <rect x="54" y="140" width="104" height="5" fill={C.wood} />
      <rect x="64" y="72" width="22" height="26" rx="3" fill={C.cream} />
      <rect x="90" y="66" width="18" height="32" rx="3" fill="#e9b44c" />
      <rect x="112" y="76" width="34" height="22" rx="3" fill="#c86b4a" />
      <circle cx="78" cy="128" r="12" fill={C.cream} />
      <circle cx="104" cy="128" r="12" fill="#ffffff" stroke={C.wallShade} />
      <rect x="124" y="114" width="24" height="26" rx="4" fill={C.leafLight} />
      <rect x="64" y="152" width="80" height="22" rx="4" fill="#d9b585" />
      {/* closed right door */}
      <rect x="164" y="50" width="104" height="128" rx="5" fill="#245a46" />
      <rect x="174" y="60" width="84" height="108" rx="4" fill="none" stroke="#ffffff" strokeOpacity="0.18" strokeWidth="2" />
      <circle cx="176" cy="114" r="4" fill={C.gold} />
      <rect x="44" y="40" width="232" height="10" rx="5" fill="#0f2e24" />
    </Frame>
  );
}

function Wine({ className, title }: ArtProps) {
  const id = useId().replace(/:/g, "");
  const bottle = (cx: number, cy: number, c: string) => (
    <g key={`${cx}-${cy}`}>
      <circle cx={cx} cy={cy} r="15" fill="#2a1d18" />
      <circle cx={cx} cy={cy} r="11" fill={c} />
      <circle cx={cx} cy={cy} r="5" fill="#1a1210" />
      <circle cx={cx - 4} cy={cy - 4} r="3" fill="#ffffff" opacity="0.35" />
    </g>
  );
  const rows = [52, 90, 128, 166];
  const cols = [70, 110, 150, 190, 230, 270];
  return (
    <Frame id={id} bg={["#ecdcc4", "#d9c3a2"]} className={className} title={title}>
      <rect x="40" y="26" width="260" height="176" rx="6" fill={C.woodDark} />
      <rect x="48" y="32" width="244" height="164" fill="#5c3b25" />
      {rows.map((y, r) => cols.map((x, i) => ((r + i) % 5 === 3 ? null : bottle(x - 20, y, ["#6b1e2a", "#3f5b2a", "#7a2431", "#c79a3c"][(r * 3 + i) % 4]!))))}
      <rect width="320" height="220" fill={`url(#${id}-glow)`} opacity="0.6" />
    </Frame>
  );
}

function Attic({ className, title }: ArtProps) {
  const id = useId().replace(/:/g, "");
  return (
    <Frame id={id} bg={["#c58a55", "#8a5a33"]} className={className} title={title}>
      {/* roof timbers */}
      <path d="M0 0 L160 -10 L320 0 L320 220 L0 220 Z" fill="#a8703f" />
      <path d="M0 150 L160 20 L320 150 L320 220 L0 220 Z" fill="#d7a874" />
      <path d="M160 20 L0 150" stroke={C.woodDark} strokeWidth="10" />
      <path d="M160 20 L320 150" stroke={C.woodDark} strokeWidth="10" />
      <path d="M60 101 L60 220 M260 101 L260 220" stroke="#9b6539" strokeWidth="7" />
      {/* window with light */}
      <rect x="138" y="52" width="44" height="40" rx="3" fill="#fff4d2" />
      <path d="M160 52v40M138 72h44" stroke={C.woodDark} strokeWidth="4" />
      <path d="M138 92 L60 220 L270 220 L182 92 Z" fill="#fff1c8" opacity="0.28" />
      <rect width="320" height="220" fill={`url(#${id}-glow)`} opacity="0.5" />
      <Floor y={180} color="#a87444" />
      {/* boxes */}
      <Shadow cx={110} y={184} rx={70} />
      <rect x="44" y="130" width="70" height="52" rx="3" fill="#d9b07a" />
      <rect x="44" y="130" width="70" height="12" fill="#c69a63" />
      <rect x="72" y="130" width="14" height="52" fill="#e9c995" opacity="0.7" />
      <rect x="58" y="98" width="56" height="34" rx="3" fill="#e2bd88" />
      <rect x="80" y="98" width="12" height="34" fill="#f0d7aa" opacity="0.7" />
      <rect x="118" y="146" width="58" height="36" rx="3" fill="#c99b62" />
      <rect x="128" y="156" width="26" height="10" rx="2" fill={C.cream} opacity="0.85" />
      {/* trunk */}
      <Shadow cx={238} y={184} rx={52} />
      <rect x="194" y="134" width="88" height="48" rx="6" fill="#5b3a23" />
      <rect x="194" y="126" width="88" height="18" rx="8" fill="#6e4629" />
      <rect x="212" y="126" width="6" height="56" fill="#c9a24f" />
      <rect x="258" y="126" width="6" height="56" fill="#c9a24f" />
      <rect x="232" y="146" width="12" height="10" rx="2" fill={C.gold} />
    </Frame>
  );
}

function Garage({ className, title }: ArtProps) {
  const id = useId().replace(/:/g, "");
  return (
    <Frame id={id} bg={["#e4e0d6", "#d2ccbe"]} className={className} title={title}>
      <rect width="320" height="220" fill={`url(#${id}-glow)`} />
      <Floor y={178} color="#b9b3a6" />
      {/* pegboard */}
      <rect x="30" y="28" width="170" height="96" rx="4" fill="#d6b88b" />
      {Array.from({ length: 7 }).map((_, r) =>
        Array.from({ length: 15 }).map((__, c) => <circle key={`${r}-${c}`} cx={40 + c * 11} cy={38 + r * 12} r="1.4" fill="#a98559" />),
      )}
      {/* tools */}
      <path d="M52 44 v52" stroke={C.woodDark} strokeWidth="6" strokeLinecap="round" />
      <rect x="42" y="40" width="20" height="12" rx="2" fill="#6f7c80" />
      <path d="M84 46 l18 40" stroke={C.forest} strokeWidth="6" strokeLinecap="round" />
      <path d="M100 46 l-18 40" stroke={C.forest} strokeWidth="6" strokeLinecap="round" />
      <circle cx="132" cy="62" r="14" fill="none" stroke="#c4553a" strokeWidth="6" />
      <rect x="158" y="44" width="10" height="56" rx="3" fill={C.gold} />
      <rect x="176" y="50" width="8" height="40" rx="3" fill="#6f7c80" />
      {/* shelving with bins */}
      <rect x="214" y="28" width="80" height="152" rx="3" fill="none" stroke="#7d8689" strokeWidth="5" />
      {[70, 116, 162].map((y) => (
        <rect key={y} x="214" y={y} width="80" height="5" fill="#7d8689" />
      ))}
      <rect x="222" y="42" width="30" height="28" rx="3" fill={C.leaf} />
      <rect x="256" y="46" width="30" height="24" rx="3" fill={C.gold} />
      <rect x="222" y="88" width="64" height="28" rx="3" fill="#c4553a" />
      <rect x="222" y="134" width="40" height="28" rx="3" fill="#3e6d8a" />
      {/* workbench */}
      <Shadow cx={110} y={182} rx={90} />
      <rect x="24" y="132" width="180" height="12" rx="2" fill={C.wood} />
      <rect x="34" y="144" width="8" height="36" fill={C.woodDark} />
      <rect x="186" y="144" width="8" height="36" fill={C.woodDark} />
      <rect x="60" y="116" width="40" height="16" rx="3" fill="#c4553a" />
      <rect x="110" y="122" width="54" height="10" rx="2" fill="#6f7c80" />
    </Frame>
  );
}

function Shed({ className, title }: ArtProps) {
  const id = useId().replace(/:/g, "");
  return (
    <Frame id={id} bg={["#e6efe0", "#d3e2c9"]} className={className} title={title}>
      <rect width="320" height="220" fill={`url(#${id}-glow)`} />
      <rect x="0" y="170" width="320" height="50" fill="#9fbf7f" />
      <rect x="0" y="170" width="320" height="4" fill="#86a868" />
      <Shadow cx={160} y={178} rx={100} />
      {/* shed */}
      <path d="M70 92 L160 38 L250 92 Z" fill="#5e3b26" />
      <rect x="84" y="88" width="152" height="88" fill="#b07a4a" />
      {Array.from({ length: 9 }).map((_, i) => (
        <rect key={i} x={84 + i * 17} y="88" width="2" height="88" fill="#8f5f37" opacity="0.6" />
      ))}
      <rect x="138" y="110" width="44" height="66" rx="2" fill="#6e4629" />
      <path d="M138 110 L118 116 L118 182 L138 176 Z" fill="#8a5a33" />
      <rect x="142" y="114" width="36" height="62" fill="#3b2a1d" />
      <path d="M150 130 v42 M160 126 v46 M170 134 v38" stroke={C.steel} strokeWidth="3" strokeLinecap="round" />
      <rect x="196" y="104" width="28" height="22" rx="2" fill="#fff4d2" />
      <path d="M210 104v22M196 115h28" stroke="#6e4629" strokeWidth="3" />
      {/* plants */}
      <circle cx="58" cy="164" r="18" fill={C.leaf} />
      <circle cx="40" cy="170" r="12" fill={C.leafLight} />
      <circle cx="270" cy="162" r="20" fill={C.leaf} />
      <circle cx="292" cy="170" r="12" fill={C.leafLight} />
      <circle cx="262" cy="150" r="4" fill={C.gold} />
      <circle cx="52" cy="152" r="4" fill="#e78b6a" />
    </Frame>
  );
}

function Wardrobe({ className, title }: ArtProps) {
  const id = useId().replace(/:/g, "");
  const coat = (x: number, c: string, h: number) => (
    <g key={x}>
      <path d={`M${x + 14} 52 l-4 -6`} stroke="#7d6a55" strokeWidth="2" />
      <path d={`M${x} 60 Q${x + 14} 50 ${x + 28} 60 L${x + 30} ${60 + h} L${x - 2} ${60 + h} Z`} fill={c} />
      <path d={`M${x + 14} 56 L${x + 14} ${60 + h}`} stroke="#000" strokeOpacity="0.12" strokeWidth="2" />
    </g>
  );
  return (
    <Frame id={id} bg={["#efe4d2", "#e2d2b8"]} className={className} title={title}>
      <Floor y={190} />
      <rect x="40" y="18" width="240" height="174" rx="6" fill="#7a4e2e" />
      <rect x="50" y="26" width="220" height="158" fill="#f3e7d2" />
      <rect width="320" height="220" fill={`url(#${id}-glow)`} opacity="0.7" />
      <rect x="50" y="44" width="220" height="5" rx="2" fill="#9a8466" />
      {[coat(60, "#6b7f8e", 90), coat(92, "#c9a27a", 78), coat(124, C.forest, 96), coat(156, "#b9553e", 70), coat(188, "#e9dcc4", 84), coat(220, "#4d5b6a", 92)]}
      <rect x="62" y="164" width="34" height="18" rx="4" fill="#5b3a23" />
      <rect x="104" y="166" width="34" height="16" rx="4" fill="#8a5a33" />
      <rect x="200" y="158" width="58" height="24" rx="4" fill={C.gold} />
      {/* open doors */}
      <path d="M50 26 L24 18 L24 196 L50 184 Z" fill="#8a5a33" />
      <path d="M270 26 L296 18 L296 196 L270 184 Z" fill="#8a5a33" />
    </Frame>
  );
}

function Garden({ className, title }: ArtProps) {
  const id = useId().replace(/:/g, "");
  const plant = (x: number, y: number, s = 1, flower?: string) => (
    <g key={`${x}-${y}`} transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M0 0 C-10 -14 -14 -26 -6 -32 C-2 -20 0 -10 0 0" fill={C.leaf} />
      <path d="M0 0 C10 -14 14 -26 6 -32 C2 -20 0 -10 0 0" fill={C.leafLight} />
      {flower ? (
        <>
          <path d="M0 0 V-44" stroke={C.leaf} strokeWidth="2.5" />
          <circle cx="0" cy="-48" r="7" fill={flower} />
        </>
      ) : null}
    </g>
  );
  return (
    <Frame id={id} bg={["#e3eedc", "#c8dcbb"]} className={className} title={title}>
      <rect width="320" height="220" fill={`url(#${id}-glow)`} />
      {/* hedge */}
      <rect x="0" y="70" width="320" height="50" fill="#5d8d5c" />
      {Array.from({ length: 12 }).map((_, i) => (
        <circle key={i} cx={i * 30} cy="74" r="20" fill="#5d8d5c" />
      ))}
      <rect x="0" y="118" width="320" height="102" fill="#a7c58b" />
      <Shadow cx={160} y={192} rx={130} />
      {/* raised bed */}
      <path d="M36 132 L284 132 L300 186 L20 186 Z" fill={C.soil} />
      <path d="M44 138 L276 138 L288 178 L32 178 Z" fill={C.soilDark} />
      <rect x="20" y="180" width="280" height="16" rx="2" fill={C.wood} />
      <rect x="20" y="180" width="280" height="4" fill={C.woodLight} />
      <path d="M36 132 L20 186" stroke={C.woodDark} strokeWidth="6" />
      <path d="M284 132 L300 186" stroke={C.woodDark} strokeWidth="6" />
      {[plant(70, 166, 1.1, "#9b6fc7"), plant(104, 160, 0.9), plant(136, 168, 1.15, "#e9748a"), plant(170, 158, 0.9), plant(204, 166, 1.1, C.gold), plant(238, 160, 0.95), plant(262, 170, 1.05, "#9b6fc7")]}
      {/* allium heads */}
      <path d="M86 150 V96" stroke={C.leaf} strokeWidth="2.5" />
      <circle cx="86" cy="92" r="11" fill="#a983d4" />
      <path d="M226 152 V102" stroke={C.leaf} strokeWidth="2.5" />
      <circle cx="226" cy="98" r="10" fill="#a983d4" />
    </Frame>
  );
}

function Box({ className, title }: ArtProps) {
  const id = useId().replace(/:/g, "");
  return (
    <Frame id={id} bg={["#f1e7d6", "#e2d3b9"]} className={className} title={title}>
      <rect width="320" height="220" fill={`url(#${id}-glow)`} />
      <Floor y={176} />
      <Shadow cx={160} y={180} rx={96} />
      {/* open box */}
      <path d="M86 96 L160 72 L234 96 L160 120 Z" fill="#a8763f" />
      <path d="M86 96 L160 120 L160 182 L86 160 Z" fill="#d6a86b" />
      <path d="M234 96 L160 120 L160 182 L234 160 Z" fill="#c4935a" />
      {/* flaps */}
      <path d="M86 96 L52 82 L124 60 L160 72 Z" fill="#e2b97f" />
      <path d="M234 96 L270 80 L198 58 L160 72 Z" fill="#d9ad72" />
      {/* contents peeking */}
      <circle cx="140" cy="92" r="10" fill={C.gold} />
      <circle cx="166" cy="86" r="9" fill="#c4553a" />
      <rect x="176" y="80" width="22" height="16" rx="3" fill={C.leaf} transform="rotate(-12 187 88)" />
      <path d="M160 120 L160 182" stroke="#b98352" strokeWidth="2" />
      <rect x="106" y="132" width="34" height="18" rx="2" fill={C.cream} transform="rotate(16 123 141)" />
    </Frame>
  );
}

function Other({ className, title }: ArtProps) {
  const id = useId().replace(/:/g, "");
  return (
    <Frame id={id} bg={["#f2ebdd", "#e4d8c3"]} className={className} title={title}>
      <rect width="320" height="220" fill={`url(#${id}-glow)`} />
      <Floor y={180} />
      {/* open door with warm light: the brand idea */}
      <rect x="110" y="34" width="100" height="148" rx="4" fill={C.forest} />
      <rect x="118" y="42" width="84" height="140" fill="#fff1c8" />
      <path d="M118 182 L70 220 L250 220 L202 182 Z" fill="#fff1c8" opacity="0.45" />
      <path d="M118 42 L86 30 L86 196 L118 182 Z" fill="#245a46" />
      <circle cx="94" cy="114" r="3.5" fill={C.gold} />
      <rect x="132" y="128" width="30" height="24" rx="2" fill="#d6a86b" />
      <rect x="160" y="140" width="28" height="12" rx="2" fill="#c4935a" />
      <rect x="132" y="152" width="56" height="30" rx="2" fill="#b98352" />
      <circle cx="160" cy="80" r="10" fill={C.gold} opacity="0.85" />
      <path d="M160 64 v-10 M176 80 h10 M144 80 h-10 M171 69 l7 -7 M149 69 l-7 -7" stroke={C.goldDeep} strokeWidth="3" strokeLinecap="round" />
    </Frame>
  );
}

function Bookshelf({ className, title }: ArtProps) {
  const id = useId().replace(/:/g, "");
  const spines = ["#7a3b2e", C.forest, "#c9a27a", "#4d5b6a", "#b9553e", C.gold, "#6b7f8e", "#8a5a33", "#e9dcc4", "#3e7a57", "#a8763f", "#5d4a85"];
  const shelf = (y: number, seed: number) => {
    let x = 66;
    const out: React.ReactNode[] = [];
    for (let i = 0; x < 248; i++) {
      const w = 9 + ((i * 7 + seed) % 4) * 3;
      const h = 34 + ((i * 5 + seed) % 3) * 5;
      const lean = i === 4 + (seed % 3);
      out.push(<rect key={`${y}-${i}`} x={x} y={y - h} width={w} height={h} rx="1.5" fill={spines[(i + seed) % spines.length]} transform={lean ? `rotate(8 ${x + w} ${y})` : undefined} />);
      x += w + (lean ? 8 : 1.5);
    }
    return out;
  };
  return (
    <Frame id={id} bg={["#efe4d2", "#e2d2b8"]} className={className} title={title}>
      <Floor y={194} />
      <rect x="54" y="14" width="212" height="182" rx="4" fill="#7a4e2e" />
      <rect x="62" y="20" width="196" height="170" fill="#5b3a23" />
      <rect width="320" height="220" fill={`url(#${id}-glow)`} opacity="0.75" />
      {shelf(70, 0)}
      {shelf(126, 2)}
      {shelf(182, 1)}
      <rect x="62" y="70" width="196" height="6" fill={C.woodLight} />
      <rect x="62" y="126" width="196" height="6" fill={C.woodLight} />
      <rect x="62" y="182" width="196" height="8" fill={C.woodLight} />
      <path d="M232 52 q8 -14 16 0 v18 h-16z" fill={C.leafLight} />
    </Frame>
  );
}

function ToyBox({ className, title }: ArtProps) {
  const id = useId().replace(/:/g, "");
  return (
    <Frame id={id} bg={["#f3e9d8", "#e6d6bc"]} className={className} title={title}>
      <rect width="320" height="220" fill={`url(#${id}-glow)`} />
      <Floor y={178} />
      <Shadow cx={160} y={184} rx={104} />
      {/* toys poking out */}
      <circle cx="122" cy="84" r="20" fill="#c4553a" />
      <path d="M104 78 q18 -10 36 0" stroke={C.cream} strokeWidth="4" fill="none" />
      <rect x="150" y="62" width="26" height="26" rx="3" fill={C.gold} />
      <rect x="176" y="72" width="26" height="26" rx="3" fill="#4d7fa3" transform="rotate(10 189 85)" />
      <circle cx="210" cy="68" r="11" fill="#c9a27a" />
      <circle cx="202" cy="58" r="5" fill="#c9a27a" />
      <circle cx="218" cy="58" r="5" fill="#c9a27a" />
      {/* box */}
      <rect x="70" y="96" width="180" height="84" rx="6" fill="#3e7a57" />
      <rect x="70" y="96" width="180" height="12" rx="4" fill="#2f6247" />
      <rect x="96" y="124" width="22" height="22" rx="3" fill={C.cream} />
      <rect x="128" y="124" width="22" height="22" rx="3" fill={C.gold} />
      <rect x="160" y="124" width="22" height="22" rx="3" fill="#c4553a" />
      <rect x="192" y="124" width="22" height="22" rx="3" fill={C.cream} />
      {/* lid leaning back */}
      <path d="M70 96 L58 44 L238 40 L250 96 Z" fill="#4a8a64" opacity="0.55" />
    </Frame>
  );
}

function Desk({ className, title }: ArtProps) {
  const id = useId().replace(/:/g, "");
  return (
    <Frame id={id} bg={["#ece6da", "#dcd2c0"]} className={className} title={title}>
      <rect width="320" height="220" fill={`url(#${id}-glow)`} />
      <Floor y={186} />
      {/* window light */}
      <rect x="196" y="18" width="84" height="70" rx="4" fill="#fff6dc" opacity="0.8" />
      <path d="M238 18 v70 M196 53 h84" stroke={C.wallShade} strokeWidth="4" />
      {/* lamp */}
      <path d="M86 112 l14 -38 l20 4" stroke={C.ink} strokeWidth="4" fill="none" strokeLinecap="round" />
      <path d="M110 70 l26 6 l-6 18 z" fill={C.goldDeep} />
      <rect x="76" y="110" width="22" height="6" rx="2" fill={C.ink} />
      {/* desk */}
      <rect x="44" y="116" width="232" height="10" rx="2" fill={C.wood} />
      <rect x="52" y="126" width="10" height="62" fill={C.woodDark} />
      <rect x="196" y="126" width="72" height="62" rx="2" fill={C.woodDark} />
      <rect x="202" y="134" width="60" height="22" rx="2" fill={C.wood} />
      <rect x="202" y="160" width="60" height="22" rx="2" fill={C.wood} />
      <rect x="226" y="143" width="12" height="3" rx="1.5" fill={C.gold} />
      <rect x="226" y="169" width="12" height="3" rx="1.5" fill={C.gold} />
      {/* things on top */}
      <rect x="128" y="88" width="56" height="28" rx="2" fill={C.cream} transform="rotate(-6 156 102)" />
      <rect x="196" y="96" width="14" height="20" rx="2" fill={C.forest} />
      <path d="M199 96 l-3 -12 M203 96 l1 -14 M207 96 l5 -10" stroke={C.goldDeep} strokeWidth="2.5" strokeLinecap="round" />
      <rect x="222" y="100" width="40" height="16" rx="2" fill="#c4553a" />
      <rect x="226" y="92" width="34" height="8" rx="2" fill="#6b7f8e" />
    </Frame>
  );
}

function Medicine({ className, title }: ArtProps) {
  const id = useId().replace(/:/g, "");
  const bottle = (x: number, y: number, h: number, c: string) => (
    <g key={`${x}-${y}`}>
      <rect x={x} y={y - h} width="18" height={h} rx="3" fill={c} />
      <rect x={x + 2} y={y - h - 6} width="14" height="7" rx="2" fill={C.cream} />
      <rect x={x + 3} y={y - h + 8} width="12" height="10" rx="1" fill={C.cream} opacity="0.85" />
    </g>
  );
  return (
    <Frame id={id} bg={["#e8eeee", "#d6e0df"]} className={className} title={title}>
      <rect width="320" height="220" fill={`url(#${id}-glow)`} />
      <rect x="70" y="16" width="180" height="176" rx="6" fill={C.cream} />
      <rect x="78" y="24" width="164" height="160" rx="3" fill="#f1f5f4" />
      <rect x="78" y="82" width="164" height="5" fill={C.frostDeep} />
      <rect x="78" y="140" width="164" height="5" fill={C.frostDeep} />
      {[bottle(92, 82, 30, "#c98a14"), bottle(116, 82, 38, "#b9553e"), bottle(140, 82, 26, "#4d7fa3")]}
      <rect x="170" y="56" width="56" height="26" rx="3" fill={C.cream} stroke={C.frostDeep} strokeWidth="2" />
      <path d="M182 69 h32" stroke="#4d7fa3" strokeWidth="3" />
      {[bottle(96, 140, 34, C.forest), bottle(124, 140, 28, "#c4553a")]}
      <rect x="160" y="110" width="66" height="30" rx="4" fill="#3e7a57" />
      <path d="M193 116 v18 M184 125 h18" stroke={C.cream} strokeWidth="5" strokeLinecap="round" />
      <rect x="96" y="160" width="56" height="20" rx="4" fill="#e9dcc4" />
      <rect x="164" y="154" width="22" height="26" rx="3" fill="#6b7f8e" />
      {/* mirror door swung open */}
      <path d="M250 16 L292 8 L292 200 L250 192 Z" fill="#c6d8dc" />
      <path d="M258 30 L284 26 L284 70 Z" fill="#ffffff" opacity="0.5" />
    </Frame>
  );
}

function Car({ className, title }: ArtProps) {
  const id = useId().replace(/:/g, "");
  return (
    <Frame id={id} bg={["#dfe9df", "#e9e1cf"]} className={className} title={title}>
      <rect width="320" height="220" fill={`url(#${id}-glow)`} />
      <Floor y={170} color="#c9c2b4" />
      <Shadow cx={160} y={182} rx={128} />
      {/* car from behind, boot open */}
      <path d="M48 168 V120 q0 -12 12 -16 l28 -8 h144 l28 8 q12 4 12 16 v48 z" fill="#4d7fa3" />
      <rect x="62" y="110" width="196" height="54" rx="4" fill="#2f3e48" />
      <rect x="70" y="118" width="180" height="40" rx="2" fill="#e9dcc4" />
      {/* boot contents */}
      <rect x="80" y="124" width="54" height="34" rx="3" fill={C.wood} />
      <rect x="140" y="132" width="40" height="26" rx="3" fill={C.forest} />
      <rect x="186" y="128" width="20" height="30" rx="3" fill={C.gold} />
      <path d="M212 158 l14 -30 l10 4 l-10 26 z" fill="#c4553a" />
      {/* open boot lid */}
      <path d="M64 96 L84 40 H236 L256 96 Z" fill="#5c8fb3" />
      <path d="M96 50 H224 L238 88 H82 Z" fill="#cfe0ea" opacity="0.8" />
      {/* bumper, lights, wheels */}
      <rect x="44" y="164" width="232" height="10" rx="4" fill="#2f3e48" />
      <rect x="50" y="122" width="10" height="20" rx="3" fill="#c4553a" />
      <rect x="260" y="122" width="10" height="20" rx="3" fill="#c4553a" />
      <rect x="60" y="174" width="30" height="12" rx="3" fill={C.ink} />
      <rect x="230" y="174" width="30" height="12" rx="3" fill={C.ink} />
    </Frame>
  );
}

const ART: Record<LocationType, (p: ArtProps) => React.ReactNode> = {
  freezer: Freezer,
  fridge: Fridge,
  pantry: Pantry,
  cupboard: Cupboard,
  wine: Wine,
  attic: Attic,
  garage: Garage,
  shed: Shed,
  wardrobe: Wardrobe,
  garden: Garden,
  box: Box,
  bookshelf: Bookshelf,
  toybox: ToyBox,
  desk: Desk,
  medicine: Medicine,
  car: Car,
  other: Other,
};

export function PlaceArt({ type, className = "", title }: { type: LocationType; className?: string; title?: string }) {
  const Art = ART[type] ?? Other;
  return <Art className={`block h-full w-full ${className}`} title={title} />;
}
