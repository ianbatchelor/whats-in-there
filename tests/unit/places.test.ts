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

import { recentPlaces, soonCounts, usedSections } from "@/lib/domain/places";

describe("recentPlaces", () => {
  it("keeps the newest entry per place", () => {
    const rows = [
      { locationId: "a", at: "2026-11-01T10:00:00Z" },
      { locationId: "b", at: "2026-11-03T10:00:00Z" },
      { locationId: "a", at: "2026-11-02T10:00:00Z" },
      { locationId: null, at: "2026-11-04T10:00:00Z" },
    ];
    expect(recentPlaces(rows).map((r) => [r.locationId, r.at.slice(0, 10)])).toEqual([
      ["b", "2026-11-03"],
      ["a", "2026-11-02"],
    ]);
  });
});

describe("soonCounts", () => {
  it("counts things with either printed date on or before the cutoff", () => {
    const m = soonCounts(
      [
        { locationId: "a", useByDate: "2026-11-05", bestBeforeDate: null },
        { locationId: "a", useByDate: null, bestBeforeDate: "2027-01-01" },
        { locationId: "b", useByDate: null, bestBeforeDate: "2026-11-17" },
      ],
      "2026-11-17",
    );
    expect(m.get("a")).toBe(1);
    expect(m.get("b")).toBe(1);
  });
});

describe("usedSections", () => {
  it("lists only sections in use, in order", () => {
    expect(usedSections([{ id: "1", name: "x", type: "garden", itemCount: 0 }, { id: "2", name: "y", type: "freezer", itemCount: 0 }])).toEqual(["kitchen", "garden"]);
  });
});
