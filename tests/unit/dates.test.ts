import { describe, expect, it } from "vitest";
import { formatDay, monthsBetween, parseIsoDate, storageAge, todayIso } from "@/lib/domain/dates";

describe("formatDay", () => {
  it("writes the month as a word so day and month can't be swapped", () => {
    expect(formatDay("2026-11-03")).toBe("03 Nov 2026");
    expect(formatDay("2026-03-11")).toBe("11 Mar 2026");
    expect(formatDay("2026-11-03", { year: false })).toBe("03 Nov");
  });
  it("accepts timestamps and ignores the time", () => {
    expect(formatDay("2026-11-03T23:59:00Z")).toBe("03 Nov 2026");
  });
  it("leaves missing or impossible dates blank rather than guessing", () => {
    expect(formatDay(null)).toBe("");
    expect(formatDay("")).toBe("");
    expect(formatDay("2026-02-30")).toBe("");
    expect(formatDay("03/11/2026")).toBe("");
  });
});

describe("parseIsoDate", () => {
  it("handles leap years", () => {
    expect(parseIsoDate("2028-02-29")).toEqual({ y: 2028, m: 2, d: 29 });
    expect(parseIsoDate("2026-02-29")).toBeNull();
  });
});

describe("storage age", () => {
  it("counts whole months", () => {
    expect(monthsBetween("2026-06-02", "2026-11-03")).toBe(5);
    expect(monthsBetween("2026-06-04", "2026-11-03")).toBe(4);
  });
  it("describes time in storage without safety claims", () => {
    expect(storageAge("2026-11-03", "2026-11-03")).toBe("today");
    expect(storageAge("2026-11-02", "2026-11-03")).toBe("1 day");
    expect(storageAge("2026-10-10", "2026-11-03")).toBe("3 weeks");
    expect(storageAge("2026-06-02", "2026-11-03")).toBe("5 months");
    expect(storageAge("2025-04-01", "2026-11-03")).toBe("over a year");
    expect(storageAge(null)).toBe("");
  });
});

describe("todayIso", () => {
  it("uses local calendar date", () => {
    expect(todayIso(new Date(2026, 10, 3, 23, 30))).toBe("2026-11-03");
  });
});
