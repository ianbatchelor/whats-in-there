import Link from "next/link";

export type HelpTopic = { id: string; title: string; group: string; body: React.ReactNode };

/** Help, as short topics in a few groups, so it can be searched and each answer is a tap away. */
export const HELP_TOPICS: HelpTopic[] = [
  {
    id: "adding",
    group: "Getting started",
    title: "Adding things",
    body: (
      <>
        <p>
          Tap the <b>+</b> button in the middle of the bar. It shows which place things go into (tap <b>Change</b> to pick
          another) and four ways in:
        </p>
        <ul>
          <li><b>Scan a label</b>: a photo of the front of a pack, and the back if the dates are there. Check what was read, then save.</li>
          <li><b>Scan a shelf</b>: one photo of a bookshelf or a wardrobe rail lists everything in it for you to check.</li>
          <li><b>Type it in</b>: the name and how many. Dates are optional.</li>
          <li><b>Add to a list</b>: the shopping list, your present ideas or one of your own lists.</li>
        </ul>
        <p>Pressing + while you&apos;re looking at a place adds to that place. Photo scans have a monthly limit per person, which resets over 30 days.</p>
      </>
    ),
  },
  {
    id: "finding",
    group: "Getting started",
    title: "Finding something",
    body: (
      <p>
        Tap the search box at the top of Home. It looks in every place, box and list at once, so &ldquo;passport&rdquo; finds the
        attic it&apos;s in, and &ldquo;Sherlock&rdquo; also finds it on someone&apos;s present ideas. Each result says where it is.
        Words can be in any order.
      </p>
    ),
  },
  {
    id: "boxes",
    group: "Getting started",
    title: "Places, boxes and shelves",
    body: (
      <p>
        Things live in places, like a freezer, the attic or a wardrobe. Open a place, such as the Garage, and tap <b>Add a box or
        shelf</b> to split it up. Each box gets its own page, and its cover shows a few of the things inside, so you can tell
        boxes apart at a glance.
      </p>
    ),
  },
  {
    id: "signing-in",
    group: "Getting started",
    title: "Signing in",
    body: (
      <p>
        Enter your email and we send you a code. There&apos;s no password to remember. If the code doesn&apos;t arrive within a
        minute, check your spam folder, then tap <b>Send a new code</b>.
      </p>
    ),
  },
  {
    id: "using-up",
    group: "Every day",
    title: "Using things up",
    body: (
      <p>
        The <b>Use soon</b> card on Home lists anything close to or past a printed date. Tap the minus button to take one out, or
        open a thing to take out part of it, move it, lend it or edit it. Took out the wrong thing? Tap <b>Undo</b> straight away.
      </p>
    ),
  },
  {
    id: "shopping",
    group: "Every day",
    title: "Shopping list",
    body: (
      <p>
        Shared with everyone at home. Add things with the + button, on the list itself, or from a thing&apos;s details with{" "}
        <b>Add to shopping list</b>. Tick things off as you shop, choose where each one goes, then tap <b>Put it away</b> to add
        them to their places. Back home, Home shows what you bought with a <b>Put them away</b> button, so it&apos;s one tap. If you already have something at home, it says how many and where, so you don&apos;t buy more.
      </p>
    ),
  },
  {
    id: "wine",
    group: "Every day",
    title: "Wine rack",
    body: (
      <p>
        Scan a wine label and the vintage, colour, grape, region and when to drink it are filled in. The rack lists what to drink
        first. Keep a bottle for an occasion with <b>Keeping it for</b>, and after <b>Opened one</b> you can note how it was and add
        it to the shopping list.
      </p>
    ),
  },
  {
    id: "lent",
    group: "Every day",
    title: "Lending things",
    body: (
      <p>
        Open a thing and tap <b>Lend…</b> to note who has it. After a month it shows on Home, with <b>Ask for it back</b> to send a
        friendly message. Tap <b>It&apos;s back</b> when it returns.
      </p>
    ),
  },
  {
    id: "season",
    group: "Every day",
    title: "Seasonal jobs",
    body: (
      <p>
        A few jobs that come round each year, such as swapping to winter clothes, for the places you have. Tick one off and
        it&apos;s done for everyone, or tap the cross to hide it for a week.
      </p>
    ),
  },
  {
    id: "lists",
    group: "Lists and presents",
    title: "Your own lists",
    body: (
      <p>
        On the <b>Lists</b> tab, tap <b>New list</b> to make any list you like, such as jobs before a visit. Choose <b>Just me</b> and
        nobody else can see it; share it with everyone at home; choose <b>Everyone at home and family</b> to include family with
        their own homes; or choose <b>A group I invite</b> and send friends a link. They see that list only, never your home.
        Change your mind any time with <b>Change</b> at the top of the list.
      </p>
    ),
  },
  {
    id: "presents",
    group: "Lists and presents",
    title: "Present ideas",
    body: (
      <p>
        A wish list for each person, including children without an account. Paste a shop link and the name, price and picture are
        filled in. Others can tap <b>I&apos;m getting this</b>; the person it&apos;s for never sees what. <b>Share</b> sends a link
        family can open without signing up.
      </p>
    ),
  },
  {
    id: "books",
    group: "Lists and presents",
    title: "Book wish lists",
    body: (
      <p>
        Add books by scanning the barcode, searching for a title or pasting a shop link. If you already own one, it says which shelf
        it&apos;s on. Share your list and friends can suggest a book, or start their own list with just a first name.
      </p>
    ),
  },
  {
    id: "christmas",
    group: "Lists and presents",
    title: "Christmas",
    body: (
      <p>
        From November, the Christmas page shows who&apos;s getting what, lists for the day, where the decorations are, and what to
        use up to make room in the freezer. <Link href="/how-it-works/#christmas">Watch the 30-second video</Link>.
      </p>
    ),
  },
  {
    id: "notifications",
    group: "Lists and presents",
    title: "Notifications",
    body: (
      <>
        <p>
          In the iPhone app, tap <b>Notify me</b> on someone&apos;s wish list or a shared list, or the bell at the top of a place, to hear when something&apos;s added or taken out.
          Wish lists and lists shared with family or a group start on; lists you share at home and places start off, so the
          shopping list and the freezer don&apos;t buzz all day. Several things added together come as one message, or choose a
          daily summary at 6 pm. A place you follow also sends a 9 am reminder when something in it needs using soon.
        </p>
        <p>
          Nothing about who&apos;s getting what is ever sent, and you&apos;re not told when someone adds an idea to your own list. Set
          quiet hours, pause everything, or see all your bells under <b>People</b>, then <b>Notifications</b>.
        </p>
      </>
    ),
  },
  {
    id: "household",
    group: "Sharing",
    title: "Sharing with your household",
    body: (
      <>
        <p>
          Open <b>People</b> and tap <b>Invite someone</b>. Each link works once, for one person, and expires after 7 days. Everyone
          who lives in the household sees the same places and things, and changes appear for everyone straight away.
        </p>
        <p>
          For family with their own home, choose <b>Family with their own home</b>. They see everyone&apos;s present lists and keep
          their own, and nothing else. If you already kept a list for them, they can tap <b>Is this you?</b> on it to make it theirs.
        </p>
      </>
    ),
  },
  {
    id: "who-sees",
    group: "Sharing",
    title: "Who sees what",
    body: (
      <p>
        <b>People</b> shows everyone you share with in one place: who lives here and sees everything, family and what they see,
        anyone else who uses a place or is in a group list, and lists anyone with the link can open. To stop sharing something,
        open that place or list.
      </p>
    ),
  },
  {
    id: "one-place",
    group: "Sharing",
    title: "Sharing one place",
    body: (
      <p>
        To let someone who doesn&apos;t live with you use one place, such as a daughter who keeps food in your garage freezer, open
        the place and tap <b>Who else uses this?</b> at the bottom. They see that place and what&apos;s in it, and can add and take
        things out, but nothing else of yours. Tap <b>Take out</b> to stop sharing; they can leave whenever they like.
      </p>
    ),
  },
  {
    id: "stickers",
    group: "Stickers and labels",
    title: "Stickers and QR labels",
    body: (
      <p>
        Every place can have its own sticker. Open a place, tap the sticker button, and either write it to an NFC sticker (hold the
        top of your iPhone to the sticker) or print a QR label. Tapping the sticker or scanning the label then opens that place.
        Only people in your household can see what&apos;s inside.
      </p>
    ),
  },
  {
    id: "delete-account",
    group: "Your account",
    title: "Deleting your account",
    body: (
      <p>
        Open <b>People</b> and tap <b>Delete my account</b>. You&apos;ll confirm it&apos;s you with a code, and then your account is
        deleted. See <Link href="/privacy/">Privacy</Link> for exactly what is removed.
      </p>
    ),
  },
];

/** The words in a topic, for searching. */
export function nodeText(node: React.ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(nodeText).join(" ");
  if (typeof node === "object" && "props" in node) return nodeText((node.props as { children?: React.ReactNode }).children);
  return "";
}
