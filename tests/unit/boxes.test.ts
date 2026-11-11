import { describe, expect, it } from "vitest";
import { boxesIn, nestedOrder, placeLabel, rollUp, topPlaceId } from "@/lib/domain/places";

const garage = { id: "g", name: "Garage", parentId: null, itemCount: 2 };
const blue = { id: "b", name: "Blue box", parentId: "g", itemCount: 5 };
const shelf = { id: "s", name: "Top shelf", parentId: "g", itemCount: 1 };
const freezer = { id: "f", name: "Freezer", parentId: null, itemCount: 4 };
const stray = { id: "x", name: "Old box", parentId: "gone", itemCount: 3 };
const all = [garage, blue, freezer, shelf];
const byId = new Map(all.map((p) => [p.id, p]));

describe("boxes inside places", () => {
  it("rolls boxes up into their place on Home", () => {
    expect(rollUp(all)).toEqual([
      { ...garage, itemCount: 8, boxCount: 2 },
      { ...freezer, boxCount: 0 },
    ]);
  });

  it("keeps a box whose place is missing as a place of its own", () => {
    expect(rollUp([...all, stray]).map((p) => p.id)).toEqual(["g", "f", "x"]);
    expect(nestedOrder([...all, stray]).map((r) => [r.place.id, r.inside])).toEqual([
      ["g", false],
      ["b", true],
      ["s", true],
      ["f", false],
      ["x", false],
    ]);
  });

  it("names a box with the place it's in", () => {
    expect(placeLabel(blue, byId)).toBe("Blue box, in Garage");
    expect(placeLabel(garage, byId)).toBe("Garage");
    expect(placeLabel(stray, byId)).toBe("Old box");
  });

  it("finds the place a box belongs to", () => {
    expect(topPlaceId("b", byId)).toBe("g");
    expect(topPlaceId("g", byId)).toBe("g");
    expect(topPlaceId("nowhere", byId)).toBe("nowhere");
  });

  it("lists the boxes in a place in order", () => {
    expect(boxesIn(all, "g").map((p) => p.name)).toEqual(["Blue box", "Top shelf"]);
    expect(boxesIn(all, "f")).toEqual([]);
  });
});
