"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandMark, Wordmark } from "@/components/brand/BrandMark";
import { IconActivity, IconHome, IconList, IconPeople, IconScan, IconSearch } from "@/components/ui/icons";

/** Pages reached from the Lists tab, so the tab stays lit while you're on one of them. */
const LIST_PAGES = ["lists", "list", "my-list", "presents", "books", "lent", "season"];

type NavItem = {
  href: string;
  label: string;
  Icon: (p: { className?: string }) => React.ReactNode;
  primary?: boolean;
  /** Where it shows: the phone's bottom bar, the desktop sidebar, or both (the default). */
  only?: "phone" | "desktop";
  match: (p: string) => boolean;
};

// On phones Search lives in the box at the top of Home and of every place, so its tab goes to Lists.
const NAV: NavItem[] = [
  { href: "/", label: "Home", Icon: IconHome, match: (p: string) => p === "/" || p.startsWith("/place") },
  { href: "/lists/", label: "Lists", Icon: IconList, match: (p: string) => LIST_PAGES.includes(p.split("/")[1] ?? "") },
  { href: "/search/", label: "Search", Icon: IconSearch, only: "desktop", match: (p: string) => p.startsWith("/search") },
  { href: "/add/", label: "Add", Icon: IconScan, primary: true, match: (p: string) => p.startsWith("/add") },
  { href: "/activity/", label: "Activity", Icon: IconActivity, match: (p: string) => p.startsWith("/activity") },
  { href: "/household/", label: "Household", Icon: IconPeople, match: (p: string) => p.startsWith("/household") },
];

/**
 * Frame for signed-in screens: bottom tabs on phones, a sidebar on wide screens.
 * Every tab is a real screen; nothing here is decoration.
 */
export function AppShell({ children, wide = false, rail }: { children: React.ReactNode; wide?: boolean; rail?: React.ReactNode }) {
  const path = usePathname() || "/";
  return (
    <div className="min-h-dvh bg-bg lg:flex">
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-7 border-r border-line bg-card/60 px-4 py-6 lg:flex">
        <Link href="/" className="flex items-center gap-2.5">
          <BrandMark size={30} />
          <Wordmark className="text-[15.5px]" />
        </Link>
        <nav aria-label="Main" className="flex flex-col gap-1">
          {NAV.filter((n) => !n.primary && n.only !== "phone").map(({ href, label, Icon, match }) => {
            const active = match(path);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-10 items-center gap-3 rounded-[10px] px-3 text-[14.5px] transition ${
                  active ? "bg-sunk font-semibold text-fg" : "font-medium text-mute hover:bg-sunk/60 hover:text-fg"
                }`}
              >
                <Icon className="size-5" />
                {label}
              </Link>
            );
          })}
          <Link
            href="/add/"
            aria-current={path.startsWith("/add") ? "page" : undefined}
            className="mt-3 flex min-h-11 items-center justify-center gap-2.5 rounded-xl bg-go text-[14.5px] font-semibold text-on-go transition hover:opacity-90"
          >
            <IconScan className="size-5" />
            Add or scan
          </Link>
        </nav>
      </aside>

      <main
        className={`mx-auto flex w-full flex-col gap-6 px-4 pt-[max(16px,env(safe-area-inset-top))] pb-[calc(96px+env(safe-area-inset-bottom))] sm:px-6 lg:px-10 lg:pt-10 lg:pb-16 ${
          wide ? "max-w-6xl" : "max-w-3xl"
        }`}
      >
        {children}
      </main>

      {rail ? (
        <aside className="sticky top-0 hidden h-dvh w-80 shrink-0 flex-col gap-7 overflow-y-auto border-l border-line bg-card/60 px-6 py-10 xl:flex">{rail}</aside>
      ) : null}

      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
      >
        <ul className="mx-auto grid max-w-lg grid-cols-5">
          {NAV.filter((n) => n.only !== "desktop").map(({ href, label, Icon, match, primary }) => {
            const active = match(path);
            return (
              <li key={href}>
                {primary ? (
                  <Link href={href} aria-current={active ? "page" : undefined} aria-label="Add or scan" className="flex min-h-[60px] items-start justify-center">
                    <span className="-mt-4 grid size-[54px] place-items-center rounded-[18px] bg-go text-on-go shadow-[0_10px_20px_-8px_rgba(30,74,56,0.65)] ring-4 ring-bg transition active:scale-95">
                      <Icon className="size-6" />
                    </span>
                  </Link>
                ) : (
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={`flex min-h-[60px] flex-col items-center justify-center gap-1 text-[11px] font-semibold ${active ? "text-fg" : "text-mute"}`}
                  >
                    <Icon className={`size-[22px] ${active ? "stroke-[2.2]" : ""}`} />
                    {label}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

/** Title above a section. */
export function SectionLabel({ children, id }: { children: React.ReactNode; id?: string }) {
  return (
    <h2 id={id} className="font-display text-[15px] font-bold tracking-[-0.01em]">
      {children}
    </h2>
  );
}
