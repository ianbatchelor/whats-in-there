import { describe, expect, it } from "vitest";
import { gatherAccess, shortNames } from "@/lib/domain/access";
import type { OwnList } from "@/lib/domain/ownLists";

const members = [
  { userId: "ian", role: "owner" as const, displayName: "Ian Batchelor" },
  { userId: "michele", role: "member" as const, displayName: "Michele" },
  { userId: "molly", role: "family" as const, displayName: "Molly" },
  { userId: "carol", role: "family" as const, displayName: "Carol" },
];
const places = [
  { id: "garage", name: "Garage freezer" },
  { id: "drawer", name: "Top drawer", parentId: "garage" },
  { id: "wine", name: "Wine rack" },
];
const list = (id: string, title: string, visibility: OwnList["visibility"], householdId: string | null = "h"): OwnList => ({
  id, owner: "ian", householdId, title, kind: "todo", visibility, createdAt: "2026-11-14",
});

describe("who sees what", () => {
  const access = gatherAccess({
    me: "ian",
    householdId: "h",
    members,
    places,
    guests: [
      { locationId: "garage", userId: "molly" },
      { locationId: "drawer", userId: "pat" },
      { locationId: "garage", userId: "michele" },
    ],
    names: new Map([["pat", "Pat Smith"]]),
    lists: [list("x", "Christmas dinner", "family"), list("b", "Book club", "group", null), list("p", "Packing", "me", null)],
    listPeople: [
      { listId: "b", userId: "ian", name: "Ian", isOwner: true },
      { listId: "b", userId: "priya", name: "Priya", isOwner: false },
    ],
    linked: [{ kind: "presents", forUser: "michele", name: null }, { kind: "books", forUser: "ian", name: null }],
  });

  it("says what each family member sees", () => {
    expect(access.family.get("molly")).toEqual(["Garage freezer", "Christmas dinner"]);
    expect(access.family.get("carol")).toEqual(["Christmas dinner"]);
  });

  it("lists people outside the home, with a box counted as its place", () => {
    expect(access.outsiders).toEqual([
      { userId: "pat", name: "Pat Smith", sees: ["Garage freezer"] },
      { userId: "priya", name: "Priya", sees: ["Book club"] },
    ]);
  });

  it("marks shared places and lists, but not for people at home", () => {
    expect(access.placeGuests.get("garage")).toEqual(["Molly", "Pat"]);
    expect(access.placeGuests.has("wine")).toBe(false);
    expect(access.listGuests.get("x")).toEqual(["Molly", "Carol"]);
    expect(access.listGuests.get("b")).toEqual(["Priya"]);
    expect(access.listGuests.has("p")).toBe(false);
  });

  it("names lists anyone with the link can open", () => {
    expect(access.links).toEqual(["Michele's wish list", "Your book wish list"]);
  });

  it("shortens names", () => {
    expect(shortNames(["Jo"])).toBe("Jo");
    expect(shortNames(["Jo", "Carol"])).toBe("Jo and Carol");
    expect(shortNames(["A", "B", "C", "D"])).toBe("A, B and 2 more");
  });
});

import { countdown, daysToChristmas, isChristmasTime, isChristmassy, presentProgress, progressLine } from "@/lib/domain/christmas";

describe("Christmas", () => {
  it("counts the days", () => {
    expect(daysToChristmas(new Date(2026, 10, 14))).toBe(41);
    expect(daysToChristmas(new Date(2026, 11, 25))).toBe(0);
    expect(daysToChristmas(new Date(2026, 11, 27))).toBe(363);
    expect(countdown(1)).toBe("Christmas is tomorrow");
  });

  it("knows when it's Christmas time", () => {
    expect(isChristmasTime(new Date(2026, 10, 1))).toBe(true);
    expect(isChristmasTime(new Date(2026, 11, 26))).toBe(true);
    expect(isChristmasTime(new Date(2026, 11, 27))).toBe(false);
    expect(isChristmasTime(new Date(2026, 9, 31))).toBe(false);
  });

  it("spots Christmas things", () => {
    expect(isChristmassy("Christmas dinner")).toBe(true);
    expect(isChristmassy("Tree decorations")).toBe(true);
    expect(isChristmassy("Camping stove")).toBe(false);
  });

  it("tracks who's getting what", () => {
    const list = (id: string, forUser: string) => ({ id, kind: "presents" as const, friend: false, forUser, name: null, shareCode: null, createdAt: "" });
    const idea = (id: string, listId: string) => ({ id, listId } as never);
    const people = [
      { userId: "me", name: "Me", list: list("l1", "me") },
      { userId: "alex", name: "Alex", list: list("l2", "alex") },
    ];
    const got = presentProgress(people, [idea("a", "l1"), idea("b", "l2"), idea("c", "l2")], [{ ideaId: "b", claimedBy: "me", claimedName: null }], "me");
    expect(progressLine(got[0]!, true)).toBe("1 idea on your list");
    expect(progressLine(got[1]!, false)).toBe("You're getting 1 · 1 of 2 taken");
  });
});

import { haveAlready, haveLine, sameThing } from "@/lib/domain/haveAlready";

describe("check before you buy", () => {
  it("matches names loosely", () => {
    expect(sameThing("Milk", "Semi-skimmed milk")).toBe(true);
    expect(sameThing("eggs", "Free-range egg")).toBe(true);
    expect(sameThing("Peas", "Garden peas")).toBe(true);
    expect(sameThing("Coffee beans", "Coffee")).toBe(false);
    expect(sameThing("Bin bags", "Bin bag")).toBe(true);
  });

  it("says how many and where", () => {
    const names = new Map([["a", "Garage freezer"], ["b", "Kitchen freezer"]]);
    const h = haveAlready("peas", [
      { name: "Garden peas", quantity: 2, unit: "item", locationId: "a" },
      { name: "Petits pois", quantity: 1, unit: "item", locationId: "b" },
    ], (id) => names.get(id));
    expect(h && haveLine(h)).toBe("You have 2 in Garage freezer");
    expect(haveAlready("Lemons", [], () => undefined)).toBeNull();
  });
});
