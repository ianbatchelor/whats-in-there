import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/client", () => ({ supabase: () => ({}) }));

import { defaultPresentsCircle, familiesOf, homesOf, pickCurrent, type Membership } from "@/lib/household";

const flat: Membership = { householdId: "flat", name: "Molly's Flat", role: "owner" };
const dads: Membership = { householdId: "dads", name: "The Batchelor House", role: "family" };

describe("family memberships", () => {
  it("splits homes from families", () => {
    expect(homesOf([flat, dads])).toEqual([flat]);
    expect(familiesOf([flat, dads])).toEqual([dads]);
  });

  it("never makes a family household the current one", () => {
    expect(pickCurrent([dads])).toBeNull();
    expect(pickCurrent([dads, flat])).toEqual(flat);
  });

  it("shows your own home's presents first when others live there", () => {
    expect(defaultPresentsCircle([flat, dads], null, "flat")).toEqual(flat);
    expect(defaultPresentsCircle([flat, dads], null, null)).toEqual(flat);
    expect(defaultPresentsCircle([flat, dads], "dads", "flat")).toEqual(dads);
  });

  it("shows the family's presents first when you live on your own, unless you picked your own", () => {
    expect(defaultPresentsCircle([flat, dads], null, "flat", true)).toEqual(dads);
    expect(defaultPresentsCircle([flat, dads], "flat", "flat", true)).toEqual(flat);
    expect(defaultPresentsCircle([flat], null, "flat")).toEqual(flat);
    expect(defaultPresentsCircle([dads], "gone", null)).toEqual(dads);
    expect(defaultPresentsCircle([], null, null)).toBeNull();
  });
});
