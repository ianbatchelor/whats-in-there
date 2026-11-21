import type { Metadata } from "next";
import Link from "next/link";
import { DocPage } from "@/components/common/DocPage";
import { HowItWorksVideo } from "@/components/help/HowItWorksVideo";
import { ShortVideo } from "@/components/help/ShortVideo";
import { CHRISTMAS_SHORT } from "@/lib/domain/howItWorks";

export const metadata: Metadata = { title: "How it works · See What's in Here" };

export default function HowItWorksPage() {
  return (
    <DocPage title="How it works">
      <HowItWorksVideo />
      <h2 className="mt-4! font-display text-[17px]! font-bold tracking-[-0.01em]">Getting ready for Christmas</h2>
      <ShortVideo id="christmas" {...CHRISTMAS_SHORT} />
      <p className="mt-2 text-mute">
        Want the details on something? <Link href="/help/">Help</Link> has a short answer for everything.
      </p>
    </DocPage>
  );
}
