import { describe, expect, it } from "vitest";
import { BOX_COLOURS, boxColour, coverKind, labelLines, pickPeeks, type Peek } from "@/lib/domain/boxLook";

const peek = (name: string, imagePath: string | null = null): Peek => ({ name, brand: null, category: null, imagePath });

describe("boxColour", () => {
  it("gives the same box the same colour every time", () => {
    expect(boxColour("a1b2")).toEqual(boxColour("a1b2"));
  });
  it("spreads boxes over the colours", () => {
    const seen = new Set(Array.from({ length: 40 }, (_, i) => boxColour(`00000000-0000-4000-8000-${String(i).padStart(12, "0")}`).name));
    expect(seen.size).toBeGreaterThanOrEqual(5);
  });
  it("only uses colours white text can sit on", () => {
    for (const c of BOX_COLOURS) {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(c.bg.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
      const lum = 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
      expect(1.05 / (lum + 0.05)).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe("coverKind", () => {
  it("is empty with nothing in it", () => expect(coverKind([])).toBe("empty"));
  it("writes a label when nothing has a picture", () => expect(coverKind([peek("Baubles"), peek("Lights")])).toBe("label"));
  it("shows photos when one of the first four has one", () => expect(coverKind([peek("Baubles"), peek("Star", "a.webp")])).toBe("photos"));
  it("can count books as having a picture", () => expect(coverKind([peek("Dune")], () => true)).toBe("photos"));
});

describe("labelLines", () => {
  it("lists the first three and counts the rest", () => {
    expect(labelLines([peek("A"), peek("B"), peek("C"), peek("D")], 9)).toEqual({ lines: ["A", "B", "C"], more: 6 });
  });
  it("has nothing more when everything fits", () => {
    expect(labelLines([peek("A"), peek("B")], 2)).toEqual({ lines: ["A", "B"], more: 0 });
  });
});

describe("pickPeeks", () => {
  it("puts things with photos first", () => {
    const got = pickPeeks([peek("A"), peek("B"), peek("C"), peek("D"), peek("E", "e.webp")]);
    expect(got.map((p) => p.name)).toEqual(["E", "A", "B", "C"]);
  });
  it("keeps the order when nothing has a photo", () => {
    expect(pickPeeks([peek("A"), peek("B"), peek("C"), peek("D"), peek("E")]).map((p) => p.name)).toEqual(["A", "B", "C", "D"]);
  });
});
