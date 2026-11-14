import { describe, expect, it } from "vitest";
import { kindInfo, listCaption, listsForTab, splitEntries, visibilityLine, type ListEntry, type OwnList } from "@/lib/domain/ownLists";

const list = (o: Partial<OwnList>): OwnList => ({
  id: "l",
  owner: "me",
  householdId: null,
  title: "T",
  kind: "todo",
  visibility: "me",
  createdAt: "2026-11-01",
  ...o,
});
const entry = (o: Partial<ListEntry>): ListEntry => ({
  id: "e",
  listId: "l",
  text: "x",
  note: null,
  addedBy: null,
  addedAt: "2026-11-01",
  doneAt: null,
  doneBy: null,
  ...o,
});

describe("listsForTab", () => {
  const lists = [
    list({ id: "a", visibility: "me", createdAt: "2026-11-01" }),
    list({ id: "b", visibility: "me", createdAt: "2026-11-03" }),
    list({
      id: "c",
      visibility: "household",
      householdId: "h1",
      owner: "michele",
    }),
    list({ id: "d", visibility: "household", householdId: "h2", owner: "me" }),
    list({
      id: "e",
      visibility: "household",
      householdId: "h1",
      owner: "me",
      createdAt: "2026-11-05",
    }),
  ];
  it("puts your private lists first, newest first, wherever you made them", () => {
    expect(listsForTab(lists, "me", "h1").mine.map((l) => l.id)).toEqual(["b", "a"]);
  });
  it("shows only this household's shared lists, from anyone", () => {
    expect(listsForTab(lists, "me", "h1").home.map((l) => l.id)).toEqual(["e", "c"]);
  });
  it("never shows someone else's private list even if one arrived", () => {
    expect(listsForTab([list({ owner: "michele" })], "me", "h1").mine).toEqual([]);
  });
});

describe("splitEntries", () => {
  it("keeps open things oldest first and done things latest first", () => {
    const { open, done } = splitEntries([
      entry({ id: "2", addedAt: "2026-11-02" }),
      entry({ id: "1", addedAt: "2026-11-01" }),
      entry({ id: "d1", doneAt: "2026-11-03" }),
      entry({ id: "d2", doneAt: "2026-11-04" }),
    ]);
    expect(open.map((e) => e.id)).toEqual(["1", "2"]);
    expect(done.map((e) => e.id)).toEqual(["d2", "d1"]);
  });
});

describe("listCaption", () => {
  it("says what's on it", () => expect(listCaption(["a", "b", "c", "d"], 0)).toBe("a, b, c…"));
  it("says when it's all done", () => expect(listCaption([], 2)).toBe("All done"));
  it("says when it's empty", () => expect(listCaption([], 0)).toBe("Nothing on it yet"));
});

describe("visibilityLine", () => {
  it("is plain about private lists", () => expect(visibilityLine("me", "Home", true, null)).toMatch(/Nobody else/));
  it("names the owner for someone else's shared list", () =>
    expect(visibilityLine("household", "The Riverside House", false, "Michele")).toBe(
      "Michele's list, shared with everyone in The Riverside House.",
    ));
  it("falls back for an unknown kind", () => expect(kindInfo("nope" as never).kind).toBe("todo"));
});
