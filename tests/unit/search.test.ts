import { describe, expect, it } from "vitest";
import { fold, matches, searchLists, type ListSources } from "@/lib/domain/search";
import type { WishList } from "@/lib/domain/presents";

const list = (id: string, forUser: string | null, name: string | null = null, kind: "presents" | "books" = "presents"): WishList => ({
  id,
  kind,
  friend: false,
  forUser,
  name,
  shareCode: null,
  createdAt: "2026-11-01",
});
const idea = (id: string, listId: string, title: string, author: string | null = null) => ({
  id,
  listId,
  title,
  note: null,
  link: null,
  price: null,
  favourite: false,
  imagePath: null,
  author,
  isbn: null,
  coverId: null,
  suggestedBy: null,
  addedBy: null,
  addedAt: "2026-11-01",
});

const sources: ListSources = {
  me: "u1",
  names: new Map([
    ["u1", "Ian Batchelor"],
    ["u2", "Michele"],
    ["u3", "James"],
  ]),
  shopping: [
    { id: "s1", name: "Pinot Grigio", brand: null, category: null, quantity: 1, unit: "item", locationId: null, addedBy: null, addedAt: "", boughtAt: null, boughtBy: null },
    { id: "s2", name: "Milk", brand: null, category: null, quantity: 1, unit: "item", locationId: null, addedBy: null, addedAt: "", boughtAt: "2026-11-02", boughtBy: null },
  ],
  presents: { lists: [list("p1", "u2"), list("p2", null, "Grandad")], ideas: [idea("i1", "p1", "Sherlock Holmes: The Complete Stories"), idea("i2", "p2", "Wool socks")] },
  books: { lists: [list("b1", "u3", null, "books")], ideas: [idea("k1", "b1", "The Hound of the Baskervilles", "Arthur Conan Doyle")] },
  own: {
    lists: [{ id: "l1", owner: "u1", householdId: "h", title: "Camping", kind: "todo", visibility: "household", createdAt: "" }],
    entries: [{ id: "e1", listId: "l1", text: "Passport", note: null, addedBy: null, addedAt: "", doneAt: null, doneBy: null }],
  },
};

describe("matches", () => {
  it("finds every word in any order, ignoring case and accents", () => {
    expect(matches("grig pinot", "Pinot Grigio")).toBe(true);
    expect(matches("rose", "Rosé d'Anjou")).toBe(true);
    expect(matches("pinot noir", "Pinot Grigio")).toBe(false);
    expect(fold("Crème")).toBe("creme");
  });
});

describe("searchLists", () => {
  it("says which list each thing is on and links to it", () => {
    const [hit] = searchLists("sherlock", sources);
    expect(hit).toMatchObject({ kind: "present", where: "On Michele's present ideas", href: "/presents/?for=u2" });
  });

  it("names someone without an account by their list and finds books by author", () => {
    expect(searchLists("socks", sources)[0]).toMatchObject({ where: "On Grandad's present ideas", href: "/presents/?for=p2" });
    expect(searchLists("conan doyle", sources)[0]).toMatchObject({ kind: "book", where: "On James's book wish list" });
  });

  it("finds your own lists and the shopping list, things still to do first", () => {
    expect(searchLists("passport", sources)[0]).toMatchObject({ where: "On Camping", href: "/my-list/?id=l1" });
    const milk = searchLists("milk", sources)[0]!;
    expect(milk.done).toBe(true);
    expect(searchLists("pinot", sources)[0]).toMatchObject({ kind: "shopping", where: "On the shopping list", done: false });
  });

  it("needs two letters", () => {
    expect(searchLists("p", sources)).toEqual([]);
  });
});
