import { describe, expect, it } from "vitest";
import { checkRemoval, formatQuantity, roundQty } from "@/lib/domain/quantity";

describe("checkRemoval", () => {
  it("three minus one leaves two", () => {
    expect(checkRemoval(3, 1, "item")).toEqual({ ok: true, remaining: 2 });
  });
  it("supports partial removal by weight without float drift", () => {
    expect(checkRemoval(0.9, 0.35, "kg")).toEqual({ ok: true, remaining: 0.55 });
    expect(roundQty(0.1 + 0.2)).toBe(0.3);
  });
  it("refuses removing more than is left", () => {
    expect(checkRemoval(2, 3, "item")).toEqual({ ok: false, reason: "insufficient_quantity" });
  });
  it("refuses zero, negative and odd fractions of counted items", () => {
    expect(checkRemoval(2, 0, "item").ok).toBe(false);
    expect(checkRemoval(2, -1, "item").ok).toBe(false);
    expect(checkRemoval(2, 0.3, "portion").ok).toBe(false);
    expect(checkRemoval(2, 0.5, "portion")).toEqual({ ok: true, remaining: 1.5 });
  });
});

describe("formatQuantity", () => {
  it("pluralises counted units and keeps metric units short", () => {
    expect(formatQuantity(1, "item")).toBe("1 item");
    expect(formatQuantity(4, "portion")).toBe("4 portions");
    expect(formatQuantity(1.8, "kg")).toBe("1.8 kg");
    expect(formatQuantity(0.55, "kg")).toBe("0.55 kg");
  });
});
