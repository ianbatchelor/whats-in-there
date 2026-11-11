import { describe, expect, it } from "vitest";
import { fromStock, isAlreadyOnList, listPreview, splitList, type ShoppingItem } from "@/lib/domain/shopping";

const row = (name: string, addedAt: string, boughtAt: string | null = null): ShoppingItem => ({
  id: name,
  name,
  brand: null,
  category: null,
  quantity: 1,
  unit: "item",
  locationId: null,
  addedBy: null,
  addedAt,
  boughtAt,
  boughtBy: null,
});

describe("shopping list", () => {
  it("lists what's to buy in the order it ran out, then the basket, latest first", () => {
    const { toBuy, bought } = splitList([row("Eggs", "2026-11-02"), row("Milk", "2026-11-01"), row("Bread", "2026-11-01", "2026-11-03"), row("Jam", "2026-11-01", "2026-11-04")]);
    expect(toBuy.map((i) => i.name)).toEqual(["Milk", "Eggs"]);
    expect(bought.map((i) => i.name)).toEqual(["Jam", "Bread"]);
  });

  it("puts one of a used-up thing on the list, in the same kind of amount", () => {
    expect(fromStock({ productName: " Greek yoghurt ", brand: "Fage", category: "Dairy", unit: "pack", locationId: "p2" })).toEqual({
      name: "Greek yoghurt",
      brand: "Fage",
      category: "Dairy",
      quantity: 1,
      unit: "pack",
      locationId: "p2",
    });
    // 500 g of blackberries becomes "blackberries", not "1 g".
    expect(fromStock({ productName: "Blackberries", brand: null, category: null, unit: "g", locationId: "p1" }).unit).toBe("item");
  });

  it("previews the list in a sentence", () => {
    expect(listPreview([])).toBe("");
    expect(listPreview(["Milk"])).toBe("Milk");
    expect(listPreview(["Milk", "Eggs"])).toBe("Milk and Eggs");
    expect(listPreview(["Milk", "Eggs", "Bread"])).toBe("Milk, Eggs and Bread");
    expect(listPreview(["Milk", "Eggs", "Bread", "Jam", "Tea"])).toBe("Milk, Eggs, Bread and 2 more");
  });

  it("knows when something is already on the list", () => {
    expect(isAlreadyOnList({ code: "23505", message: "duplicate key" })).toBe(true);
    expect(isAlreadyOnList({ code: "42501", message: "permission denied" })).toBe(false);
    expect(isAlreadyOnList(null)).toBe(false);
  });
});
