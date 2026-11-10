/**
 * Sticker links. Every place has a 10-character code (see generate_link_code in the schema), and a
 * sticker or QR label carries https://seewhatsinhere.com/l/<code>. The same code also works as
 * /l/?c=<code>, which is what the app itself navigates to (a static export has no /l/<code> page;
 * vercel.json serves /l/ for those addresses).
 */
const CODE = /^[0-9A-Za-z]{10}$/;

export function isStickerCode(value: string | null | undefined): value is string {
  return !!value && CODE.test(value);
}

/** The code in a sticker address, from /l/<code> or /l/?c=<code>; null when there isn't a valid one. */
export function stickerCodeFrom(pathname: string, search = ""): string | null {
  const fromPath = /^\/l\/([^/?#]+)\/?$/.exec(pathname)?.[1];
  if (fromPath && fromPath !== "index.html") return isStickerCode(fromPath) ? fromPath : null;
  const fromQuery = new URLSearchParams(search).get("c");
  return isStickerCode(fromQuery) ? fromQuery : null;
}

/** The address written to a sticker or printed in a QR code. */
export function stickerLink(origin: string, code: string): string {
  return `${origin.replace(/\/+$/, "")}/l/${code}`;
}

/** Where the app goes for a sticker address, in a form a static export can serve. */
export function stickerRoute(code: string): string {
  return `/l/?c=${code}`;
}
