import { describe, expect, it } from "vitest";
import { askBackMessage, daysLent, isLongLent, lentFor } from "@/lib/domain/lending";

describe("lending reminders", () => {
  it("counts the days something has been away", () => {
    expect(daysLent("2026-11-01", "2026-11-11")).toBe(10);
    expect(daysLent("2026-11-11", "2026-11-11")).toBe(0);
    expect(daysLent(null, "2026-11-11")).toBeNull();
  });

  it("nudges after a month away, and only for things that are lent", () => {
    expect(isLongLent({ lentTo: "Mum", lentOn: "2026-10-12" }, "2026-11-11")).toBe(true);
    expect(isLongLent({ lentTo: "Mum", lentOn: "2026-10-13" }, "2026-11-11")).toBe(false);
    expect(isLongLent({ lentTo: null, lentOn: "2026-01-01" }, "2026-11-11")).toBe(false);
    expect(isLongLent({ lentTo: "Mum", lentOn: null }, "2026-11-11")).toBe(false);
  });

  it("says how long in plain words", () => {
    expect(lentFor("2026-10-07", "2026-11-11")).toBe("1 month");
    expect(lentFor("2026-10-14", "2026-11-11")).toBe("4 weeks");
    expect(lentFor("2025-09-01", "2026-11-11")).toBe("over a year");
  });

  it("writes a friendly message using the borrower's first name", () => {
    expect(askBackMessage("Middlemarch", "Sam next door")).toBe(
      "Hi Sam, hope you're enjoying Middlemarch! Could I have it back when you're finished with it? Thanks",
    );
  });
});
