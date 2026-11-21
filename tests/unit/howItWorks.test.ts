import { describe, expect, it } from "vitest";
import { CHAPTERS, HOW_IT_WORKS, chapterAt, clock } from "@/lib/domain/howItWorks";

describe("how it works video", () => {
  it("has chapters in order, all inside the video", () => {
    const starts = CHAPTERS.map((c) => c.start);
    expect(starts).toEqual([...starts].sort((a, b) => a - b));
    expect(Math.max(...starts)).toBeLessThan(HOW_IT_WORKS.seconds);
    expect(new Set(CHAPTERS.map((c) => c.id)).size).toBe(CHAPTERS.length);
  });

  it("knows which chapter is playing", () => {
    expect(chapterAt(3)).toBeNull();
    expect(chapterAt(11)?.id).toBe("tap");
    expect(chapterAt(52)?.id).toBe("presents");
    expect(chapterAt(70)?.id).toBe("christmas");
  });

  it("writes times as minutes and seconds", () => {
    expect(clock(11)).toBe("0:11");
    expect(clock(58.5)).toBe("0:58");
    expect(clock(71)).toBe("1:11");
  });
});
