import { describe, expect, it } from "vitest";
import { colourCounts, drinkSoon, parseYear, readWine, sortRack, wineKey, wineStatus, wineTitle } from "@/lib/domain/wine";
import { itemStatus, needsAttention } from "@/lib/domain/status";
import { sortUseFirst } from "@/lib/domain/stock";
import { readLabel } from "@/lib/domain/extraction";

const Y = 2026;
const none = { useByDate: null, bestBeforeDate: null, frozenAt: null };

describe("wineStatus", () => {
  it("says where a bottle is in its window", () => {
    expect(wineStatus({ drinkFrom: 2020, drinkUntil: 2025 }, Y)).toMatchObject({ tone: "late", label: "Past its best · 2025" });
    expect(wineStatus({ drinkUntil: 2026 }, Y)).toMatchObject({ tone: "soon", label: "Drink by end of 2026" });
    expect(wineStatus({ drinkFrom: 2024, drinkUntil: 2032 }, Y)).toMatchObject({ tone: "ok", label: "Ready now · until 2032", detail: "Best 2024 to 2032" });
    expect(wineStatus({ drinkFrom: 2028, drinkUntil: 2035 }, Y)).toMatchObject({ tone: "plain", label: "Keep until 2028" });
    expect(wineStatus({ drinkFrom: 2020 }, Y)).toMatchObject({ tone: "ok", label: "Ready now" });
    expect(wineStatus({}, Y)).toBeNull();
  });
  it("puts a bottle saved for something before its window", () => {
    expect(wineStatus({ drinkUntil: 2024, savedFor: "Ollie's 18th" }, Y)).toMatchObject({ label: "Saved for Ollie's 18th", saved: true });
    expect(drinkSoon({ drinkUntil: 2024, savedFor: "Ollie's 18th" }, Y)).toBe(false);
    expect(drinkSoon({ drinkUntil: 2026 }, Y)).toBe(true);
    expect(drinkSoon({ drinkUntil: 2027 }, Y)).toBe(false);
  });
  it("feeds the shared status and Needs attention", () => {
    expect(itemStatus({ ...none, drinkUntil: 2025 }, "2026-11-13")?.tone).toBe("late");
    expect(needsAttention({ ...none, drinkUntil: 2026 }, "2026-11-13")).toBe(true);
    expect(needsAttention({ ...none, drinkFrom: 2020, drinkUntil: 2030 }, "2026-11-13")).toBe(false);
  });
});

describe("drink these first", () => {
  it("orders by the end of the window, keeps and saved bottles last", () => {
    const at = "2026-01-01T00:00:00Z";
    const b = (id: string, w: object) => ({ id, ...none, addedAt: at, ...w });
    const sorted = sortUseFirst(
      [
        b("saved", { drinkUntil: 2024, savedFor: "Wedding" }),
        b("keep", { drinkFrom: 2028, drinkUntil: 2035 }),
        b("ready", { drinkFrom: 2022, drinkUntil: 2030 }),
        b("now", { drinkUntil: 2026 }),
        b("past", { drinkUntil: 2024 }),
      ],
      "2026-11-13",
    );
    expect(sorted.map((x) => x.id)).toEqual(["past", "now", "ready", "keep", "saved"]);
    expect(wineKey({}, Y)).toBeNull();
  });
});

describe("wine helpers", () => {
  it("adds the vintage to the name once", () => {
    expect(wineTitle("Château Musar", 2016)).toBe("Château Musar 2016");
    expect(wineTitle("Musar 2016", 2016)).toBe("Musar 2016");
    expect(wineTitle("Prosecco", null)).toBe("Prosecco");
  });
  it("counts bottles by colour in a fixed order", () => {
    expect(
      colourCounts([
        { wineColour: "white", quantity: 2 },
        { wineColour: "red", quantity: 3 },
        { wineColour: null, quantity: 1 },
        { wineColour: "red", quantity: 1 },
      ]),
    ).toEqual([
      { colour: "red", n: 4 },
      { colour: "white", n: 2 },
      { colour: null, n: 1 },
    ]);
  });
  it("reads typed years", () => {
    expect(parseYear("")).toBeNull();
    expect(parseYear(" 2019 ")).toBe(2019);
    expect(parseYear("19")).toBe("bad");
    expect(parseYear("1800")).toBe("bad");
  });
});

describe("reading a wine label", () => {
  it("checks every wine value from the reader", () => {
    expect(readWine({ vintage: 2031, colour: "purple", grape: "  Tempranillo ", region: "", drink_from: 2030, drink_until: 2024 }, Y)).toEqual({
      vintage: null,
      wineColour: null,
      grape: "Tempranillo",
      region: null,
      drinkFrom: 2024,
      drinkUntil: 2030,
      savedFor: null,
      guessed: true,
    });
    expect(readWine(null, Y)).toBeNull();
  });
  it("comes through readLabel", () => {
    const r = readLabel(
      {
        readable: true,
        product_name: "Château Musar",
        brand: null,
        quantity: 1,
        unit: "item",
        uncertain: ["grape"],
        wine: { vintage: 2016, colour: "red", grape: "Cinsault", region: "Bekaa Valley, Lebanon", drink_from: 2024, drink_until: 2032 },
      },
      "2026-11-13",
    );
    expect(r?.wine).toMatchObject({ vintage: 2016, wineColour: "red", drinkUntil: 2032, guessed: true });
    expect(r?.check).toContain("grape");
  });
});

describe("the wine rack order", () => {
  it("puts bottles with no window after the ready ones", () => {
    const b = (id: string, w: object) => ({ id, addedAt: "2026-01-01T00:00:00Z", ...w });
    const sorted = sortRack([b("keep", { drinkFrom: 2028 }), b("plain", {}), b("ready", { drinkFrom: 2022, drinkUntil: 2030 }), b("past", { drinkUntil: 2024 })], Y);
    expect(sorted.map((x) => x.id)).toEqual(["past", "ready", "plain", "keep"]);
  });
});
