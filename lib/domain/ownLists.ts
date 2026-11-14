/** Your own lists: any number of lists a person makes, each with its own say over who can see it. */

export type ListKind = "todo" | "ideas" | "buy";
/** "family": everyone at home plus family with homes of their own (presents-only members). */
export type ListVisibility = "me" | "household" | "group" | "family";

export type OwnList = {
  id: string;
  owner: string;
  householdId: string | null;
  title: string;
  kind: ListKind;
  visibility: ListVisibility;
  createdAt: string;
};

export type ListEntry = {
  id: string;
  listId: string;
  text: string;
  note: string | null;
  addedBy: string | null;
  addedAt: string;
  doneAt: string | null;
  doneBy: string | null;
};

export const KINDS: {
  kind: ListKind;
  label: string;
  placeholder: string;
  doneLabel: string;
}[] = [
  {
    kind: "todo",
    label: "To do or take",
    placeholder: "Add something to do or take",
    doneLabel: "Done",
  },
  {
    kind: "ideas",
    label: "Ideas",
    placeholder: "Add an idea",
    doneLabel: "Used",
  },
  {
    kind: "buy",
    label: "To buy",
    placeholder: "Add something to buy",
    doneLabel: "Got",
  },
];

export const kindInfo = (kind: ListKind) => KINDS.find((k) => k.kind === kind) ?? KINDS[0]!;

/** Still to do first, oldest first, so the list reads in the order things were added; then what's done, latest first. */
export function splitEntries(entries: ListEntry[]): {
  open: ListEntry[];
  done: ListEntry[];
} {
  const open = entries.filter((e) => !e.doneAt).sort((a, b) => a.addedAt.localeCompare(b.addedAt));
  const done = entries.filter((e) => e.doneAt).sort((a, b) => (b.doneAt ?? "").localeCompare(a.doneAt ?? ""));
  return { open, done };
}

/**
 * Which lists show on the Lists tab while in a household: everything you made, wherever you were, and
 * the lists others share with this household. Private lists first, then shared, each newest first.
 */
export function listsForTab(
  lists: OwnList[],
  me: string,
  householdId: string | null,
): { mine: OwnList[]; home: OwnList[]; groups: OwnList[]; family: OwnList[] } {
  const newest = (a: OwnList, b: OwnList) => b.createdAt.localeCompare(a.createdAt);
  const mine = lists.filter((l) => l.owner === me && l.visibility === "me").sort(newest);
  const home = householdId ? lists.filter((l) => l.visibility === "household" && l.householdId === householdId).sort(newest) : [];
  // Group lists go with you whichever household you're looking at: yours and the ones you joined.
  const groups = lists.filter((l) => l.visibility === "group").sort(newest);
  // Family lists too: your own home's, and those of homes where you're family.
  const family = lists.filter((l) => l.visibility === "family").sort(newest);
  return { mine, home, groups, family };
}

export type ListPerson = { listId: string; userId: string; name: string; isOwner: boolean };

/** "You, Tom, Sarah and Raj": you first, then the owner, then everyone else in the order they joined. */
export function groupNames(people: ListPerson[], me: string): string {
  const sorted = [...people].sort((a, b) => Number(b.userId === me) - Number(a.userId === me) || Number(b.isOwner) - Number(a.isOwner));
  const names = sorted.map((p) => (p.userId === me ? "You" : p.name));
  if (names.length <= 1) return names[0] === "You" ? "Just you so far" : (names[0] ?? "");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** Group list invitation links: /join/?t=<token>. */
export function joinUrl(origin: string, token: string): string {
  return `${origin.replace(/\/+$/, "")}/join/?t=${encodeURIComponent(token)}`;
}

const JOIN_TOKEN = /^[A-Za-z0-9_-]{24,64}$/;

export function readJoinToken(search: string): string | null {
  const t = new URLSearchParams(search).get("t");
  return t && JOIN_TOKEN.test(t) ? t : null;
}

/** The message that goes with a group list link. */
export function joinMessage(title: string, url: string): string {
  return `I've started a shared list, "${title}", on See What's in Here. Join it here and we can add to it and tick things off together: ${url}`;
}

/** What a list's row says under its name: what's left on it, or that it's empty or all done. */
export function listCaption(open: string[], doneCount: number): string {
  if (open.length === 0) return doneCount > 0 ? "All done" : "Nothing on it yet";
  return open.slice(0, 3).join(", ") + (open.length > 3 ? "…" : "");
}

/** Who can see it, said plainly for the list page. */
export function visibilityLine(visibility: ListVisibility, householdName: string | null, isOwner: boolean, ownerName: string | null): string {
  if (visibility === "me") return "Just you. Nobody else can see this list.";
  if (visibility === "group")
    return isOwner
      ? "Shared with the people you invite. Nobody else sees it, including people at home."
      : `${ownerName ?? "Someone"}'s list, shared with you and the group. You see this list only.`;
  const home = householdName ? `everyone in ${householdName}` : "everyone at home";
  if (visibility === "family")
    return isOwner ? `Shared with ${home} and family.` : `${ownerName ?? "Someone"}'s list, shared with ${home} and family.`;
  return isOwner ? `Shared with ${home}.` : `${ownerName ?? "Someone"}'s list, shared with ${home}.`;
}
