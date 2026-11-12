import { describe, expect, it } from "vitest";
import { STARTER_THINGS, startersFor } from "@/lib/domain/suggestions";

describe("starter things for an empty place", () => {
  it("has a few for every kind of place", () => {
    for (const list of Object.values(STARTER_THINGS)) expect(list.length).toBeGreaterThanOrEqual(3);
  });
  it("leaves out what's already there, whatever the case", () => {
    expect(startersFor("car", [" ice SCRAPER "])).toEqual(["First aid kit", "Jump leads", "Phone charger"]);
  });
});
