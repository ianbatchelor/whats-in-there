import type { ListKind } from "./ownLists";

/**
 * Pictures for lists: one for each season's jobs, and a set people can pick for their own lists.
 * Every picture is decoration only. The words (the list's name, counts) are always real text beside it,
 * and a card still reads properly if a picture fails to load.
 */

export type Season = "Spring" | "Summer" | "Autumn" | "Winter";
export const SEASONS: Season[] = ["Spring", "Summer", "Autumn", "Winter"];

/** Each season's picture and the soft tint behind it. */
export const SEASON_ART: Record<Season, { art: string; tint: string }> = {
  Spring: { art: "/lists/spring-jobs.webp", tint: "bg-sage" },
  Summer: { art: "/lists/summer-jobs.webp", tint: "bg-sun" },
  Autumn: { art: "/lists/autumn-jobs.webp", tint: "bg-terracotta" },
  Winter: { art: "/lists/winter-jobs.webp", tint: "bg-frost" },
};

/** Unknown names (there shouldn't be any) get autumn, the picture the card always had. */
export const seasonArt = (season: string) => SEASON_ART[season as Season] ?? SEASON_ART.Autumn;

export type ListCategory = {
  id: string;
  /** What the picture is called in the picker, and the name a new list starts with. */
  label: string;
  art: string;
  /** Tailwind background class for the tile behind the picture. */
  tint: string;
  /** The kind of list that usually suits it. Picking the picture suggests it; people can still change it. */
  kind: ListKind;
  /** What the box for adding to the list says. */
  placeholder: string;
};

/** In the order the picker shows them. Drinks first: party drinks, the wine order, the weekly beer run. */
export const LIST_CATEGORIES: ListCategory[] = [
  { id: "drinks", label: "Drinks", art: "/lists/drinks.webp", tint: "bg-champagne", kind: "buy", placeholder: "Add a drink, like 6 bottles of prosecco" },
  { id: "meal-plan", label: "Meal plan", art: "/lists/meal-plan.webp", tint: "bg-honey", kind: "todo", placeholder: "Add a meal, like Tuesday: fish pie" },
  { id: "recipes", label: "Recipes", art: "/lists/recipes.webp", tint: "bg-terracotta", kind: "ideas", placeholder: "Add a recipe to try" },
  { id: "garden", label: "Garden jobs", art: "/lists/garden-jobs.webp", tint: "bg-sage", kind: "todo", placeholder: "Add a garden job" },
  { id: "diy", label: "DIY jobs", art: "/lists/diy-jobs.webp", tint: "bg-champagne", kind: "todo", placeholder: "Add a job, like fix the shed door" },
  { id: "travel", label: "Travel packing", art: "/lists/travel-packing.webp", tint: "bg-sage", kind: "todo", placeholder: "Add something to pack" },
  { id: "projects", label: "Projects", art: "/lists/projects.webp", tint: "bg-rose", kind: "todo", placeholder: "Add a step" },
  { id: "fitness", label: "Health & fitness", art: "/lists/health-fitness.webp", tint: "bg-slate", kind: "todo", placeholder: "Add a goal or a habit" },
  { id: "events", label: "Birthdays & events", art: "/lists/birthdays.webp", tint: "bg-rose", kind: "todo", placeholder: "Add something for the day" },
  { id: "household", label: "Household jobs", art: "/lists/household-jobs.webp", tint: "bg-frost", kind: "todo", placeholder: "Add a job around the house" },
];

/** The list's picture, or null for no picture (or one this version of the app doesn't know). */
export function listCategory(id: string | null | undefined): ListCategory | null {
  return (id && LIST_CATEGORIES.find((c) => c.id === id)) || null;
}

/** A category id is safe to store: lower-case letters and dashes, as the database also checks. */
export const isCategoryId = (id: string) => /^[a-z-]{1,24}$/.test(id);
