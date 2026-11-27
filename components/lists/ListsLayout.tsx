import Link from "next/link";
import { IconChevronRight } from "@/components/ui/icons";
import { countdown } from "@/lib/domain/christmas";

/**
 * Pieces of the Lists page: the Christmas feature, the Shopping row, the household cards and the
 * rows for your own lists. The artwork is decoration: every word and count is real text beside it.
 */

/** The artwork's resting place: a fixed box so nothing moves when it loads. */
function Art({ src, className }: { src: string; className: string }) {
  return (
    // Static export: plain img, pre-sized webp files.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" aria-hidden="true" width={192} height={192} decoding="async" className={`shrink-0 object-contain ${className}`} />
  );
}

/** November to Boxing Day: a shallow full-width picture card that opens the Christmas page. */
export function ChristmasFeature({ days }: { days: number }) {
  return (
    <Link
      href="/christmas/"
      className="group relative isolate flex min-h-[120px] items-center overflow-hidden rounded-[var(--radius-card)] bg-[#18382b] shadow-[var(--shadow-card)] sm:min-h-[136px]"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/lists/christmas-hero.webp"
        alt=""
        aria-hidden="true"
        width={1200}
        height={675}
        decoding="async"
        className="absolute inset-0 -z-10 size-full object-cover object-[right_62%] transition duration-500 group-hover:scale-[1.02]"
      />
      {/* Keeps the cream text clear of the fir and the fairy lights on narrow phones. */}
      <span aria-hidden="true" className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(16,36,27,0.82)_0%,rgba(16,36,27,0.55)_42%,rgba(16,36,27,0)_68%)]" />
      <span className="flex max-w-[60%] flex-col gap-1 px-5 py-4">
        <span className="font-serif text-[1.75rem] leading-none font-semibold tracking-[-0.01em] text-[#fbf6ea]">Christmas</span>
        <span className="text-[14px] leading-snug font-semibold text-gold">{days === 1 ? "Tomorrow" : countdown(days)}</span>
      </span>
    </Link>
  );
}

/** Shopping: one compact sage row, always easy to find. */
export function ShoppingRow({ count }: { count: number | null }) {
  const status = count === null ? " " : count === 0 ? "Nothing to buy" : `${count} to buy`;
  return (
    <Link href="/list/" className="flex min-h-16 items-center gap-3 rounded-[var(--radius-card)] bg-sage py-2 pr-3.5 pl-3 transition hover:brightness-[0.98]">
      <Art src="/lists/shopping-basket.webp" className="size-12" />
      <span className="flex min-w-0 flex-1 flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <span className="font-display text-[16.5px] leading-snug font-bold text-fg">Shopping list</span>
        <span className="text-[14px] leading-snug font-semibold text-forest/80 tabular-nums">{status}</span>
      </span>
      <IconChevronRight className="size-5 shrink-0 text-forest/60" />
    </Link>
  );
}

export type HouseholdCardData = {
  href: string;
  title: string;
  art: string;
  /** Tailwind background class for the card's tint. */
  tint: string;
  /** What's on it, in a few words. Null while loading. */
  caption: string | null;
  n: number | null;
  /** Something wants doing: the count and caption show in the late colour. */
  urgent?: boolean;
};

/** Present ideas, books, lent out and the season's jobs: tinted cards in a grid that drops to one column when text is large. */
export function HouseholdCards({ cards, label }: { cards: HouseholdCardData[]; label: string }) {
  return (
    <section aria-label={label}>
      <ul className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,max(8.5rem,calc((100%-30px)/4))),1fr))] gap-2.5">
        {cards.map((c) => (
          <li key={c.href}>
            <Link href={c.href} className={`relative flex h-full min-h-[108px] flex-col rounded-[var(--radius-card)] p-3.5 transition hover:brightness-[0.98] ${c.tint}`}>
              <Art src={c.art} className="absolute top-2.5 right-2.5 size-11" />
              {/* The title keeps clear of the picture and wraps under its own steam. */}
              <span className="min-h-10 pr-12 font-display text-[15px] leading-snug font-bold text-fg">{c.title}</span>
              <span className="mt-auto flex items-end gap-2 pt-1">
                <span className={`line-clamp-2 min-w-0 flex-1 text-[13px] leading-snug ${c.urgent ? "text-late" : "text-fg/70"}`}>{c.caption ?? "\u00a0"}</span>
                {c.n !== null && c.n > 0 ? (
                  <span className={`shrink-0 font-display text-[1.3rem] leading-none font-bold tabular-nums ${c.urgent ? "text-late" : "text-forest"}`}>{c.n}</span>
                ) : null}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export type ListRowData = {
  href: string;
  Icon: (p: { className?: string }) => React.ReactNode;
  /** Background and colour for the icon's tile, by kind of list. */
  tone: string;
  title: string;
  caption: string;
  /** Things still open on it. */
  n: number;
};

const count = (n: number) => (n === 1 ? "1 item" : `${n} items`);

/** One group of your own lists ("Everyone at home", "Just you"...), with quiet counts. */
export function ListSection({ id, label, Icon, rows }: { id: string; label: string; Icon: (p: { className?: string }) => React.ReactNode; rows: ListRowData[] }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-2">
      <h3 id={id} className="flex items-center gap-1.5 font-display text-[12.5px] font-bold tracking-[0.06em] text-mute uppercase">
        <Icon className="size-4" /> {label}
      </h3>
      <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-card shadow-[var(--shadow-card)]">
        {rows.map((r) => (
          <li key={r.href}>
            <Link href={r.href} className="@container flex min-h-16 items-center gap-3 px-3.5 py-2.5 transition hover:bg-sunk/50">
              <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${r.tone}`} aria-hidden="true">
                <r.Icon className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-display text-[15.5px] leading-snug font-bold">{r.title}</span>
                <span className="block truncate text-[13.5px] text-mute">
                  {/* On a narrow row (or with big text) the count joins the caption, so the title keeps its room. */}
                  {r.n > 0 ? <span className="@[19rem]:hidden">{count(r.n)} · </span> : null}
                  {r.caption}
                </span>
              </span>
              {r.n > 0 ? <span className="hidden shrink-0 text-[13px] font-medium whitespace-nowrap text-mute tabular-nums @[19rem]:inline">{count(r.n)}</span> : null}
              <IconChevronRight className="size-5 shrink-0 text-mute/70" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
