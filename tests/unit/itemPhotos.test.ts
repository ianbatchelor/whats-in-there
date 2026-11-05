import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/client", () => ({ supabase: () => ({}) }));
const { thumbPath } = await import("@/lib/itemPhotos");

describe("thumbPath", () => {
  it("puts the small copy beside the photo", () => {
    expect(thumbPath("hh/labels/abc.webp")).toBe("hh/labels/abc.thumb.webp");
    expect(thumbPath("hh/labels/abc.jpg")).toBe("hh/labels/abc.thumb.jpg");
  });
  it("copes with no extension or dots in folders", () => {
    expect(thumbPath("hh/labels/abc")).toBe("hh/labels/abc.thumb");
    expect(thumbPath("h.h/labels/abc")).toBe("h.h/labels/abc.thumb");
  });
});
