import Link from "next/link";
import { LegalLinks } from "@/components/common/LegalLinks";
import { BrandMark, Wordmark } from "@/components/brand/BrandMark";
import { PlacePhoto } from "@/components/art/PlacePhoto";
import { IconPeople, IconSearch, IconUndo } from "@/components/ui/icons";
import type { LocationType } from "@/lib/household";

const EXAMPLES: { type: LocationType; title: string; text: string }[] = [
  { type: "freezer", title: "Household storage", text: "Freezers, cupboards, the attic, the garage." },
  { type: "garden", title: "Garden and growing", text: "Raised beds, pots, the shed and what's in them." },
  { type: "wardrobe", title: "Clothes and equipment", text: "Wardrobes, kit bags, tools and spares." },
  { type: "attic", title: "Anything else", text: "Name any place you keep things. It works the same way." },
];

/** Public front page for signed-out web visitors. The native apps skip straight to sign-in. */
export function Landing() {
  return (
    <div className="min-h-dvh bg-bg">
      <section className="relative isolate flex min-h-[100svh] flex-col overflow-hidden bg-[#0f1a14] text-[#fffdf8] lg:min-h-[88vh]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/places/welcome.webp"
          alt=""
          aria-hidden="true"
          className="reveal-img absolute inset-0 -z-10 h-full w-full object-cover object-[52%_50%] lg:left-auto lg:w-[62%]"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(12,20,15,0.6)_0%,rgba(12,20,15,0.05)_28%,rgba(12,20,15,0.35)_52%,rgba(12,20,15,0.97)_78%)] lg:bg-[linear-gradient(90deg,#0f1a14_38%,rgba(15,26,20,0.75)_52%,rgba(15,26,20,0.1)_75%)]"
        />
        <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 pt-[max(20px,env(safe-area-inset-top))] lg:pt-8">
          <span className="flex items-center gap-2.5">
            <BrandMark size={34} className="ring-1 ring-white/15" />
            <Wordmark serif className="text-[1.1rem]" />
          </span>
          <Link href="/sign-in/" className="rounded-full border border-white/25 bg-black/10 px-4 py-1.5 text-sm font-semibold backdrop-blur hover:bg-white/10">
            Sign in
          </Link>
        </header>
        <div className="mx-auto mt-auto flex w-full max-w-6xl flex-col px-6 pb-[max(36px,env(safe-area-inset-bottom))] lg:my-auto lg:pb-0">
          <div className="max-w-xl">
            <p className="rise text-[11.5px] font-semibold tracking-[0.18em] text-tape uppercase">For every place you keep things</p>
            <h1 className="rise mt-3 font-serif text-[clamp(3rem,12vw,5.6rem)] leading-[0.95] font-medium tracking-[-0.02em]" style={{ animationDelay: "60ms" }}>
              See What&apos;s
              <br />
              <em className="font-normal">In Here</em>
            </h1>
            <p className="rise mt-5 max-w-[34ch] text-lg leading-relaxed text-[#fffdf8]/82 sm:text-xl" style={{ animationDelay: "120ms" }}>
              Keep track of everything you have, wherever you store it.
            </p>
            <div className="rise mt-8 flex flex-col gap-3 sm:flex-row sm:items-center" style={{ animationDelay: "180ms" }}>
              <Link
                href="/sign-in/"
                className="lift inline-flex min-h-14 items-center justify-center rounded-[var(--radius-btn)] bg-tape px-8 font-display text-[17px] font-bold text-on-tape"
              >
                Get started
              </Link>
              <Link href="/sign-in/" className="inline-flex min-h-12 items-center justify-center px-4 font-display text-[16px] font-semibold text-[#fffdf8]/90 hover:text-white">
                I already have an account
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16 lg:py-24">
        <p className="text-[11.5px] font-semibold tracking-[0.18em] text-leaf uppercase">Not just the freezer</p>
        <h2 className="mt-2 max-w-2xl font-serif text-[clamp(2rem,5vw,3.2rem)] leading-[1.05] font-medium tracking-[-0.02em] text-balance">
          One place to remember what&apos;s inside all of them
        </h2>
        <ul className="mt-10 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
          {EXAMPLES.map((e) => (
            <li key={e.title}>
              <div className="aspect-[4/5] overflow-hidden rounded-[20px] bg-sunk">
                <PlacePhoto type={e.type} />
              </div>
              <h3 className="mt-3 font-display text-[16px] font-bold sm:text-lg">{e.title}</h3>
              <p className="mt-0.5 text-[14px] text-mute sm:text-[15px]">{e.text}</p>
            </li>
          ))}
        </ul>

        <div className="mt-16 grid gap-8 border-t border-line pt-12 md:grid-cols-3">
          {[
            { t: "Find anything", d: "Search every place at once. Each result tells you exactly where it is.", Icon: IconSearch },
            { t: "Share with your household", d: "Invite the people you live with. Everyone sees the same list, updated live.", Icon: IconPeople },
            { t: "Mistakes are easy to fix", d: "Took out the wrong thing? Undo it straight away. Nothing is lost.", Icon: IconUndo },
          ].map(({ t, d, Icon }) => (
            <div key={t} className="flex gap-4">
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-sunk text-leaf">
                <Icon className="size-5" />
              </span>
              <div>
                <h3 className="font-display text-lg font-bold">{t}</h3>
                <p className="mt-1 text-mute">{d}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <footer className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 border-t border-line px-6 pt-8 pb-[max(32px,env(safe-area-inset-bottom))] text-sm text-mute">
        <span className="flex items-center gap-2">
          <BrandMark size={22} /> Your household&apos;s list is private to the people you invite.
        </span>
        <span className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <LegalLinks />
          <a href="https://www.findthecool.com" className="font-semibold text-fg hover:underline">
            A FindTheCool project
          </a>
        </span>
      </footer>
    </div>
  );
}
