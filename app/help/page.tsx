import type { Metadata } from "next";
import Link from "next/link";
import { DocPage } from "@/components/common/DocPage";
import { SUPPORT_EMAIL } from "@/lib/config";

export const metadata: Metadata = { title: "Help · See What's in Here" };

export default function HelpPage() {
  return (
    <DocPage title="Help">
      <p>
        Stuck, found a bug, or have an idea? Email <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> and we&apos;ll get back to you.
      </p>

      <h2>Signing in</h2>
      <p>
        Enter your email and we send you a code. There&apos;s no password to remember. If the code doesn&apos;t arrive within a minute,
        check your spam folder, then tap <b>Send a new code</b>.
      </p>

      <h2>Sharing with your household</h2>
      <p>
        Open <b>Household</b> and tap <b>Create an invitation link</b>. Each link works once, for one person, and expires after 7
        days. Everyone in the household sees the same places and things, and changes appear for everyone straight away.
      </p>

      <h2>Adding things</h2>
      <ul>
        <li><b>Scan a label</b>: take a photo of the front of a pack, and the back if the dates are there. Check what was read, then save.</li>
        <li><b>A whole shelf or rail</b>: one photo of a bookshelf or a wardrobe rail lists everything in it for you to check.</li>
        <li><b>By hand</b>: type the name and amount. Dates are optional.</li>
      </ul>
      <p>Photo scans have a monthly limit per person, which resets over 30 days.</p>

      <h2>Stickers and QR labels</h2>
      <p>
        Every place can have its own sticker. Open a place, tap the sticker button, and either write it to an NFC sticker (hold
        the top of your iPhone to the sticker) or print a QR label. Tapping the sticker or scanning the label then opens that
        place. Only people in your household can see what&apos;s inside.
      </p>

      <h2>Deleting your account</h2>
      <p>
        Open <b>Household</b> and tap <b>Delete my account</b>. You&apos;ll confirm it&apos;s you with a code, and then your account is
        deleted. See <Link href="/privacy/">Privacy</Link> for exactly what is removed.
      </p>
    </DocPage>
  );
}
