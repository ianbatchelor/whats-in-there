/** A link that lets one person into a single place: /join-place/?t=<token>. */
export function placeJoinUrl(origin: string, token: string): string {
  return `${origin.replace(/\/+$/, "")}/join-place/?t=${encodeURIComponent(token)}`;
}

const TOKEN = /^[A-Za-z0-9_-]{24,64}$/;

export function readPlaceToken(search: string): string | null {
  const t = new URLSearchParams(search).get("t");
  return t && TOKEN.test(t) ? t : null;
}

/** The message that goes with a place link. */
export function placeJoinMessage(place: string, url: string): string {
  return `I've shared our ${place} with you on See What's in Here, so we can both see what's in it and keep it up to date. You'll only see the ${place}. Open this link to join: ${url}`;
}

/** "Molly uses this too", "Molly and Pal use this too", "Molly and 2 others use this too". */
export function usersLine(names: string[]): string | null {
  if (names.length === 0) return null;
  if (names.length === 1) return `${names[0]} uses this too`;
  if (names.length === 2) return `${names[0]} and ${names[1]} use this too`;
  return `${names[0]} and ${names.length - 1} others use this too`;
}
