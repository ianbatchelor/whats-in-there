import { describe, expect, it } from "vitest";
import { buildInviteUrl, readInviteToken } from "@/lib/domain/invite";
import { friendlyError } from "@/lib/supabase/errors";

const token = "q3J9kV0xP_2mZ-7aB4cD6eF8gH1iJ3kL5mN7oP9qR0s";

describe("invitation links", () => {
  it("round-trips a token", () => {
    const url = buildInviteUrl("https://seewhatsinhere.com/", token);
    expect(url).toBe(`https://seewhatsinhere.com/invite/?token=${token}`);
    expect(readInviteToken(new URL(url).search)).toBe(token);
  });
  it("ignores malformed tokens", () => {
    expect(readInviteToken("?token=short")).toBeNull();
    expect(readInviteToken("?token=<script>alert(1)</script>aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")).toBeNull();
    expect(readInviteToken("")).toBeNull();
  });
});

describe("friendlyError", () => {
  it("translates database codes", () => {
    expect(friendlyError({ message: "invitation_expired" })).toMatch(/expired/);
    expect(friendlyError({ message: "insufficient_quantity" })).toMatch(/isn't that much left/);
  });
  it("never leaks raw errors", () => {
    expect(friendlyError(new Error('relation "x" does not exist'))).toBe("Something went wrong. Please try again.");
  });
});
