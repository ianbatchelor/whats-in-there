import { describe, expect, it } from "vitest";
import { kindFromName } from "@/lib/domain/kindFromName";

describe("kindFromName", () => {
  it("spots a bookshelf saved as a cupboard", () => {
    expect(kindFromName("Book shelf", "cupboard")).toBe("bookshelf");
    expect(kindFromName("Living room bookcase", "other")).toBe("bookshelf");
  });
  it("joins split words", () => {
    expect(kindFromName("Toy box", "box")).toBe("toybox");
    expect(kindFromName("First aid", "cupboard")).toBe("medicine");
  });
  it("leaves a place alone when its kind is already named", () => {
    expect(kindFromName("Garage freezer", "freezer")).toBeNull();
    expect(kindFromName("Bookshelf", "bookshelf")).toBeNull();
  });
  it("stays quiet when the name points two ways or nowhere", () => {
    expect(kindFromName("Garage freezer", "other")).toBeNull();
    expect(kindFromName("Blue box", "box")).toBeNull();
    expect(kindFromName("Under the stairs", "cupboard")).toBeNull();
  });
  it("doesn't read words inside other words", () => {
    expect(kindFromName("Cards and games", "cupboard")).toBeNull();
    expect(kindFromName("Scarves", "wardrobe")).toBeNull();
  });
});

describe("aKind", () => {
  it("reads naturally", async () => {
    const { aKind } = await import("@/lib/domain/kindFromName");
    expect(aKind("bookshelf")).toBe("a bookshelf");
    expect(aKind("attic")).toBe("an attic");
  });
});
