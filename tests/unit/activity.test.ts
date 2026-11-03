import { describe, expect, it } from "vitest";
import { activitySentence, groupByDay } from "@/lib/domain/activity";

describe("activitySentence", () => {
  it("describes adds and removals with units", () => {
    expect(activitySentence({ action: "add", delta: 2, itemName: "Chicken curry", unit: "portion", at: "" })).toBe("added 2 portions of Chicken curry");
    expect(activitySentence({ action: "remove", delta: -1, itemName: "Peas", unit: "pack", at: "" })).toBe("took out 1 pack of Peas");
    expect(activitySentence({ action: "add", delta: 4, itemName: "Chicken breasts", unit: "item", at: "" })).toBe("added 4 × Chicken breasts");
    expect(activitySentence({ action: "remove", delta: -1, itemName: "Leg of lamb", unit: "item", at: "" })).toBe("took out Leg of lamb");
    expect(activitySentence({ action: "undo", delta: 1, itemName: "Peas", unit: "pack", at: "" })).toBe("undid a change to Peas");
  });
});

describe("groupByDay", () => {
  it("labels today and yesterday and keeps order", () => {
    const now = new Date(2026, 10, 3, 15, 0);
    const rows = [
      { at: new Date(2026, 10, 3, 12).toISOString() },
      { at: new Date(2026, 10, 3, 9).toISOString() },
      { at: new Date(2026, 10, 2, 20).toISOString() },
      { at: new Date(2026, 9, 30, 8).toISOString() },
    ];
    const g = groupByDay(rows, now);
    expect(g.map((x) => x.label.split(" ")[0])).toEqual(["Today", "Yesterday", "Friday"]);
    expect(g[0]!.rows).toHaveLength(2);
  });
});
