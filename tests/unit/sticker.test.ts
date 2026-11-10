import { describe, expect, it } from "vitest";
import { isStickerCode, stickerCodeFrom, stickerLink, stickerRoute } from "@/lib/domain/sticker";

describe("sticker links", () => {
  it("reads the code from a sticker address", () => {
    expect(stickerCodeFrom("/l/Ab3dE5gH9k")).toBe("Ab3dE5gH9k");
    expect(stickerCodeFrom("/l/Ab3dE5gH9k/")).toBe("Ab3dE5gH9k");
    expect(stickerCodeFrom("/l/", "?c=Ab3dE5gH9k")).toBe("Ab3dE5gH9k");
    expect(stickerCodeFrom("/l/index.html", "?c=Ab3dE5gH9k")).toBe("Ab3dE5gH9k");
  });

  it("rejects anything that isn't a code", () => {
    expect(stickerCodeFrom("/l/")).toBeNull();
    expect(stickerCodeFrom("/l/short")).toBeNull();
    expect(stickerCodeFrom("/l/Ab3dE5gH9k-x")).toBeNull();
    expect(stickerCodeFrom("/l/", "?c=<script>")).toBeNull();
    expect(isStickerCode("Ab3dE5gH9k1")).toBe(false);
  });

  it("builds the printed address and the in-app route", () => {
    expect(stickerLink("https://seewhatsinhere.com/", "Ab3dE5gH9k")).toBe("https://seewhatsinhere.com/l/Ab3dE5gH9k");
    expect(stickerRoute("Ab3dE5gH9k")).toBe("/l/?c=Ab3dE5gH9k");
  });
});
