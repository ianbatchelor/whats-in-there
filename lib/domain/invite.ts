/** Invitation links carry the raw token in the URL fragment-free query: /invite/?token=... */
export function buildInviteUrl(origin: string, token: string): string {
  return `${origin.replace(/\/+$/, "")}/invite/?token=${encodeURIComponent(token)}`;
}

const TOKEN = /^[A-Za-z0-9_-]{40,64}$/;

export function readInviteToken(search: string): string | null {
  const token = new URLSearchParams(search).get("token");
  return token && TOKEN.test(token) ? token : null;
}
