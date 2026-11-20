/** A link that lets one person into one present list: /list-invite/?t=<token>. */
export function listInviteUrl(origin: string, token: string): string {
  return `${origin.replace(/\/+$/, "")}/list-invite/?t=${encodeURIComponent(token)}`;
}

const TOKEN = /^[A-Za-z0-9_-]{24,64}$/;

export function readListToken(search: string): string | null {
  const t = new URLSearchParams(search).get("t");
  return t && TOKEN.test(t) ? t : null;
}

/** A plausible email address, checked before sending. The database checks again. */
export function looksLikeEmail(text: string): boolean {
  const t = text.trim();
  return t.length <= 254 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(t);
}

/** The message that goes with an invitation link sent by hand. */
export function listInviteMessage(name: string, url: string): string {
  return `Here's ${name}'s present list on See What's in Here. You'll see only this list, and what nobody is getting yet. Open this link and sign in with the email I invited: ${url}`;
}
