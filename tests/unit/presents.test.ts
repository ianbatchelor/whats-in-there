import { describe, expect, it } from "vitest";
import {
  cleanLink,
  cleanPrice,
  ideaCountCaption,
  looksLikeLink,
  linkLabel,
  people,
  shareMessage,
  sortIdeas,
  wishCodeFrom,
  wishShareUrl,
  wouldLove,
  wrapFor,
  WRAPS,
  type WishIdea,
  type WishList,
} from "@/lib/domain/presents";

const list = (id: string, forUser: string | null, name: string | null = null): WishList => ({ id, kind: "presents", friend: false, forUser, name, shareCode: null, createdAt: "2026-11-13" });
const idea = (id: string, addedAt: string, favourite = false): WishIdea => ({
  id,
  listId: "l",
  title: id,
  note: null,
  link: null,
  price: null,
  favourite,
  imagePath: null,
  author: null,
  isbn: null,
  coverId: null,
  suggestedBy: null,
  addedBy: null,
  addedAt,
});

describe("people", () => {
  const members = [
    { userId: "m", displayName: "Michelle" },
    { userId: "i", displayName: "Ian" },
    { userId: "a", displayName: "Alex" },
  ];
  it("puts you first, then the household by name, then lists for people without an account", () => {
    const ps = people(members, [list("l1", "m"), list("l2", null, "Ollie"), list("l3", null, "Bea")], "i");
    expect(ps.map((p) => p.name)).toEqual(["Ian", "Alex", "Michelle", "Bea", "Ollie"]);
    expect(ps[0]!.list).toBeNull();
    expect(ps[2]!.list?.id).toBe("l1");
    expect(ps[3]!.key).toBe("l3");
  });
});

describe("ideas", () => {
  it("shows top-of-the-list ideas first, then oldest first", () => {
    expect(sortIdeas([idea("b", "2"), idea("a", "1"), idea("star", "3", true)]).map((i) => i.id)).toEqual(["star", "a", "b"]);
  });
  it("words the heading for you or for someone else", () => {
    expect(wouldLove("Michelle Smith", false)).toBe("Michelle would love…");
    expect(wouldLove("Ian", true)).toBe("You'd love…");
  });
});

describe("links and prices", () => {
  it("adds https:// to a bare shop address", () => {
    expect(cleanLink("amazon.co.uk/dp/123")).toBe("https://amazon.co.uk/dp/123");
    expect(cleanLink("  ")).toBeNull();
  });
  it("refuses anything that isn't a web page", () => {
    expect(cleanLink("javascript:alert(1)")).toBe("bad");
    expect(cleanLink("not a link")).toBe("bad");
    expect(cleanLink("mailto:a@b.com")).toBe("bad");
  });
  it("shows the shop's name, not the whole address", () => {
    expect(linkLabel("https://www.johnlewis.com/item/1")).toBe("johnlewis.com");
  });
  it("gives a bare number a pound sign and leaves words alone", () => {
    expect(cleanPrice("40")).toBe("£40");
    expect(cleanPrice("12.50")).toBe("£12.50");
    expect(cleanPrice("about £30")).toBe("about £30");
    expect(cleanPrice("")).toBeNull();
  });
});

describe("share links", () => {
  it("builds and reads the private link", () => {
    const url = wishShareUrl("https://seewhatsinhere.com/", "Ab12Cd34Ef");
    expect(url).toBe("https://seewhatsinhere.com/wish/?c=Ab12Cd34Ef");
    expect(wishCodeFrom(new URL(url).search)).toBe("Ab12Cd34Ef");
    expect(wishCodeFrom("?c=short")).toBeNull();
  });
  it("tells family the person won't see, when it isn't your own list", () => {
    expect(shareMessage("Michelle", "u", false)).toContain("Michelle won't see");
    expect(shareMessage("Ian", "u", true)).toContain("for me");
  });
});

describe("looks", () => {
  it("gives each person a wrapping paper, going round when there are many", () => {
    expect(wrapFor(0)).toBe(WRAPS[0]);
    expect(wrapFor(WRAPS.length)).toBe(WRAPS[0]);
  });
  it("words the Home card", () => {
    expect(ideaCountCaption(0)).toBe("start a list");
    expect(ideaCountCaption(1)).toBe("present idea");
    expect(ideaCountCaption(5)).toBe("present ideas");
  });
});

describe("pasting a link into the add box", () => {
  it("treats shop links as links and names as names", () => {
    expect(looksLikeLink("https://www.amazon.co.uk/dp/B0TEST")).toBe(true);
    expect(looksLikeLink("amzn.eu/d/abc123")).toBe(true);
    expect(looksLikeLink("www.argos.co.uk/product/123")).toBe(true);
    expect(looksLikeLink("Cashmere jumper")).toBe(false);
    expect(looksLikeLink("Book.")).toBe(false);
    expect(looksLikeLink("Mr.Men")).toBe(false);
  });
});
