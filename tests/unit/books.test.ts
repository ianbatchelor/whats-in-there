import { describe, expect, it } from "vitest";
import { authorKey, findOwned, isIsbn, matchKey, sortBooks, titleKey, wantsToRead } from "@/lib/domain/books";

const b = (title: string, author: string | null, addedAt: string, favourite = false) => ({ title, author, addedAt, favourite });

describe("sortBooks", () => {
  const books = [
    b("Wolf Hall", "Hilary Mantel", "2026-11-01"),
    b("The Sea, the Sea", "Iris Murdoch", "2026-11-03", true),
    b("Clear", "Carys Davies", "2026-11-02"),
    b("A Little Life", null, "2026-11-04"),
  ];
  const titles = (by: Parameters<typeof sortBooks>[1]) => sortBooks(books, by).map((x) => x.title);

  it("puts most wanted first, then oldest first", () => {
    expect(titles("wanted")).toEqual(["The Sea, the Sea", "Wolf Hall", "Clear", "A Little Life"]);
  });
  it("sorts newest first", () => {
    expect(titles("newest")).toEqual(["A Little Life", "The Sea, the Sea", "Clear", "Wolf Hall"]);
  });
  it("sorts by surname, with no author last", () => {
    expect(titles("author")).toEqual(["Clear", "Wolf Hall", "The Sea, the Sea", "A Little Life"]);
  });
  it("sorts by title ignoring The and A", () => {
    expect(titles("title")).toEqual(["Clear", "A Little Life", "The Sea, the Sea", "Wolf Hall"]);
  });
});

describe("matching titles", () => {
  it("ignores case, punctuation, leading The and subtitles", () => {
    expect(matchKey("The Sea, the Sea")).toBe(matchKey("sea the sea"));
    expect(matchKey("Wolf Hall: A Novel")).toBe("wolf hall");
    expect(titleKey("An Officer and a Spy")).toBe("officer and a spy");
  });
  it("finds a book already on a shelf", () => {
    const owned = [{ productName: "Wolf Hall", locationId: "lounge" }, { productName: "Cheddar", locationId: "fridge" }];
    expect(findOwned("Wolf Hall (Paperback)", owned)?.locationId).toBe("lounge");
    expect(findOwned("Bring Up the Bodies", owned)).toBeNull();
  });
  it("files authors by surname", () => {
    expect(authorKey("Hilary Mantel")).toBe("mantel hilary");
    expect(authorKey("Terry Pratchett and Neil Gaiman")).toBe("pratchett terry");
  });
});

describe("isIsbn", () => {
  it("accepts real ISBNs and rejects misreads", () => {
    expect(isIsbn("9780007230204")).toBe(true);
    expect(isIsbn("9780007230205")).toBe(false);
    expect(isIsbn("0007230206")).toBe(true);
    expect(isIsbn("5000159407236")).toBe(false);
  });
});

it("says whose list it is", () => {
  expect(wantsToRead("Michelle Batchelor", false)).toBe("Michelle wants to read…");
  expect(wantsToRead("Ian", true)).toBe("Next up for you…");
});
