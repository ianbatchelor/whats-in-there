import { describe, expect, it } from "vitest";
import { isKeepPlace, isUseUpPlace, sectionOf } from "@/lib/domain/places";
import { bookQuery, isBook } from "@/lib/domain/covers";
import { activitySentence } from "@/lib/domain/activity";
import { tookOutMessage } from "@/components/stock/useQuickTake";
import type { StockItem } from "@/lib/domain/stock";

describe("keep and use-up places", () => {
  it("splits places by whether things get used up", () => {
    for (const t of ["freezer", "fridge", "pantry", "wine", "garden", "medicine"] as const) expect(isUseUpPlace(t)).toBe(true);
    for (const t of ["bookshelf", "wardrobe", "attic", "garage", "shed", "box", "toybox", "desk", "car", "cupboard", "other"] as const) expect(isKeepPlace(t)).toBe(true);
  });
  it("files the new kinds of place", () => {
    expect(sectionOf("bookshelf")).toBe("storage");
    expect(sectionOf("car")).toBe("storage");
  });
});

describe("book covers", () => {
  it("looks for covers on bookshelves and for things filed as books", () => {
    expect(isBook({ productName: "The Hobbit", category: null }, "bookshelf")).toBe(true);
    expect(isBook({ productName: "Rebecca", category: "Fiction" }, "attic")).toBe(true);
    expect(isBook({ productName: "Rebecca", category: null }, "attic")).toBe(false);
    expect(isBook({ productName: "Monopoly", category: "Board games" }, "bookshelf")).toBe(false);
    expect(isBook({ productName: "Wedding photos", category: null }, "bookshelf")).toBe(false);
    expect(isBook({ productName: "The Hunger Games", category: null }, "bookshelf")).toBe(true);
    expect(isBook({ productName: "Winter coat", category: "Coats" }, "wardrobe")).toBe(false);
  });
  it("sends only the title and first author, and remembers by both", () => {
    expect(bookQuery("  The   Hobbit ", "J. R. R. Tolkien")).toEqual({ key: "the hobbit|j. r. r. tolkien", title: "The Hobbit", author: "J. R. R. Tolkien" });
    expect(bookQuery("Good Omens", "Terry Pratchett and Neil Gaiman").author).toBe("Terry Pratchett");
    expect(bookQuery("Big Book", "Ann Lee and others").author).toBe("Ann Lee");
    expect(bookQuery("Atlas", null)).toEqual({ key: "atlas|", title: "Atlas", author: null });
  });
});

describe("lending", () => {
  it("reads like a diary", () => {
    expect(activitySentence({ action: "lend", delta: 0, itemName: "The Hobbit", unit: "item", at: "", person: "Mum" })).toBe("lent The Hobbit to Mum");
    expect(activitySentence({ action: "return", delta: 0, itemName: "The Hobbit", unit: "item", at: "", person: "Mum" })).toBe("got The Hobbit back from Mum");
  });
});

describe("removing things you keep", () => {
  const book = { productName: "The Hobbit", unit: "item", quantity: 1 } as StockItem;
  it("says removed, not took out", () => {
    expect(tookOutMessage(book, { ...book, quantity: 0 }, 1, true)).toBe("Removed The Hobbit from the list");
    expect(tookOutMessage({ ...book, quantity: 3 }, { ...book, quantity: 2 }, 1, true)).toBe("Removed 1 × The Hobbit, 2 left");
    expect(tookOutMessage(book, { ...book, quantity: 0 }, 1)).toBe("Took out 1 item of The Hobbit, all gone");
  });
});
