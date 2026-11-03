import Link from "next/link";
import { BrandMark, Wordmark } from "@/components/brand/BrandMark";

/**
 * Frame for the signed-out and setup screens: a forest panel with the brand,
 * stacked on phones and side by side on wide screens.
 */
export function AuthFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-bg lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <aside className="relative isolate overflow-hidden bg-[#0f1a14] text-[#fffdf8]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/places/welcome.webp" alt="" aria-hidden="true" className="absolute inset-0 -z-10 h-full w-full object-cover object-[52%_50%] opacity-70 lg:opacity-100" />
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-b from-[#0f1a14]/70 via-[#0f1a14]/50 to-[#0f1a14]/95" />
        <div className="relative flex min-h-[38svh] flex-col justify-between gap-6 px-5 pt-[max(18px,env(safe-area-inset-top))] pb-6 lg:sticky lg:top-0 lg:h-dvh lg:justify-between lg:p-12">
          <Link href="/" className="flex w-fit items-center gap-2.5">
            <BrandMark size={34} className="ring-1 ring-white/15" />
            <Wordmark className="text-[1.15rem]" />
          </Link>
          <p className="font-serif text-[2.4rem] leading-[1] font-medium tracking-[-0.02em] lg:hidden">
            See what&apos;s <em className="font-normal">in here.</em>
          </p>
          <div className="hidden lg:block">
            <p className="max-w-[14ch] font-serif text-6xl leading-[1] font-medium tracking-[-0.02em]">
              See what&apos;s <em className="font-normal">in here.</em>
            </p>
            <p className="mt-4 max-w-sm text-lg text-[#fffdf8]/80">Keep track of everything you have, wherever you store it.</p>
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
