// What a notification says, and where tapping it goes. Kept apart from index.ts so the app's tests can
// check the wording (tests/unit/notifications.test.ts).

/** One row of public.notifications_due(). */
export type Due = {
  event_ids: number[];
  recipient: string;
  target_kind: "wish_list" | "list";
  target_id: string;
  actors: string[];
  things: string[];
  total: number;
  list_title: string | null;
  list_kind: string | null;
  for_user: string | null;
  for_name: string | null;
  household_id: string | null;
  devices: { token: string; env: "production" | "sandbox" | null }[];
};

export type Message = {
  title: string;
  body: string;
  /** The app page to open when it's tapped. */
  url: string;
  /** For present lists: whose household's lists to show (someone can be in more than one). */
  circle?: string;
  /** Notifications about the same list stack together on the phone. */
  thread: string;
};

const first = (name: string) => name.trim().split(/\s+/)[0] || name;

/** "Shel", "Shel and Ian", "Shel, Ian and Carol", "Shel and 3 others". */
export function whoDid(names: string[]): string {
  const n = names.map(first);
  if (n.length === 0) return "Someone";
  if (n.length === 1) return n[0]!;
  if (n.length === 2) return `${n[0]} and ${n[1]}`;
  if (n.length === 3) return `${n[0]}, ${n[1]} and ${n[2]}`;
  return `${n[0]} and ${n.length - 1} others`;
}

const short = (s: string, max = 60) => {
  const t = s.trim().replace(/\s+/g, " ");
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
};

/** "Lego set", "Lego set and Scarf", "Lego set, Scarf and 3 more". */
function some(things: string[], total: number): string {
  const t = things.slice(0, 2).map((x) => short(x, 40));
  if (total <= 1 || t.length === 1) return t[0] ?? "";
  if (total === 2) return `${t[0]} and ${t[1]}`;
  return `${t[0]}, ${t[1]} and ${total - 2} more`;
}

export function message(d: Due): Message {
  const who = whoDid(d.actors);
  if (d.target_kind === "wish_list") {
    const books = d.list_kind === "books";
    const whose = d.for_name ? `${first(d.for_name)}'s ${books ? "book wish list" : "wish list"}` : books ? "Book wish list" : "Wish list";
    const body =
      d.total <= 1 ? `${who} added ${short(d.things[0] ?? "an idea")}` : `${who} added ${d.total} ${books ? "books" : "ideas"}: ${some(d.things, d.total)}`;
    const key = d.for_user ?? d.target_id;
    return {
      title: whose,
      body,
      url: books ? `/books/?for=${key}` : `/presents/?for=${key}`,
      circle: books ? undefined : (d.household_id ?? undefined),
      thread: d.target_id,
    };
  }
  const body = d.total <= 1 ? `${who} added ${short(d.things[0] ?? "something")}` : `${who} added ${d.total} things: ${some(d.things, d.total)}`;
  return { title: d.list_title ?? "Your list", body, url: `/my-list/?id=${d.target_id}`, thread: d.target_id };
}
