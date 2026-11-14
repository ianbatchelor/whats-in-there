import type { Metadata } from "next";
import { DocPage } from "@/components/common/DocPage";
import { HelpTopics } from "@/components/help/HelpTopics";
import { SUPPORT_EMAIL } from "@/lib/config";

export const metadata: Metadata = { title: "Help · See What's in Here" };

export default function HelpPage() {
  return (
    <DocPage title="Help">
      <HelpTopics />
      <p className="mt-2 text-mute">
        Stuck, found a bug, or have an idea? Email <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> and we&apos;ll get back to you.
      </p>
    </DocPage>
  );
}
