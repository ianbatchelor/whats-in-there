import { describe, expect, it } from "vitest";
import { countThings, groupPlaces } from "@/lib/domain/places";

describe("groupPlaces", () => {
  it("groups by kind in first-seen order and totals the things inside", () => {
    const groups = groupPlaces([
      { id: "a", name: "Garage Freezer", type: "freezer", itemCount: 6 },
      { id: "b", name: "Attic", type: "attic", itemCount: 27 },
      { id: "c", name: "Kitchen Freezer", type: "freezer", itemCount: 3 },
    ]);
    expect(groups.map((g) => [g.type, g.places.length, g.itemCount])).toEqual([
      ["freezer", 2, 9],
      ["attic", 1, 27],
    ]);
    expect(countThings(1)).toBe("1 thing");
  });
});
