import type { Metadata } from "next";
import { DocPage } from "@/components/common/DocPage";
import { SUPPORT_EMAIL } from "@/lib/config";

export const metadata: Metadata = { title: "Privacy · See What's in Here" };

export default function PrivacyPage() {
  return (
    <DocPage title="Privacy" updated="11 November 2026">
      <p>
        See What&apos;s in Here helps you keep track of what you have and where it is. This page explains, in plain English, what
        the app stores, who can see it, and which other companies help run it. There are no ads, no tracking across other apps or
        websites, and nothing is ever sold.
      </p>
      <p>
        The app is run by FindTheCool (Ian Batchelor) in the United Kingdom, and is responsible for your data. If you have a question about your data,
        email <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
      </p>

      <h2>What we store</h2>
      <ul>
        <li><b>Your email address</b>, only to send you sign-in codes. We don&apos;t send marketing emails.</li>
        <li><b>The name you choose</b>, shown to the people in your households.</li>
        <li>
          <b>Your households and what&apos;s in them</b>: places, the things you add (names, amounts, dates, brands, notes, wine tasting notes), photos
          you take of labels, shelves and places, your household&apos;s shopping list, and a history of who added or took out what.
        </li>
        <li>
          <b>Who you&apos;ve lent things to</b>, if you mark something as lent: the name you type and the date. Only the people in
          your household can see it. Use a first name or a nickname; that person doesn&apos;t need an account.
        </li>
        <li><b>Sticker links</b> for your places, so a sticker or QR code opens the right place.</li>
        <li>
          <b>A log of photo scans</b>: when a scan happened, who made it, what was read from the photo and how much computing
          it used. We use it to keep scanning within fair limits and to fix problems.
        </li>
      </ul>

      <h2>Who can see it</h2>
      <p>
        Everything in a household is visible only to the people in that household, and they can see each other&apos;s names. Each
        household&apos;s photos are stored privately and can only be opened by its members. Access is enforced by the database
        itself, not just by the app.
      </p>

      <h2>Family with their own home</h2>
      <p>
        A household owner can invite someone as <b>family</b>, such as a grown-up child or a grandparent with a home of their own.
        Family see the household&apos;s name, the names of the people in it and its present lists, and can add ideas and say what
        they&apos;re getting. They see nothing else: no places, things, photos, shopping or other lists. The household sees nothing of
        theirs. Anyone holding a family invitation link can see the household&apos;s name and who sent it before joining. Family can leave,
        or be removed, at any time.
      </p>

      <h2>Sharing one place</h2>
      <p>
        Anyone who lives in a household can let someone else into a single place, by ticking family or sending an invitation link that
        works once, for 7 days. Before joining, anyone holding the link can see the place&apos;s name, the household&apos;s name, who
        sent it and how many things are in it. Once in, they can see that place, the boxes inside it, the things in them with their
        photos and history, the names of the people who changed them, and the names of others let in. They can add, change, move and
        take things out there, and their photos are stored with the household&apos;s. They see nothing else of the household, and the
        household sees nothing of theirs. Anyone in the household can take them out, and they can leave, at any time.
      </p>

      <h2>Your own lists and group lists</h2>
      <p>
        A list you make can be <b>Just me</b>, which nobody else can see, not even people in your household; shared with your household;
        shared with your household and its family members, who then see that list and can add to it and tick things off; or a{" "}
        <b>group list</b>. If you invite people to a group list, anyone with the invitation link can see the list&apos;s name, your
        name and how many things and people are on it. People who join sign in with their email and can then see the list, everything on
        it, and the names of everyone in the group. They see nothing else of your household, and you see nothing of theirs. Invitation
        links last 7 days; you can stop one or remove someone at any time, and anyone can leave.
      </p>

      <h2>Present and book lists you share</h2>
      <p>
        If you share a present list or a book wish list, anyone with its link can see who the list is for and what&apos;s on it (titles, authors, notes,
        links, prices and pictures), without an account. Nothing else from your household is shown. Someone using the link can mark an idea
        &ldquo;I&apos;m getting this&rdquo; and type a first name; we store that name and when it was marked, and the person the
        list is for never sees who is getting what. You can stop sharing at any time, and the old link stops working.
      </p>
      <p>
        Someone with a book wish list link can also suggest a book for it, or start a book list of their own, giving only a first
        name. We store that name with the books they add, and their list shows in the household that sent the link, so the
        household can get them a book. Their list is kept from the same browser with a private key; they can remove it at any time.
      </p>
      <p>
        If you paste a shop link into a present idea, our server opens that page to fill in the name, price and picture, and may
        send the page&apos;s text to <b>Claude (Anthropic)</b> to read them. The product picture is saved so the idea can show it.
        These shop pictures are kept apart from your household&apos;s own photos, and anyone who has the address of a picture can
        open it.
      </p>

      <h2>Reading photos with AI</h2>
      <p>
        When you scan a label, a shelf or a rail, the photo is sent to <b>Claude, an AI made by Anthropic</b>, which reads what&apos;s
        printed or visible (names, brands, weights, dates) and sends the reading back to fill in the form. The app asks your
        permission before your first scan. Anthropic doesn&apos;t use these photos to train its models and keeps them only for a short
        time (up to 30 days) for safety and abuse checks. You can always add things by hand instead, without sending any photo.
      </p>

      <h2>The shared product list</h2>
      <p>
        When a scan reads a barcode, the barcode with the product&apos;s name, brand and pack size goes into a list shared by everyone
        who uses the app, so the same product reads the same way next time. Only product details go in that list: never your
        photos, your dates, your notes, your places or anything about your household.
      </p>
      <p>
        If that list doesn&apos;t know a barcode yet, the app looks the barcode up in two free public lists: <b>Open Library</b> for
        books and <b>Open Food Facts</b> for food and household products. Only the barcode&apos;s digits are sent, with nothing about
        you.
      </p>
      <p>
        To show book covers, your device asks <b>Open Library</b> for the cover of each book on your list, using only the book&apos;s
        title and author, and then loads the cover picture from Open Library. Nothing about you or your household is sent with it.
      </p>
      <p>
        When you add a book to a wish list, your device sends the title you type, or the ISBN read from a book&apos;s barcode, to{" "}
        <b>Open Library</b> to find the book. Barcodes are read on your device, so these photos are not sent anywhere.
      </p>

      <h2>Companies that help run the app</h2>
      <ul>
        <li><b>Supabase</b> stores your account, households and photos, in Europe.</li>
        <li><b>Anthropic</b> reads photos you choose to scan, as above.</li>
        <li><b>Open Library</b> and <b>Open Food Facts</b> are asked what a scanned barcode is, and Open Library for book covers and book searches, as above.</li>
        <li><b>Resend</b> sends the sign-in code emails.</li>
        <li><b>Vercel</b> hosts the website.</li>
        <li><b>Cloudflare</b> may check that sign-ins come from a person and not a bot.</li>
      </ul>
      <p>Each of them handles data only to provide their service to us.</p>

      <h2>Keeping and deleting your data</h2>
      <p>
        We keep your data while you have an account. You can delete your account at any time in the app: open <b>People</b>,
        then <b>Delete my account</b>. That deletes your sign-in, your name and every household where you&apos;re the only member,
        with all its places, things and photos. Households you share carry on for the other members; things you added there
        stay, without your name.
      </p>

      <h2>Your rights</h2>
      <p>
        Under UK and EU data protection law you can ask for a copy of your data, ask us to correct or delete it, or object to how
        we use it. Email <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>. You can also complain to the Information
        Commissioner&apos;s Office (ico.org.uk).
      </p>

      <h2>Children</h2>
      <p>The app is meant for households to use together and isn&apos;t aimed at children under 13.</p>

      <h2>Changes</h2>
      <p>If this page changes in a way that matters, we&apos;ll say so in the app.</p>
    </DocPage>
  );
}
