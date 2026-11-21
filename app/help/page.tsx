import type { Metadata } from "next";
import Link from "next/link";
import { DocPage } from "@/components/common/DocPage";
import { HelpTopics } from "@/components/help/HelpTopics";
import { SUPPORT_EMAIL } from "@/lib/config";
import { IconChevronRight, IconPlay } from "@/components/ui/icons";

export const metadata: Metadata = { title: "Help · See What's in Here" };

export default function HelpPage() {
  return (
    <DocPage title="Help">
      <Link
        href="/how-it-works/"
        className="not-doc flex min-h-16 items-center gap-3.5 rounded-[var(--radius-card)] border border-line bg-card px-4 py-3 no-underline! shadow-[var(--shadow-card)] transition hover:bg-sunk/50"
      >
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-brand text-tape" aria-hidden="true">
          <IconPlay className="size-5 translate-x-px" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-display text-[16px] font-bold">Watch how it works</span>
          <span className="block text-[14px] font-normal text-mute">A one-minute video, from stickers to Christmas presents</span>
        </span>
        <IconChevronRight className="size-4 shrink-0 text-mute/70" />
      </Link>
      <HelpTopics />
      <p className="mt-2 text-mute">
        Stuck, found a bug, or have an idea? Email <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> and we&apos;ll get back to you.
      </p>
    </DocPage>
  );
}
