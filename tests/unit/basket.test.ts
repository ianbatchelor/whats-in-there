import { describe, expect, it } from "vitest";
import { basketLine } from "@/lib/domain/basket";

describe("basketLine", () => {
  it("puts everything away in one go when each thing has a place", () => {
    expect(basketLine(1, 1)).toMatchObject({ title: "1 thing bought", button: "Put it away" });
    expect(basketLine(3, 3)).toMatchObject({ title: "3 things bought", button: "Put them away" });
  });

  it("says how many still need a place", () => {
    expect(basketLine(3, 2)).toEqual({ title: "3 things bought", button: "Put 2 away", choose: "Choose where 1 thing goes on the shopping list" });
    expect(basketLine(2, 0).choose).toBe("Choose where 2 things go on the shopping list");
  });
});
