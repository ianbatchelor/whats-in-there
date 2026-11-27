import Link from "next/link";
import { IconChevronLeft } from "@/components/ui/icons";

/** Title block for the tab screens. */
export function PageHeader({
  title,
  sub,
  back,
  action,
  art,
}: {
  title: string;
  sub?: React.ReactNode;
  back?: { href: string; label: string };
  action?: React.ReactNode;
  /** One of the Lists page's illustrations, beside the title (decoration only). */
  art?: string;
}) {
  return (
    <header className="flex flex-col gap-1.5">
      {back ? (
        <Link href={back.href} className="-ml-1 flex min-h-11 w-fit items-center gap-1 pr-3 font-display font-semibold text-leaf">
          <IconChevronLeft className="size-5" /> {back.label}
        </Link>
      ) : null}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="font-serif text-[2.1rem] leading-[1.05] font-semibold tracking-[-0.015em] text-balance text-forest sm:text-[2.4rem]">{title}</h1>
            {sub ? <p className="mt-1 text-[14.5px] text-mute">{sub}</p> : null}
          </div>
          {art ? (
            // Static export: plain img, pre-sized webp files.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={art} alt="" aria-hidden="true" width={192} height={192} decoding="async" className="size-14 shrink-0 object-contain sm:size-16" />
          ) : null}
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
