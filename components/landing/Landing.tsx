import Link from "next/link";
import { BrandMark, Wordmark } from "@/components/brand/BrandMark";
import { PlaceArt } from "@/components/art/PlaceArt";
import { IconCheck, IconPeople, IconSearch, IconUndo } from "@/components/ui/icons";
import type { LocationType } from "@/lib/household";

const EXAMPLES = [
  { title: "Household storage", text: "Freezers, cupboards, the attic, the garage." },
  { title: "Garden and growing", text: "Raised beds, pots, the shed and what's in them." },
  { title: "Clothes and equipment", text: "Wardrobes, kit bags, tools and spares." },
  { title: "Anything else", text: "Name any place you keep things and it works the same way." },
];

const MOSAIC: { type: LocationType; name: string; count: string }[] = [
  { type: "freezer", name: "Garage Freezer", count: "14 things" },
  { type: "attic", name: "Attic", count: "38 things" },
  { type: "garden", name: "Raised Bed 1", count: "6 things" },
  { type: "wardrobe", name: "Hall Wardrobe", count: "22 things" },
];

/** Public front page for signed-out web visitors. The native apps skip straight to sign-in. */
export function Landing() {
  return (
    <div className="min-h-dvh bg-bg">
      <section className="relative overflow-hidden bg-brand text-[#fffdf8]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-48 -right-40 size-[680px] rounded-full bg-[radial-gradient(circle,rgba(246,198,91,0.18),transparent_62%)]"
        />
        <div className="relative mx-auto flex max-w-6xl flex-col gap-10 px-5 pt-[max(20px,env(safe-area-inset-top))] pb-14 lg:flex-row lg:items-center lg:gap-16 lg:pb-24">
          <div className="flex flex-1 flex-col gap-7">
            <header className="flex items-center justify-between">
              <span className="flex items-center gap-2.5">
                <BrandMark size={36} className="ring-1 ring-white/15" />
                <Wordmark className="text-[1.15rem]" />
              </span>
              <Link href="/sign-in/" className="rounded-full border border-white/25 px-4 py-1.5 text-sm font-semibold hover:bg-white/10">
                Sign in
              </Link>
            </header>
            <h1 className="rise mt-6 font-serif text-[clamp(2.9rem,10vw,5.2rem)] leading-[0.98] font-semibold tracking-[-0.02em] text-balance">
              See What&apos;s In Here
            </h1>
            <p className="rise max-w-[40ch] text-lg leading-relaxed text-[#fffdf8]/80 sm:text-xl" style={{ animationDelay: "60ms" }}>
              Keep track of everything you have, wherever you store it.
            </p>
            <div className="rise flex flex-col gap-3 sm:flex-row" style={{ animationDelay: "120ms" }}>
              <Link
                href="/sign-in/"
                className="lift inline-flex min-h-14 items-center justify-center rounded-[var(--radius-btn)] bg-tape px-7 font-display text-[17px] font-bold text-on-tape"
              >
                Get started
              </Link>
              <Link
                href="/sign-in/"
                className="inline-flex min-h-14 items-center justify-center rounded-[var(--radius-btn)] border border-white/25 px-6 font-display text-[17px] font-semibold hover:bg-white/10"
              >
                I already have an account
              </Link>
            </div>
          </div>

          <ul className="grid flex-1 grid-cols-2 gap-3 sm:gap-4" aria-label="Example places">
            {MOSAIC.map((m, i) => (
              <li
                key={m.type}
                className={`rise overflow-hidden rounded-[var(--radius-card)] bg-card text-fg shadow-[0_24px_48px_-28px_rgba(0,0,0,0.6)] ${i % 2 ? "translate-y-5" : ""}`}
                style={{ animationDelay: `${160 + i * 70}ms` }}
              >
                <div className="aspect-[16/11]">
                  <PlaceArt type={m.type} />
                </div>
                <div className="px-3.5 pt-2.5 pb-3">
                  <p className="truncate font-display text-[15px] font-bold">{m.name}</p>
                  <p className="text-[12.5px] text-mute">{m.count}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-14 lg:py-20">
        <h2 className="max-w-2xl font-display text-[clamp(1.9rem,5vw,2.8rem)] leading-tight font-extrabold tracking-[-0.025em] text-balance">
          One place for everything you keep
        </h2>
        <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {EXAMPLES.map((e) => (
            <li key={e.title} className="flex gap-3 rounded-[var(--radius-card)] border border-line bg-card p-5 shadow-[var(--shadow-card)]">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-tape text-on-tape" aria-hidden="true">
                <IconCheck className="size-4" />
              </span>
              <span>
                <span className="block font-display text-[17px] font-bold">{e.title}</span>
                <span className="mt-1 block text-[15px] text-mute">{e.text}</span>
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-14 grid gap-4 md:grid-cols-3">
          {[
            { t: "Find anything", d: "Search every place at once. Each result tells you exactly where it is.", Icon: IconSearch },
            { t: "Share with your household", d: "Invite the people you live with. Everyone sees the same list, updated live.", Icon: IconPeople },
            { t: "Mistakes are easy to fix", d: "Took out the wrong thing? Undo it straight away. Nothing is lost.", Icon: IconUndo },
          ].map(({ t, d, Icon }) => (
            <div key={t} className="flex flex-col gap-3 rounded-[var(--radius-card)] bg-sunk/60 p-6">
              <span className="grid size-11 place-items-center rounded-2xl bg-card text-leaf shadow-[var(--shadow-card)]">
                <Icon className="size-5" />
              </span>
              <h3 className="font-display text-xl font-bold">{t}</h3>
              <p className="text-mute">{d}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 border-t border-line px-5 pt-8 pb-[max(32px,env(safe-area-inset-bottom))] text-sm text-mute">
        <span className="flex items-center gap-2">
          <BrandMark size={22} /> Your household&apos;s list is private to the people you invite.
        </span>
        <a href="https://www.findthecool.com" className="font-semibold text-fg hover:underline">
          A FindTheCool project
        </a>
      </footer>
    </div>
  );
}
