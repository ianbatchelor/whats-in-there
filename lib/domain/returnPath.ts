/**
 * The sign-in page's ?next= return address. Only a path inside this app is allowed, so a crafted
 * link can't send someone to another site after they sign in. Browsers read "\" as "/", which makes
 * "/\evil.com" mean "//evil.com", so backslashes and control characters are refused too.
 */
export function safeReturnPath(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/";
  if (/[\\\u0000-\u001f\u007f]/.test(next)) return "/";
  try {
    const base = "https://app.invalid";
    const u = new URL(next, base);
    if (u.origin !== base) return "/";
    return `${u.pathname}${u.search}${u.hash}`;
  } catch {
    return "/";
  }
}
