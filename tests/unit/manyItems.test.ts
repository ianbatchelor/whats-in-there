import { describe, expect, it } from "vitest";
import { groupByCategory, listError, looksLikeBooks, markAlreadyHere, mergeLists, readList, surname, titleKey } from "@/lib/domain/manyItems";
import { itemKind } from "@/lib/domain/itemKind";

const shelf = {
  readable: true,
  kind: "books",
  items: [
    { name: "  Wolf   Hall ", detail: "Hilary Mantel", category: "Fiction", quantity: 1, unsure: false },
    { name: "The Hobbit", detail: "J.R.R. Tolkien", category: "Sci-fi & fantasy", quantity: 1, unsure: false },
    { name: "Bring Up the Bodies", detail: "Hilary Mantel", category: "Fiction", quantity: 1, unsure: true },
    { name: "Wolf Hall", detail: "hilary mantel", category: "Fiction", quantity: 1, unsure: false },
    { name: "", detail: "Nobody", category: "Fiction", quantity: 1, unsure: false },
    { name: "Atlas", detail: null, category: "", quantity: 400, unsure: false },
    "nonsense",
  ],
};

describe("readList", () => {
  it("cleans the reader's list and merges repeats from overlapping photos", () => {
    const list = readList(shelf)!;
    expect(list.kind).toBe("books");
    expect(list.items.map((i) => [i.name, i.detail, i.category, i.quantity, i.unsure])).toEqual([
      ["Wolf Hall", "Hilary Mantel", "Fiction", 2, false],
      ["The Hobbit", "J.R.R. Tolkien", "Sci-fi & fantasy", 1, false],
      ["Bring Up the Bodies", "Hilary Mantel", "Fiction", 1, true],
      ["Atlas", "", "Other", 99, false],
    ]);
    expect(list.items.every((i) => i.include && !i.already)).toBe(true);
    expect(new Set(list.items.map((i) => i.key)).size).toBe(4);
  });

  it("returns null for nothing usable", () => {
    expect(readList(null)).toBeNull();
    expect(readList({ items: [] })).toBeNull();
    expect(readList({ items: [{ name: "  " }] })).toBeNull();
    expect(readList({ kind: "weird", items: [{ name: "Lamp" }] })?.kind).toBe("other");
  });
});

describe("markAlreadyHere and mergeLists", () => {
  it("unticks things already recorded in the place", () => {
    const items = readList(shelf)!.items;
    const marked = markAlreadyHere(items, [{ productName: "wolf hall", brand: "Hilary Mantel" }, { productName: "Atlas", brand: null }]);
    expect(marked.filter((i) => i.already).map((i) => i.name)).toEqual(["Wolf Hall", "Atlas"]);
    expect(marked.find((i) => i.name === "Wolf Hall")!.include).toBe(false);
    expect(marked.find((i) => i.name === "The Hobbit")!.include).toBe(true);
  });

  it("adds a second photo's things without repeating the first's", () => {
    const first = readList(shelf)!.items;
    const second = readList({ items: [{ name: "The Hobbit", detail: "J.R.R. Tolkien", category: "Fantasy" }, { name: "Emma", detail: "Jane Austen", category: "Fiction" }] })!.items;
    expect(mergeLists(first, second).map((i) => i.name)).toEqual(["Wolf Hall", "The Hobbit", "Bring Up the Bodies", "Atlas", "Emma"]);
  });
});

describe("sorting", () => {
  it("puts sections A to Z with Other last, books by author's surname then title", () => {
    const items = readList(shelf)!.items;
    const groups = groupByCategory(items, (i) => i, true);
    expect(groups.map((g) => g.category)).toEqual(["Fiction", "Sci-fi & fantasy", "Other"]);
    expect(groups[0]!.items.map((i) => i.name)).toEqual(["Bring Up the Bodies", "Wolf Hall"]);
  });

  it("sorts other things by name, ignoring a leading 'The'", () => {
    const groups = groupByCategory(
      [
        { name: "The North Face jacket", detail: "", category: "Coats & jackets" },
        { name: "Barbour wax jacket", detail: "", category: "Coats & jackets" },
        { name: "Navy jumper", detail: "Zara", category: "Jumpers & knitwear" },
      ],
      (i) => i,
      false,
    );
    expect(groups[0]!.items.map((i) => i.name)).toEqual(["Barbour wax jacket", "The North Face jacket"]);
  });

  it("keeps the given order when asked, so an edited list doesn't jump", () => {
    const items = [
      { name: "Zebra", detail: "", category: "A" },
      { name: "Apple", detail: "", category: "A" },
    ];
    expect(groupByCategory(items, (i) => i, false, false)[0]!.items.map((i) => i.name)).toEqual(["Zebra", "Apple"]);
  });

  it("knows surnames, bookshop titles and book sections", () => {
    expect(surname("J.R.R. Tolkien")).toBe("tolkien");
    expect(titleKey("The Hobbit")).toBe("hobbit");
    expect(looksLikeBooks(["Fiction", "Crime & thrillers", "History"])).toBe(true);
    expect(looksLikeBooks(["Coats & jackets", "Shoes"])).toBe(false);
  });
});

describe("item icons for shelves and rails", () => {
  it("lets the section decide over words in a title", () => {
    expect(itemKind("The Garden Party", "Fiction")).toBe("paper");
    expect(itemKind("Navy cardigan", "Jumpers & knitwear")).toBe("clothes");
    expect(itemKind("White T-shirt", null)).toBe("clothes");
    expect(itemKind("Garden peas", null)).toBe("veg");
  });
});

it("explains reader errors for whole shelves", () => {
  expect(listError("needs_update")).toMatch(/latest update/);
  expect(listError("whatever")).toMatch(/try again/i);
});
