/** Your own lists: any number of lists a person makes, each with its own say over who can see it. */

export type ListKind = "todo" | "ideas" | "buy";
export type ListVisibility = "me" | "household";

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
export function listsForTab(lists: OwnList[], me: string, householdId: string): { mine: OwnList[]; home: OwnList[] } {
  const newest = (a: OwnList, b: OwnList) => b.createdAt.localeCompare(a.createdAt);
  const mine = lists.filter((l) => l.owner === me && l.visibility === "me").sort(newest);
  const home = lists.filter((l) => l.visibility === "household" && l.householdId === householdId).sort(newest);
  return { mine, home };
}

/** What a list's row says under its name: what's left on it, or that it's empty or all done. */
export function listCaption(open: string[], doneCount: number): string {
  if (open.length === 0) return doneCount > 0 ? "All done" : "Nothing on it yet";
  return open.slice(0, 3).join(", ") + (open.length > 3 ? "…" : "");
}

/** Who can see it, said plainly for the list page. */
export function visibilityLine(visibility: ListVisibility, householdName: string | null, isOwner: boolean, ownerName: string | null): string {
  if (visibility === "me") return "Just you. Nobody else can see this list.";
  const home = householdName ? `everyone in ${householdName}` : "everyone at home";
  return isOwner ? `Shared with ${home}.` : `${ownerName ?? "Someone"}'s list, shared with ${home}.`;
}
