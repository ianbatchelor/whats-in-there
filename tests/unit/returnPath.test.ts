import { describe, expect, it } from "vitest";
import { safeReturnPath } from "@/lib/domain/returnPath";

describe("safeReturnPath", () => {
  it("keeps paths inside the app", () => {
    expect(safeReturnPath("/")).toBe("/");
    expect(safeReturnPath("/place/?id=abc")).toBe("/place/?id=abc");
    expect(safeReturnPath("/invite/?token=abc_DEF-123")).toBe("/invite/?token=abc_DEF-123");
    expect(safeReturnPath("/l/?c=AbCdE12345")).toBe("/l/?c=AbCdE12345");
  });

  it("refuses anything that could leave the app", () => {
    for (const bad of [
      null,
      "",
      "https://evil.example",
      "//evil.example",
      "/\\evil.example",
      "/\\/evil.example",
      "\\\\evil.example",
      "/\t/evil.example",
      "javascript:alert(1)",
      "evil.example",
    ]) {
      expect(safeReturnPath(bad)).toBe("/");
    }
  });
});
