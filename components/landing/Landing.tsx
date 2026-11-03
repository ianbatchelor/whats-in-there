import Link from "next/link";
import { BrandMark, Wordmark } from "@/components/brand/BrandMark";
import { IconCamera, IconPeople } from "@/components/ui/icons";

/** Public front page for signed-out web visitors. The native apps skip straight to sign-in. */
export function Landing() {
  return (
    <div className="min-h-dvh bg-bg">
      <section className="relative overflow-hidden bg-[#0b1f26] text-[#eaf2f3]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-40 -right-40 size-[640px] rounded-full bg-[radial-gradient(circle,rgba(120,190,200,0.22),transparent_62%)]"
        />
        <div className="relative mx-auto flex max-w-5xl flex-col gap-12 px-[max(16px,env(safe-area-inset-left))] pt-[max(20px,env(safe-area-inset-top))] pb-16 md:flex-row md:items-center md:gap-16 md:pb-24">
          <div className="flex flex-1 flex-col gap-7">
            <header className="flex items-center justify-between">
              <span className="flex items-center gap-2.5">
                <BrandMark size={34} />
                <Wordmark className="text-lg text-[#eaf2f3]" />
              </span>
              <Link href="/sign-in/" className="rounded-full border border-white/25 px-4 py-1.5 text-sm font-bold hover:bg-white/10">
                Sign in
              </Link>
            </header>
            <p className="mt-6 font-mono text-[11px] tracking-[0.12em] text-[#9db5ba] uppercase">Household food inventory</p>
            <h1 className="font-display text-[clamp(2.7rem,9vw,4.8rem)] leading-[0.95] font-extrabold tracking-[-0.035em] text-balance">
              Tap the freezer. <span className="tape relative z-0 mx-[-0.04em] inline-block -rotate-[1.6deg] px-[0.14em] pb-[0.06em]">Snap</span> the
              food. Done.
            </h1>
            <p className="max-w-[52ch] text-lg leading-relaxed text-[#9db5ba]">
              Know what&apos;s in every freezer, fridge and cupboard without opening a single door. Shared with everyone at home, updated the
              moment something goes in or comes out.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/sign-in/" className="inline-flex min-h-12 items-center rounded-2xl bg-[#2ba68a] px-6 font-display text-base font-bold text-[#06231c]">
                Get started free
              </Link>
              <a href="#how" className="inline-flex min-h-12 items-center rounded-2xl px-4 font-display text-base font-bold text-[#eaf2f3]">
                How it works
              </a>
            </div>
          </div>

          <div className="mx-auto w-full max-w-[300px] shrink-0 md:mx-0" aria-hidden="true">
            <div className="rounded-[44px] bg-gradient-to-br from-[#2a3a3f] via-[#0a1316] to-[#25353a] p-2.5 shadow-[0_30px_60px_-28px_rgba(0,0,0,0.7)]">
              <div className="flex flex-col gap-3 overflow-hidden rounded-[36px] bg-[#eef4f5] px-4 pt-10 pb-5 text-[#0f2a33]">
                <p className="text-xs font-bold text-[#0f7b66]">‹ Home</p>
                <p className="font-display text-[26px] leading-none font-extrabold tracking-tight">Garage Freezer</p>
                <p className="text-[11px] text-[#5a7178]">Chest freezer · 14 items</p>
                <ul className="overflow-hidden rounded-2xl border border-[#dfe8ea] bg-white text-[13px]">
                  {[
                    ["Leg of lamb", "Frozen 03 Nov", "1", "1.8 kg", false],
                    ["Chicken breasts", "Frozen 21 Oct", "4", "pieces", false],
                    ["Homemade lasagne", "Frozen 12 Sep", "3", "portions", false],
                    ["Beef mince", "Frozen 14 Apr", "1", "500 g", true],
                  ].map(([name, date, qty, unit, old]) => (
                    <li key={name as string} className="flex items-center justify-between border-t border-[#dfe8ea] px-3 py-2.5 first:border-t-0">
                      <span>
                        <b className="block">{name}</b>
                        <span className={`font-mono text-[10.5px] ${old ? "text-[#b8452a]" : "text-[#5a7178]"}`}>{date}</span>
                      </span>
                      <span className="text-right">
                        <b className="block font-display text-lg leading-none">{qty}</b>
                        <span className="text-[10.5px] text-[#5a7178]">{unit}</span>
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="grid grid-cols-[1.25fr_1fr] gap-2">
                  <span className="rounded-2xl bg-[#0f7b66] py-3 text-center font-display text-sm font-bold text-white">Add Food</span>
                  <span className="rounded-2xl bg-white py-3 text-center font-display text-sm font-bold ring-[1.5px] ring-[#0f2a33] ring-inset">Take Out</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="how" className="mx-auto max-w-5xl px-[max(16px,env(safe-area-inset-left))] py-16 md:py-24">
        <h2 className="max-w-2xl font-display text-[clamp(2rem,5vw,3rem)] leading-none font-extrabold tracking-[-0.025em] text-balance">
          Three steps, no typing
        </h2>
        <ol className="mt-10 grid gap-4 md:grid-cols-3">
          {[
            { n: "1", t: "Tap the sticker", d: "An NFC sticker on each freezer opens exactly that freezer. No sticker? Every place is one tap from home.", icon: <svg viewBox="0 0 24 24" className="size-6 fill-none stroke-current" strokeWidth={1.8} strokeLinecap="round"><path d="M8 7.5a6 6 0 0 1 0 9M11.5 5a9.5 9.5 0 0 1 0 14M15 3a12.5 12.5 0 0 1 0 18" /><circle cx="4.5" cy="12" r="1.2" /></svg> },
            { n: "2", t: "Snap the label", d: "We read the name, weight and dates for you to check. Anything we can't read stays blank, never guessed.", icon: <IconCamera className="size-6" /> },
            { n: "3", t: "Share the list", d: "Everyone at home sees the same shelves, live. Check the garage freezer from the sofa or the supermarket.", icon: <IconPeople className="size-6" /> },
          ].map((s) => (
            <li key={s.n} className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-line bg-card p-6">
              <span className="flex items-center gap-3">
                <span className="grid size-11 place-items-center rounded-xl bg-ice">{s.icon}</span>
                <span className="font-mono text-xs text-mute">Step {s.n}</span>
              </span>
              <h3 className="font-display text-xl font-bold">{s.t}</h3>
              <p className="text-mute">{s.d}</p>
            </li>
          ))}
        </ol>
      </section>

      <footer className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 border-t border-line px-[max(16px,env(safe-area-inset-left))] pt-8 pb-[max(32px,env(safe-area-inset-bottom))] text-sm text-mute">
        <span className="flex items-center gap-2">
          <BrandMark size={22} /> Your household&apos;s list is private to the people you invite.
        </span>
        <a href="https://www.findthecool.com" className="font-bold text-fg hover:underline">
          A FindTheCool project
        </a>
      </footer>
    </div>
  );
}
