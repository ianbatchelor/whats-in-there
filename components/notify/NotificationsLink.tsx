import Link from "next/link";
import { IconBell, IconChevronRight } from "@/components/ui/icons";

/** The way to the Notifications page from You and People. */
export function NotificationsLink() {
  return (
    <Link
      href="/notifications/"
      className="flex min-h-14 items-center gap-3 rounded-2xl border border-line bg-card px-4 shadow-[var(--shadow-card)] transition hover:bg-sunk/50"
    >
      <IconBell className="size-5 shrink-0 text-leaf" />
      <span className="min-w-0 flex-1">
        <b className="block font-semibold">Notifications</b>
        <span className="block text-[13.5px] text-mute">What you hear about, and quiet hours</span>
      </span>
      <IconChevronRight className="size-4 shrink-0 text-mute/70" />
    </Link>
  );
}
