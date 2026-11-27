import { describe, expect, it } from "vitest";
import { listInviteMessage, listInviteUrl, looksLikeEmail, readListToken } from "@/lib/domain/listViewers";
import { friendlyError } from "@/lib/supabase/errors";

describe("one present list shared with someone", () => {
  it("makes and reads invitation links", () => {
    const t = "abcDEF123_-abcDEF123_-abcDEF12";
    const url = listInviteUrl("https://seewhatsinhere.com/", t);
    expect(url).toBe(`https://seewhatsinhere.com/list-invite/?t=${t}`);
    expect(readListToken(new URL(url).search)).toBe(t);
    expect(readListToken("?t=short")).toBeNull();
    expect(readListToken("?t=<script>alert(1)</script>xxxxxxxxxxxx")).toBeNull();
  });

  it("checks email addresses loosely", () => {
    expect(looksLikeEmail(" carol@aol.com ")).toBe(true);
    expect(looksLikeEmail("carol@aol")).toBe(false);
    expect(looksLikeEmail("carol aol.com")).toBe(false);
  });

  it("says what the link is for", () => {
    expect(listInviteMessage("Michele", "https://x/list-invite/?t=1")).toContain("Michele's present list");
  });

  it("explains invitation problems plainly", () => {
    expect(friendlyError({ message: "own_list" })).toMatch(/whose list it is/);
    expect(friendlyError({ message: "wrong_email" })).toMatch(/different email/);
  });
});
