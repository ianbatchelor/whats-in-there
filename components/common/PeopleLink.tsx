import Link from "next/link";
import { IconChevronRight } from "@/components/ui/icons";

/** Every share sheet ends the same way: the People page has the whole picture of who sees what. */
export function PeopleLink() {
  return (
    <Link href="/household/" className="flex min-h-11 items-center gap-1.5 self-start text-[14px] font-semibold text-leaf">
      See everyone you share with <IconChevronRight className="size-4" />
    </Link>
  );
}
