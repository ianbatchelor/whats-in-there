import Link from "next/link";
import { BrandMark, Wordmark } from "@/components/brand/BrandMark";
import { BackLink } from "@/components/common/BackLink";
import { LegalLinks } from "@/components/common/LegalLinks";

/** A plain reading page for Privacy, Terms and Help, on the website and inside the apps. */
export function DocPage({ title, updated, children }: { title: string; updated?: string; children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-bg">
      <header className="mx-auto flex max-w-2xl items-center justify-between gap-4 px-5 pt-[max(18px,env(safe-area-inset-top))] pb-4">
        <Link href="/" className="flex items-center gap-2.5">
          <BrandMark size={30} />
          <Wordmark className="text-[1.02rem]" />
        </Link>
        <BackLink />
      </header>
      <main className="mx-auto max-w-2xl px-5 pb-12">
        <h1 className="mt-4 font-display text-[2.1rem] leading-[1.05] font-bold tracking-[-0.03em]">{title}</h1>
        {updated ? <p className="mt-2 text-sm text-mute">Last updated {updated}</p> : null}
        <div className="doc mt-6 flex flex-col gap-4 leading-relaxed [&_a]:font-semibold [&_a]:underline [&_a]:underline-offset-4 [&_h2]:mt-4 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-bold [&_li]:mt-1 [&_ul]:list-disc [&_ul]:pl-5">
          {children}
        </div>
      </main>
      <footer className="mx-auto max-w-2xl border-t border-line px-5 pt-6 pb-[max(28px,env(safe-area-inset-bottom))]">
        <LegalLinks />
      </footer>
    </div>
  );
}
