import { describe, expect, it } from "vitest";
import { groupNames, joinUrl, kindInfo, listCaption, listsForTab, readJoinToken, splitEntries, visibilityLine, type ListEntry, type OwnList } from "@/lib/domain/ownLists";

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

describe("group lists", () => {
  it("go in their own section, with or without a household", () => {
    const lists = [list({ id: "g", visibility: "group", owner: "tom" }), list({ id: "m" })];
    expect(listsForTab(lists, "me", null)).toEqual({ mine: [lists[1]], home: [], groups: [lists[0]], family: [] });
  });
  it("name you first, then the owner", () => {
    const p = (userId: string, name: string, isOwner = false) => ({ listId: "g", userId, name, isOwner });
    expect(groupNames([p("s", "Sarah"), p("tom", "Tom", true), p("me", "Ian")], "me")).toBe("You, Tom and Sarah");
    expect(groupNames([p("me", "Ian", true)], "me")).toBe("Just you so far");
  });
  it("make and read join links", () => {
    const url = joinUrl("https://seewhatsinhere.com/", "abcdefghijklmnopqrstuvwxyz12");
    expect(url).toBe("https://seewhatsinhere.com/join/?t=abcdefghijklmnopqrstuvwxyz12");
    expect(readJoinToken(new URL(url).search)).toBe("abcdefghijklmnopqrstuvwxyz12");
    expect(readJoinToken("?t=bad token")).toBeNull();
  });
});

describe("family lists", () => {
  it("go in their own section, from any home", () => {
    const l = (id: string, householdId: string) => ({ id, owner: "dad", householdId, title: id, kind: "todo" as const, visibility: "family" as const, createdAt: "2026-11-14" });
    expect(listsForTab([l("x", "dads"), l("y", "mine")], "me", "mine").family.map((x) => x.id)).toEqual(["x", "y"]);
    expect(listsForTab([l("x", "dads")], "me", "mine").home).toEqual([]);
  });
  it("say who sees them", () => {
    expect(visibilityLine("family", "Batchelor House", false, "Ian")).toBe("Ian's list, shared with everyone in Batchelor House and family.");
    expect(visibilityLine("family", "Batchelor House", true, null)).toBe("Shared with everyone in Batchelor House and family.");
  });
});

describe("stopping", () => {
  it("says who loses sight of a list", async () => {
    const { stopping } = await import("@/components/lists/ListSettingsSheet");
    expect(stopping("family", "household")).toBe("Family");
    expect(stopping("family", "me")).toBe("Everyone at home and family");
    expect(stopping("household", "family")).toBeNull();
    expect(stopping("household", "me")).toBe("Everyone at home");
    expect(stopping("me", "family")).toBeNull();
  });
});
