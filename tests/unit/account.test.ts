import { describe, expect, it } from "vitest";
import { confirmsWithPassword, signInMethods } from "@/lib/account";

const token = (payload: unknown) => {
  const b64 = Buffer.from(JSON.stringify(payload)).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `header.${b64}.signature`;
};

describe("signInMethods", () => {
  it("lists how the session signed in, newest first", () => {
    const t = token({ amr: [{ method: "password", timestamp: 100 }, { method: "otp", timestamp: 200 }] });
    expect(signInMethods(t)).toEqual(["otp", "password"]);
  });

  it("copes with odd tokens", () => {
    expect(signInMethods("nonsense")).toEqual([]);
    expect(signInMethods(token({}))).toEqual([]);
  });
});

describe("confirmsWithPassword", () => {
  it("asks for a password only when the last sign-in used one", () => {
    expect(confirmsWithPassword(token({ amr: [{ method: "password", timestamp: 300 }] }))).toBe(true);
    expect(confirmsWithPassword(token({ amr: [{ method: "otp", timestamp: 300 }] }))).toBe(false);
  });
});
