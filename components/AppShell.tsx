"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandMark, Wordmark } from "@/components/brand/BrandMark";
import { IconActivity, IconHome, IconPeople, IconPlusCircle, IconSearch } from "@/components/ui/icons";

const NAV = [
  { href: "/", label: "Home", Icon: IconHome, match: (p: string) => p === "/" || p.startsWith("/place") },
  { href: "/search/", label: "Search", Icon: IconSearch, match: (p: string) => p.startsWith("/search") },
  { href: "/add/", label: "Add", Icon: IconPlusCircle, match: (p: string) => p.startsWith("/add") },
  { href: "/activity/", label: "Activity", Icon: IconActivity, match: (p: string) => p.startsWith("/activity") },
  { href: "/household/", label: "Household", Icon: IconPeople, match: (p: string) => p.startsWith("/household") },
];

/**
 * Frame for signed-in screens: bottom tabs on phones, a sidebar on wide screens.
 * Every tab is a real screen; nothing here is decoration.
 */
export function AppShell({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  const path = usePathname() || "/";
  return (
    <div className="min-h-dvh bg-bg lg:flex">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-8 border-r border-line bg-card/60 px-5 py-7 lg:flex">
        <Link href="/" className="flex items-center gap-2.5">
          <BrandMark size={36} />
          <Wordmark className="text-[1.15rem] leading-tight" />
        </Link>
        <nav aria-label="Main" className="flex flex-col gap-1">
          {NAV.map(({ href, label, Icon, match }) => {
            const active = match(path);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-11 items-center gap-3 rounded-xl px-3 font-display text-[15px] font-semibold transition ${
                  active ? "bg-go text-on-go" : "text-mute hover:bg-sunk hover:text-fg"
                }`}
              >
                <Icon className="size-5" />
                {label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <main
        className={`mx-auto flex w-full flex-col gap-6 px-4 pt-[max(16px,env(safe-area-inset-top))] pb-[calc(96px+env(safe-area-inset-bottom))] sm:px-6 lg:px-10 lg:pt-10 lg:pb-16 ${
          wide ? "max-w-6xl" : "max-w-3xl"
        }`}
      >
        {children}
      </main>

      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
      >
        <ul className="mx-auto grid max-w-lg grid-cols-5">
          {NAV.map(({ href, label, Icon, match }) => {
            const active = match(path);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-[60px] flex-col items-center justify-center gap-1 text-[11px] font-semibold ${active ? "text-go" : "text-mute"}`}
                >
                  <Icon className={`size-[22px] ${active ? "stroke-[2.2]" : ""}`} />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

/** Small uppercase label above a section. */
export function SectionLabel({ children, id }: { children: React.ReactNode; id?: string }) {
  return (
    <h2 id={id} className="font-display text-[12px] font-bold tracking-[0.08em] text-mute uppercase">
      {children}
    </h2>
  );
}
