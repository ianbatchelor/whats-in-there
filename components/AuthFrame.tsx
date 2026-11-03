import Link from "next/link";
import { BrandMark, Wordmark } from "@/components/brand/BrandMark";
import { PlaceArt } from "@/components/art/PlaceArt";
import type { LocationType } from "@/lib/household";

const ART: LocationType[] = ["attic", "garden", "freezer", "wardrobe"];

/**
 * Frame for the signed-out and setup screens: a forest panel with the brand,
 * stacked on phones and side by side on wide screens.
 */
export function AuthFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-bg lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <aside className="relative overflow-hidden bg-brand text-[#fffdf8]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-40 -right-40 size-[560px] rounded-full bg-[radial-gradient(circle,rgba(246,198,91,0.16),transparent_62%)]"
        />
        <div className="relative flex flex-col gap-6 px-5 pt-[max(18px,env(safe-area-inset-top))] pb-6 lg:sticky lg:top-0 lg:h-dvh lg:justify-between lg:p-12">
          <Link href="/" className="flex w-fit items-center gap-2.5">
            <BrandMark size={34} className="ring-1 ring-white/15" />
            <Wordmark className="text-[1.15rem]" />
          </Link>
          <div className="hidden flex-col gap-8 lg:flex">
            <p className="max-w-[16ch] font-serif text-5xl leading-[1.02] font-semibold tracking-[-0.02em]">Everything you have, wherever it is.</p>
            <ul className="grid max-w-md grid-cols-2 gap-3" aria-hidden="true">
              {ART.map((t, i) => (
                <li key={t} className={`overflow-hidden rounded-[var(--radius-card)] shadow-[0_20px_40px_-24px_rgba(0,0,0,0.6)] ${i % 2 ? "translate-y-4" : ""}`}>
                  <div className="aspect-[16/11]">
                    <PlaceArt type={t} />
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <p className="hidden text-sm text-[#fffdf8]/60 lg:block">Your household&apos;s list is private to the people you invite.</p>
        </div>
      </aside>
      <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-5 pt-8 pb-[max(28px,env(safe-area-inset-bottom))] lg:justify-center lg:py-16">
        {children}
      </main>
    </div>
  );
}
