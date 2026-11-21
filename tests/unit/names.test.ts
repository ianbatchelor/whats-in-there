import { describe, expect, it } from "vitest";
import { looksLikeEmailName, whoHave } from "@/lib/domain/names";

describe("names", () => {
  it("spots a name that is just the start of an email address", () => {
    expect(looksLikeEmailName("ianbatchelor", "ianbatchelor@example.com")).toBe(true);
    expect(looksLikeEmailName("IanBatchelor ", "ianbatchelor@example.com")).toBe(true);
    expect(looksLikeEmailName("Ian", "ianbatchelor@example.com")).toBe(false);
    expect(looksLikeEmailName("Ian", undefined)).toBe(false);
  });
  it("says who has for one person and who have for more", () => {
    expect(whoHave(1)).toBe("who has");
    expect(whoHave(2)).toBe("who have");
  });
});
