import { describe, expect, it } from "vitest";
import { doneKey, dueReminders, isSouthern, liveSnoozes, seasonName } from "@/lib/domain/seasons";

const ids = (r: { id: string }[]) => r.map((x) => x.id);

describe("seasonal reminders", () => {
  it("only shows reminders for places the household has", () => {
    expect(ids(dueReminders(["fridge", "car"], "2026-11-11"))).toEqual(["car-winter"]);
    expect(dueReminders(["fridge"], "2026-11-11")).toEqual([]);
  });

  it("shows what's around today, ending soonest first", () => {
    expect(ids(dueReminders(["wardrobe", "garden", "car", "toybox"], "2026-11-11"))).toEqual(["winter-clothes", "garden-autumn", "car-winter"]);
    expect(ids(dueReminders(["wardrobe", "garden", "car", "toybox"], "2026-11-16"))).toEqual(["garden-autumn", "car-winter", "toybox-clearout"]);
  });

  it("includes the first and last day of a window", () => {
    expect(ids(dueReminders(["medicine"], "2026-03-01"))).toEqual(["medicine-check"]);
    expect(ids(dueReminders(["medicine"], "2026-03-31"))).toEqual(["medicine-check"]);
    expect(dueReminders(["medicine"], "2026-04-01")).toEqual([]);
  });

  it("knows which time round it is, so spring and autumn are ticked off separately", () => {
    expect(dueReminders(["medicine"], "2026-03-10")[0]).toMatchObject({ period: "2026-03", until: "2026-03-31" });
    expect(dueReminders(["medicine"], "2026-09-10")[0]).toMatchObject({ period: "2026-09", until: "2026-09-30" });
    expect(doneKey(dueReminders(["medicine"], "2027-03-10")[0]!)).toBe("medicine-check@2027-03");
  });

  it("turns the weather ones round in the southern hemisphere, but not the festive ones", () => {
    expect(ids(dueReminders(["car", "garden"], "2026-05-01", true))).toEqual(["garden-autumn", "car-winter"]);
    expect(ids(dueReminders(["car", "toybox"], "2026-11-20", true))).toEqual(["toybox-clearout"]);
    expect(seasonName("2026-11-11")).toBe("Autumn");
    expect(seasonName("2026-11-11", true)).toBe("Spring");
    expect(seasonName("2026-01-11")).toBe("Winter");
  });

  it("tells the hemisphere from the time zone", () => {
    expect(isSouthern("Europe/London")).toBe(false);
    expect(isSouthern("Australia/Sydney")).toBe(true);
    expect(isSouthern("America/Argentina/Buenos_Aires")).toBe(true);
    expect(isSouthern("America/New_York")).toBe(false);
    expect(isSouthern(undefined)).toBe(false);
  });

  it("forgets snoozes once they run out", () => {
    expect(liveSnoozes({ a: "2026-11-12", b: "2026-11-11", c: "2026-11-01" }, "2026-11-11")).toEqual({ a: "2026-11-12" });
  });
});
