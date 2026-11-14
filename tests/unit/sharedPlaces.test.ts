import { describe, expect, it } from "vitest";
import { placeJoinMessage, placeJoinUrl, readPlaceToken, usersLine } from "@/lib/domain/sharedPlaces";

describe("place links", () => {
  const token = "abcDEF123_-abcDEF123_-abcDEF123_-abcDEF123_-";
  it("builds and reads the link", () => {
    const url = placeJoinUrl("https://seewhatsinhere.com/", token);
    expect(url).toBe(`https://seewhatsinhere.com/join-place/?t=${token}`);
    expect(readPlaceToken(new URL(url).search)).toBe(token);
  });
  it("refuses tokens that aren't ours", () => {
    expect(readPlaceToken("?t=short")).toBeNull();
    expect(readPlaceToken("?t=<script>alert(1)</script>xxxxxxxxxxxxxxxx")).toBeNull();
    expect(readPlaceToken("")).toBeNull();
  });
  it("says which place in the message", () => {
    expect(placeJoinMessage("Garage freezer", "https://x/")).toContain("only see the Garage freezer");
  });
});

describe("usersLine", () => {
  it("names who else uses a place", () => {
    expect(usersLine([])).toBeNull();
    expect(usersLine(["Molly"])).toBe("Molly uses this too");
    expect(usersLine(["Molly", "Carol"])).toBe("Molly and Carol use this too");
    expect(usersLine(["Molly", "Carol", "Pal"])).toBe("Molly and 2 others use this too");
  });
});
