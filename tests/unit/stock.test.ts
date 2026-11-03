import { describe, expect, it } from "vitest";
import { likePattern, sortUseFirst, useFirstKey } from "@/lib/domain/stock";

const base = { useByDate: null, bestBeforeDate: null, frozenAt: null, addedAt: "2026-11-01T10:00:00Z" };

describe("use first order", () => {
  it("puts dates printed within two weeks first, then the longest stored", () => {
    const items = [
      { ...base, id: "new", frozenAt: "2026-10-30" },
      { ...base, id: "old", frozenAt: "2026-03-02" },
      { ...base, id: "bb-far", bestBeforeDate: "2027-01-01", addedAt: "2026-10-31T10:00:00Z" },
      { ...base, id: "bb-soon", bestBeforeDate: "2026-11-12" },
      { ...base, id: "useby", useByDate: "2026-11-09" },
    ];
    expect(sortUseFirst(items, "2026-11-03").map((i) => i.id)).toEqual(["useby", "bb-soon", "old", "new", "bb-far"]);
  });

  it("falls back to the day it was added", () => {
    expect(useFirstKey(base, "2026-11-03")).toBe("12026-11-01");
  });
});

describe("search pattern", () => {
  it("escapes wildcards and strips characters that break the filter", () => {
    expect(likePattern(" 50% off_cut ")).toBe("%50\\% off\\_cut%");
    expect(likePattern("pie (beef), large")).toBe("%pie beef large%");
  });
});
