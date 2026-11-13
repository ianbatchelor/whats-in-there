import { describe, expect, it } from "vitest";
import { readLabel, readerError, validDate } from "@/lib/domain/extraction";

const today = "2026-11-03";

describe("readLabel", () => {
  it("turns a clean reading into form values", () => {
    const r = readLabel(
      {
        readable: true,
        product_name: "  Garden   Peas ",
        brand: "Birds Eye",
        quantity: 1,
        unit: "pack",
        weight_value: 750,
        weight_unit: "g",
        use_by_date: null,
        best_before_date: "2027-09-30",
        uncertain: [],
      },
      today,
    );
    expect(r).toEqual({
      productName: "Garden Peas",
      brand: "Birds Eye",
      quantity: 1,
      unit: "pack",
      weightValue: 750,
      weightUnit: "g",
      useByDate: null,
      bestBeforeDate: "2027-09-30",
      check: [],
      wine: null,
    });
  });

  it("returns null when there is no label or no name", () => {
    expect(readLabel({ readable: false, product_name: "Peas" }, today)).toBeNull();
    expect(readLabel({ readable: true, product_name: "   " }, today)).toBeNull();
    expect(readLabel(null, today)).toBeNull();
    expect(readLabel("Peas", today)).toBeNull();
  });

  it("keeps the model's doubts and adds its own", () => {
    const r = readLabel(
      {
        product_name: "Chicken curry",
        quantity: -2,
        unit: "portion",
        weight_value: 400,
        weight_unit: "stone",
        use_by_date: "2026-02-30",
        best_before_date: "2026-11-20",
        uncertain: ["best_before_date", "colour", "brand"],
      },
      today,
    )!;
    expect(r.quantity).toBe(1);
    expect(r.weightValue).toBeNull();
    expect(r.weightUnit).toBeNull();
    expect(r.useByDate).toBeNull();
    expect(r.bestBeforeDate).toBe("2026-11-20");
    expect(r.check).toEqual(["brand", "quantity", "weight", "use_by_date", "best_before_date"]);
  });

  it("falls back to items, rounds counts and caps text", () => {
    const r = readLabel({ product_name: "x".repeat(300), unit: "crate", quantity: 2.6 }, today)!;
    expect(r.unit).toBe("item");
    expect(r.quantity).toBe(3);
    expect(r.productName).toHaveLength(120);
    expect(r.check).toEqual([]);
  });

  it("keeps decimal amounts for weights", () => {
    const r = readLabel({ product_name: "Milk", unit: "l", quantity: 2.272 }, today)!;
    expect(r).toMatchObject({ unit: "l", quantity: 2.272 });
  });
});

describe("validDate", () => {
  it("accepts real dates in a sensible window", () => {
    expect(validDate("2026-11-05", today)).toBe("2026-11-05");
    expect(validDate("2026-01-01", today)).toBe("2026-01-01");
  });
  it("rejects impossible, malformed and far-off dates", () => {
    expect(validDate("2026-13-01", today)).toBeNull();
    expect(validDate("05/11/2026", today)).toBeNull();
    expect(validDate("2024-01-01", today)).toBeNull();
    expect(validDate("2040-01-01", today)).toBeNull();
    expect(validDate(20261105, today)).toBeNull();
  });
});

describe("readerError", () => {
  it("explains known codes and has a fallback", () => {
    expect(readerError("too_many_today")).toMatch(/tomorrow/);
    expect(readerError("too_many_this_month")).toMatch(/this month/);
    expect(readerError("not_configured")).toMatch(/isn't switched on/);
    expect(readerError("weird")).toMatch(/couldn't read that label/);
    expect(readerError(null)).toMatch(/couldn't read that label/);
  });
});
