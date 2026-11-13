import { describe, expect, it } from "vitest";
import { itemStatus, needsAttention } from "@/lib/domain/status";
import { itemKind } from "@/lib/domain/itemKind";

const T = "2026-11-10";
const none = { useByDate: null, bestBeforeDate: null, frozenAt: null };

describe("itemStatus", () => {
  it("flags things past a printed date", () => {
    expect(itemStatus({ ...none, bestBeforeDate: "2026-11-09" }, T)).toMatchObject({ tone: "late", label: "1 day past", detail: "Best before 9 Nov 2026" });
    expect(itemStatus({ ...none, useByDate: "2026-10-01" }, T)).toMatchObject({ tone: "late", label: "5 weeks past" });
    expect(itemStatus({ ...none, useByDate: "2025-10-01" }, T)?.label).toBe("over a year past");
  });
  it("counts down inside the use-soon window", () => {
    expect(itemStatus({ ...none, useByDate: T }, T)).toMatchObject({ tone: "soon", label: "Use today" });
    expect(itemStatus({ ...none, useByDate: "2026-11-11" }, T)?.label).toBe("Use by tomorrow");
    expect(itemStatus({ ...none, useByDate: "2026-11-12" }, T)).toMatchObject({ tone: "soon", label: "Use in 2 days", detail: "Use by 12 Nov 2026" });
    expect(itemStatus({ ...none, bestBeforeDate: "2026-11-24" }, T)?.tone).toBe("soon");
  });
  it("shows a short date when there is plenty of time", () => {
    expect(itemStatus({ ...none, bestBeforeDate: "2026-12-20" }, T)).toMatchObject({ tone: "ok", label: "20 Dec" });
    expect(itemStatus({ ...none, bestBeforeDate: "2027-05-29" }, T)).toMatchObject({ tone: "ok", label: "May 2027" });
  });
  it("uses the earlier of two printed dates", () => {
    expect(itemStatus({ ...none, useByDate: "2026-11-12", bestBeforeDate: "2027-01-01" }, T)?.label).toBe("Use in 2 days");
  });
  it("describes time in the freezer when nothing is printed", () => {
    expect(itemStatus({ ...none, frozenAt: "2026-08-10" }, T)).toMatchObject({ tone: "plain", label: "3 months in" });
    expect(itemStatus({ ...none, frozenAt: "2026-04-24" }, T)).toMatchObject({ tone: "soon", label: "6 months in" });
    expect(itemStatus({ ...none, frozenAt: T }, T)?.label).toBe("Frozen today");
  });
  it("says nothing when there are no dates", () => {
    expect(itemStatus(none, T)).toBeNull();
  });
});

describe("needsAttention", () => {
  it("is about printed dates only", () => {
    expect(needsAttention({ ...none, bestBeforeDate: "2026-11-09" }, T)).toBe(true);
    expect(needsAttention({ ...none, useByDate: "2026-11-14" }, T)).toBe(true);
    expect(needsAttention({ ...none, bestBeforeDate: "2027-05-29" }, T)).toBe(false);
    expect(needsAttention({ ...none, frozenAt: "2026-01-01" }, T)).toBe(false);
    expect(needsAttention(none, T)).toBe(false);
  });
});

describe("itemKind", () => {
  it("guesses a kind from everyday names", () => {
    expect(itemKind("Beef mince")).toBe("meat");
    expect(itemKind("Mature cheddar")).toBe("cheese");
    expect(itemKind("Free-range eggs")).toBe("egg");
    expect(itemKind("Greek yoghurt")).toBe("dairy");
    expect(itemKind("Garden peas")).toBe("veg");
    expect(itemKind("Vanilla ice cream")).toBe("frozen");
    expect(itemKind("Rioja Reserva 2018")).toBe("wine");
    expect(itemKind("Chopped tomatoes")).toBe("veg");
    expect(itemKind("Winter coats")).toBe("clothes");
    expect(itemKind("Christmas lights")).toBe("light");
    expect(itemKind("Spare light bulbs")).toBe("light");
    expect(itemKind("Tulip bulbs")).toBe("garden");
    expect(itemKind("Photo albums")).toBe("paper");
    expect(itemKind("Salmon fillets")).toBe("fish");
  });
  it("falls back to a plain thing", () => {
    expect(itemKind("Baubles")).toBe("thing");
    expect(itemKind("")).toBe("thing");
  });
});
