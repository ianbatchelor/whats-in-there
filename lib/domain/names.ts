/** True when a display name is just the start of the person's email address (the default before they chose one). */
export function looksLikeEmailName(name: string, email: string | null | undefined): boolean {
  if (!email) return false;
  return name.trim().toLowerCase() === email.split("@")[0]!.toLowerCase();
}

/** "who has" for one person, "who have" for more. */
export function whoHave(count: number): string {
  return count === 1 ? "who has" : "who have";
}
