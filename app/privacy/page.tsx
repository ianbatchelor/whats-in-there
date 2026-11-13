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
        The app is run by Ian Batchelor, a FindTheCool project, in the United Kingdom. If you have a question about your data,
        email <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
      </p>

      <h2>What we store</h2>
      <ul>
        <li><b>Your email address</b>, only to send you sign-in codes. We don&apos;t send marketing emails.</li>
        <li><b>The name you choose</b>, shown to the people in your households.</li>
        <li>
          <b>Your households and what&apos;s in them</b>: places, the things you add (names, amounts, dates, brands, notes), photos
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

      <h2>Present lists you share</h2>
      <p>
        If you share a present list, anyone with its link can see who the list is for and the ideas on it (titles, notes, links
        and prices), without an account. Nothing else from your household is shown. Someone using the link can mark an idea
        &ldquo;I&apos;m getting this&rdquo; and type a first name; we store that name and when it was marked, and the person the
        list is for never sees who is getting what. You can stop sharing at any time, and the old link stops working.
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

      <h2>Companies that help run the app</h2>
      <ul>
        <li><b>Supabase</b> stores your account, households and photos, in Europe.</li>
        <li><b>Anthropic</b> reads photos you choose to scan, as above.</li>
        <li><b>Open Library</b> and <b>Open Food Facts</b> are asked what a scanned barcode is, and Open Library for book covers, as above.</li>
        <li><b>Resend</b> sends the sign-in code emails.</li>
        <li><b>Vercel</b> hosts the website.</li>
        <li><b>Cloudflare</b> may check that sign-ins come from a person and not a bot.</li>
      </ul>
      <p>Each of them handles data only to provide their service to us.</p>

      <h2>Keeping and deleting your data</h2>
      <p>
        We keep your data while you have an account. You can delete your account at any time in the app: open <b>Household</b>,
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
