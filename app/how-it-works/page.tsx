import type { Metadata } from "next";
import Link from "next/link";
import { DocPage } from "@/components/common/DocPage";
import { HowItWorksVideo } from "@/components/help/HowItWorksVideo";

export const metadata: Metadata = { title: "How it works · See What's in Here" };

export default function HowItWorksPage() {
  return (
    <DocPage title="How it works">
      <HowItWorksVideo />
      <p className="mt-2 text-mute">
        Want the details on something? <Link href="/help/">Help</Link> has a short answer for everything.
      </p>
    </DocPage>
  );
}
