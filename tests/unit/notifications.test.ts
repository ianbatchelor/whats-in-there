import { describe, expect, it } from "vitest";
import { message, reminder, whoDid, type Due } from "../../supabase/functions/send-notifications/message";
import { hasBell, hourLabel, modeHelp, quietLine, startingMode } from "@/lib/domain/notifications";

const due = (over: Partial<Due>): Due => ({
  event_ids: [1],
  recipient: "ian",
  target_kind: "wish_list",
  target_id: "list-1",
  actors: ["Michele Batchelor"],
  things: ["Lego set"],
  total: 1,
  list_title: null,
  list_kind: "presents",
  for_user: "michele",
  for_name: "Michele Batchelor",
  household_id: "home",
  devices: [],
  ...over,
});

describe("notification wording", () => {
  it("names one new present idea", () => {
    const m = message(due({}));
    expect(m.title).toBe("Michele's wish list");
    expect(m.body).toBe("Michele added Lego set");
    expect(m.url).toBe("/presents/?for=michele");
    expect(m.circle).toBe("home");
  });

  it("gathers a burst of ideas into one message", () => {
    const m = message(due({ total: 4, things: ["Lego set", "Scarf", "Book token"] }));
    expect(m.body).toBe("Michele added 4 ideas: Lego set, Scarf and 2 more");
    expect(message(due({ total: 2, things: ["Lego set", "Scarf"] })).body).toBe("Michele added 2 ideas: Lego set and Scarf");
  });

  it("says books on a book wish list, and opens the books page", () => {
    const m = message(due({ list_kind: "books", total: 2, things: ["Middlemarch", "Persuasion"] }));
    expect(m.title).toBe("Michele's book wish list");
    expect(m.body).toBe("Michele added 2 books: Middlemarch and Persuasion");
    expect(m.url).toBe("/books/?for=michele");
    expect(m.circle).toBeUndefined();
  });

  it("uses the list's own id for a list kept for someone without an account", () => {
    expect(message(due({ for_user: null, for_name: "Baby Rose" })).url).toBe("/presents/?for=list-1");
  });

  it("words shared lists as things", () => {
    const one = message(due({ target_kind: "list", list_title: "Weekend shop", list_kind: "list", actors: ["Jo"], things: ["oat milk"] }));
    expect(one).toMatchObject({ title: "Weekend shop", body: "Jo added oat milk", url: "/my-list/?id=list-1" });
    const many = message(due({ target_kind: "list", list_title: "Weekend shop", actors: ["Jo", "Carol"], things: ["oat milk", "eggs", "bread"], total: 4 }));
    expect(many.body).toBe("Jo and Carol added 4 things: oat milk, eggs and 2 more");
  });

  it("says what went into or out of a place", () => {
    const place = { target_kind: "place" as const, list_title: "Garage freezer", list_kind: "freezer", actors: ["Molly Batchelor"], for_user: null, for_name: null };
    expect(message(due({ ...place, things: ["Chicken"], took: 1 }))).toMatchObject({ title: "Garage freezer", body: "Molly took out Chicken", url: "/place/?id=list-1" });
    expect(message(due({ ...place, things: ["Peas", "Chips"], total: 2, took: 0 })).body).toBe("Molly added 2 things: Peas and Chips");
    expect(message(due({ ...place, things: ["Peas", "Chicken", "Chips"], total: 3, took: 1 })).body).toBe("Molly changed 3 things: Peas, Chicken and 1 more");
  });

  it("titles a daily summary as today's", () => {
    expect(message(due({ target_kind: "place", list_title: "Garage freezer", daily: true })).title).toBe("Today in Garage freezer");
    expect(message(due({ target_kind: "list", list_title: "Weekend shop", daily: true })).title).toBe("Today on Weekend shop");
  });

  it("words the morning reminder", () => {
    const r = { recipient: "ian", place_id: "p1", place_name: "Garage freezer", place_type: "freezer", day: "2026-11-21", devices: [] };
    expect(reminder({ ...r, soon: ["Mince"], soon_total: 1, frozen: [], frozen_total: 0 })).toMatchObject({
      title: "Garage freezer",
      body: "Use soon: Mince.",
      url: "/place/?id=p1",
    });
    expect(reminder({ ...r, soon: ["Mince", "Peas"], soon_total: 4, frozen: ["Old lamb"], frozen_total: 1 }).body).toBe(
      "Use soon: Mince, Peas and 2 more. In the freezer over 3 months: Old lamb.",
    );
  });

  it("keeps long names short", () => {
    const m = message(due({ things: ["A".repeat(100)] }));
    expect(m.body.length).toBeLessThan(80);
    expect(m.body.endsWith("…")).toBe(true);
  });

  it("lists who did it", () => {
    expect(whoDid([])).toBe("Someone");
    expect(whoDid(["Shel B", "Ian B", "Carol B"])).toBe("Shel, Ian and Carol");
    expect(whoDid(["A", "B", "C", "D"])).toBe("A and 3 others");
  });
});

describe("bells", () => {
  it("only lists other people can see have one", () => {
    expect(hasBell("list", "me")).toBe(false);
    expect(hasBell("list", "household")).toBe(true);
    expect(hasBell("wish_list")).toBe(true);
  });

  it("starts on for presents, family and groups, off at home", () => {
    expect(startingMode("wish_list")).toBe("every");
    expect(startingMode("list", "family")).toBe("every");
    expect(startingMode("list", "group")).toBe("every");
    expect(startingMode("list", "household")).toBe("off");
    expect(startingMode("place")).toBe("off");
    expect(hasBell("place")).toBe(true);
    expect(modeHelp("place", "daily")).toMatch(/6 pm/);
  });

  it("says quiet hours plainly", () => {
    expect(hourLabel(22)).toBe("10 pm");
    expect(hourLabel(0)).toBe("midnight");
    expect(quietLine(22, 8)).toBe("Nothing arrives between 10 pm and 8 am. Anything from then comes in the morning.");
    expect(quietLine(9, 9)).toMatch(/No quiet hours/);
  });
});
