import type { Metadata } from "next";
import Link from "next/link";
import { DocPage } from "@/components/common/DocPage";
import { SUPPORT_EMAIL } from "@/lib/config";

export const metadata: Metadata = { title: "Terms · See What's in Here" };

export default function TermsPage() {
  return (
    <DocPage title="Terms of use" updated="11 November 2026">
      <p>
        By using See What&apos;s in Here you agree to these terms. They&apos;re short on purpose. How we handle your data is on the{" "}
        <Link href="/privacy/">Privacy</Link> page.
      </p>

      <h2>The app</h2>
      <p>
        See What&apos;s in Here is free. It&apos;s run by Ian Batchelor, a FindTheCool project, in the United Kingdom. We work to keep it
        running and your data safe, but it&apos;s provided as it is, and features may change.
      </p>

      <h2>Dates and food safety</h2>
      <p>
        Dates in the app are what you entered or what was read from a label, and photo readings can be wrong. Always check the
        pack. The app never decides whether food is safe to eat.
      </p>

      <h2>Your account and households</h2>
      <ul>
        <li>Keep access to your email address safe, because sign-in codes are sent there.</li>
        <li>Only invite people you want to see and change your household&apos;s list.</li>
        <li>You own what you add. You let us store and show it to your household so the app works.</li>
        <li>You can delete your account at any time from the Household screen.</li>
      </ul>

      <h2>Fair use</h2>
      <p>
        Don&apos;t use the app to break the law, to upload things you don&apos;t have the right to share, or to overload or attack the
        service. Photo scans have monthly limits so the app stays free. We may suspend accounts that misuse it.
      </p>

      <h2>Liability</h2>
      <p>
        As far as the law allows, we aren&apos;t responsible for losses from using the app, such as food that went out of date or
        things listed in the wrong place. Nothing here limits rights you have under UK consumer law.
      </p>

      <h2>Contact</h2>
      <p>
        Questions: <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>. These terms are governed by the law of England and Wales.
      </p>
    </DocPage>
  );
}
