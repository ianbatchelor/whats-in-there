import Link from "next/link";
import { IconChevronLeft } from "@/components/ui/icons";

/** Title block for the tab screens. */
export function PageHeader({ title, sub, back, action }: { title: string; sub?: React.ReactNode; back?: { href: string; label: string }; action?: React.ReactNode }) {
  return (
    <header className="flex flex-col gap-2">
      {back ? (
        <Link href={back.href} className="-ml-1 flex min-h-11 w-fit items-center gap-1 pr-3 font-display font-semibold text-leaf">
          <IconChevronLeft className="size-5" /> {back.label}
        </Link>
      ) : null}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-[1.75rem] leading-tight font-bold tracking-[-0.025em] sm:text-[2rem]">{title}</h1>
          {sub ? <p className="mt-1.5 text-mute">{sub}</p> : null}
        </div>
        {action}
      </div>
    </header>
  );
}

/** Loading and error frame shared by the household screens. */
export function HouseholdLoading() {
  return (
    <div className="flex flex-col gap-3" aria-busy="true">
      <div className="h-10 w-48 animate-pulse rounded-xl bg-sunk" />
      <div className="h-24 animate-pulse rounded-[var(--radius-card)] bg-sunk" />
      <div className="h-24 animate-pulse rounded-[var(--radius-card)] bg-sunk" />
    </div>
  );
}
