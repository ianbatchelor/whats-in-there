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
        Open <b>Household</b> and tap <b>Invite someone</b>. Each link works once, for one person, and expires after 7
        days. Everyone who lives in the household sees the same places and things, and changes appear for everyone straight away.
      </p>
      <p>
        For family with their own home, such as a grown-up son or daughter, choose <b>Family with their own home</b>. They see
        everyone&apos;s present lists and keep their own, and nothing else. If you already kept a list for them, they can tap
        <b> Is this you?</b> on it to make it theirs.
      </p>

      <h2>Sharing one place</h2>
      <p>
        To let someone who doesn&apos;t live with you use one place, such as a daughter who keeps food in your garage freezer, open the
        place and tap <b>Who else uses this?</b> at the bottom. Tap <b>Let in</b> next to family, or make an invitation link for anyone
        else. They see that place, the boxes inside it and what&apos;s in them, and can add and take things out. They don&apos;t see your
        other places, and you don&apos;t see their home. It shows under <b>Shared with you</b> on their Home. Tap <b>Take out</b> to
        stop sharing; they can leave whenever they like.
      </p>

      <h2>Adding things</h2>
      <ul>
        <li><b>Scan a label</b>: take a photo of the front of a pack, and the back if the dates are there. Check what was read, then save.</li>
        <li><b>A whole shelf or rail</b>: one photo of a bookshelf or a wardrobe rail lists everything in it for you to check.</li>
        <li><b>By hand</b>: type the name and amount. Dates are optional.</li>
      </ul>
      <p>Photo scans have a monthly limit per person, which resets over 30 days.</p>

      <h2>Boxes and shelves inside a place</h2>
      <p>
        Open a place, such as the Garage, and tap <b>Add a box or shelf</b>. Each box gets its own page, and its cover shows a few
        of the things inside, so you can tell boxes apart at a glance. Search finds things in boxes too.
      </p>

      <h2>Using things up</h2>
      <p>
        <b>Needs attention</b> on Home lists anything close to or past a printed date. Tap the minus button to take one out, or
        open a thing to take out part of it, move it, or edit it. Took out the wrong thing? Tap <b>Undo</b> straight away.
      </p>

      <h2 id="lists">Lists</h2>
      <p>The <b>Lists</b> tab holds everything you keep track of together, rather than in a place:</p>
      <ul>
        <li>
          <b>Shopping list</b>: shared with everyone at home. Add things by typing, or from a thing&apos;s details with{" "}
          <b>Add to shopping list</b>. Tick things off as you shop, choose where each one goes, then tap <b>Put it away</b> to add
          them to their places.
        </li>
        <li>
          <b>Present ideas</b>: a wish list for each person, including children without an account. Paste a shop link and the
          name, price and picture are filled in for you. Others can say they&apos;re getting something; the person it&apos;s for never
          sees what. <b>Share my list</b> sends a link family can open without signing up.
        </li>
        <li>
          <b>Book wish lists</b>: add books by scanning the barcode, searching for a title or pasting a shop link. If you already
          own one, it says which shelf it&apos;s on. Share your list and friends can suggest a book, or start their own list with
          just a first name.
        </li>
        <li>
          <b>Lent out</b>: open a thing and tap <b>Lend…</b> to note who has it. After a month it shows on Home, with{" "}
          <b>Ask for it back</b> to send a friendly message. Tap <b>It&apos;s back</b> when it returns.
        </li>
        <li>
          <b>Seasonal jobs</b>: a few jobs that come round each year, such as swapping to winter clothes, for the places you have.
          Tick one off and it&apos;s done for everyone, or tap the cross to hide it for a week.
        </li>
        <li>
          <b>Your own lists</b>: tap <b>New list</b> to make any list you like, such as jobs before a visit or Christmas ideas.
          Choose <b>Just me</b> and nobody else can see it, not even people at home; share it with everyone at home; or choose{" "}
          <b>A group I invite</b> and send friends or family elsewhere a link. They sign in with their email and see that list only,
          never your home. Change your mind any time with <b>Change</b> at the top of the list.
        </li>
      </ul>

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
