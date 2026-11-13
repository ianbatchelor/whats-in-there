// Pure page-reading helpers for read-link: no network, no imports, so they can be unit tested.

/** Only ordinary web addresses: http(s), a real host name, the usual ports, no logins in the link. */
export function safeUrl(raw: string): URL | null {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  if (u.username || u.password) return null;
  if (u.port && u.port !== "80" && u.port !== "443") return null;
  const host = u.hostname.toLowerCase();
  if (!host.includes(".") || host.endsWith(".local") || host.endsWith(".internal") || host.endsWith(".localhost")) return null;
  if (/^[\d.]+$/.test(host) || host.includes(":") || host.startsWith("[")) return null; // bare IP addresses
  return u;
}

// ---------- Reading the page ----------

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", pound: "£", euro: "€", ndash: "–", mdash: "—" };
export function decode(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m)
    .replace(/\s+/g, " ")
    .trim();
}

export function metaTags(html: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const key = /(?:property|name|itemprop)\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1]?.toLowerCase();
    const value = /content\s*=\s*"([^"]*)"/i.exec(tag)?.[1] ?? /content\s*=\s*'([^']*)'/i.exec(tag)?.[1];
    if (key && value && !out.has(key)) out.set(key, decode(value));
  }
  return out;
}

export type Found = { title: string | null; price: string | null; image: string | null; brand: string | null };

export function productFromJsonLd(html: string): Partial<Found> {
  const found: Partial<Found> = {};
  for (const m of html.matchAll(/<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    let data: unknown;
    try {
      data = JSON.parse(m[1]!.trim());
    } catch {
      continue;
    }
    const queue: unknown[] = [data];
    while (queue.length) {
      const node = queue.shift();
      if (Array.isArray(node)) {
        queue.push(...node);
        continue;
      }
      if (!node || typeof node !== "object") continue;
      const o = node as Record<string, unknown>;
      if (o["@graph"]) queue.push(o["@graph"]);
      const type = o["@type"];
      const isProduct = type === "Product" || (Array.isArray(type) && type.includes("Product")) || type === "ProductGroup";
      if (!isProduct) continue;
      if (!found.title && typeof o.name === "string") found.title = decode(o.name);
      const img = Array.isArray(o.image) ? o.image[0] : o.image;
      const imgUrl = typeof img === "string" ? img : img && typeof img === "object" ? (img as Record<string, unknown>).url : null;
      if (!found.image && typeof imgUrl === "string") found.image = imgUrl;
      const brand = o.brand as unknown;
      const brandName = typeof brand === "string" ? brand : brand && typeof brand === "object" ? (brand as Record<string, unknown>).name : null;
      if (!found.brand && typeof brandName === "string") found.brand = decode(brandName);
      const offers = Array.isArray(o.offers) ? o.offers[0] : o.offers;
      if (!found.price && offers && typeof offers === "object") {
        const of = offers as Record<string, unknown>;
        const amount = of.price ?? of.lowPrice;
        if (amount != null) found.price = money(String(amount), String(of.priceCurrency ?? ""));
      }
    }
  }
  return found;
}

const SYMBOL: Record<string, string> = { GBP: "£", EUR: "€", USD: "$" };
/** "24.99" + "GBP" → "£24.99". Keeps the shop's currency. */
export function money(amount: string, currency: string): string | null {
  const n = Number(String(amount).replace(/[^\d.]/g, ""));
  if (!Number.isFinite(n) || n <= 0 || n > 1_000_000) return null;
  const shown = Number.isInteger(n) ? String(n) : n.toFixed(2);
  const sym = SYMBOL[currency.toUpperCase()] ?? "";
  return sym ? `${sym}${shown}` : currency ? `${shown} ${currency.toUpperCase()}` : `£${shown}`;
}

/** Amazon's own page parts, for when it does show the real page. */
export function amazonBits(html: string): Partial<Found> {
  const found: Partial<Found> = {};
  const title = /<span[^>]*id=["']productTitle["'][^>]*>([\s\S]*?)<\/span>/i.exec(html)?.[1];
  if (title) found.title = decode(title.replace(/<[^>]+>/g, ""));
  const hires = /data-old-hires=["']([^"']+)["']/i.exec(html)?.[1] ?? /"hiRes":"(https:[^"]+)"/.exec(html)?.[1] ?? /"large":"(https:[^"]+)"/.exec(html)?.[1];
  if (hires) found.image = hires;
  const price = /class=["'][^"']*a-offscreen[^"']*["'][^>]*>\s*([£€$][\d,.]+)/i.exec(html)?.[1];
  if (price) found.price = price.replace(/,/g, "");
  return found;
}

/** amazon.co.uk/Sony-WH-1000XM5-Noise-Cancelling-Headphones/dp/B09... → "Sony WH 1000XM5 Noise Cancelling Headphones". */
export function nameFromLink(u: URL): string | null {
  const parts = u.pathname.split("/").filter(Boolean).map((p) => decodeURIComponent(p));
  const dp = parts.findIndex((p) => p === "dp" || p === "gp");
  const slug = dp > 0 ? parts[dp - 1] : parts.filter((p) => /[a-z]-[a-z]/i.test(p) && !/^\d+$/.test(p)).sort((a, b) => b.length - a.length)[0];
  if (!slug || slug.length < 6) return null;
  const words = slug.replace(/\.(html?|aspx?|php)$/i, "").replace(/[-_+]+/g, " ").replace(/\s+/g, " ").trim();
  if (!/[a-z]{3}/i.test(words)) return null;
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Drops shop names and selling words that pages add to titles. */
export function tidyTitle(raw: string, host: string): string {
  let t = decode(raw);
  if (/^Amazon\.[a-z.]+\s*:/i.test(t)) t = t.replace(/^Amazon\.[a-z.]+\s*:\s*/i, "").replace(/\s+:\s+[^:]+$/, "");
  t = t.replace(/\s*:\s*Amazon\.[a-z.]+\s*:.*$/i, "");
  t = t.replace(/\s*[|–—-]\s*(Buy|Shop)\b.*$/i, "");
  // "Wool Throw | John Lewis & Partners": drop a last part that names the shop.
  const shop = host.replace(/^www\./, "").split(".")[0]!.toLowerCase();
  const parts = t.split(/\s+[|–—-]\s+/);
  if (parts.length > 1 && parts[parts.length - 1]!.toLowerCase().replace(/[^a-z0-9]/g, "").includes(shop)) t = parts.slice(0, -1).join(" - ");
  return t.replace(/\s+/g, " ").trim().slice(0, 120);
}

/** The "prove you're human" pages shops show to servers. */
export function isRobotWall(html: string, title: string | null): boolean {
  return /captcha|robot check|are you a human|access denied|enable javascript and cookies|pardon our interruption|request blocked/i.test(
    (title ?? "") + " " + html.slice(0, 20000),
  );
}

export function visibleText(html: string, max = 14_000): string {
  return decode(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  ).slice(0, max);
}


/** Everything the page's own summary says about the product. */
export function readPage(html: string, pageUrl: URL): Found & { robotWall: boolean } {
  const meta = metaTags(html);
  const ld = productFromJsonLd(html);
  const amazon = /(^|\.)amazon\./i.test(pageUrl.hostname) ? amazonBits(html) : {};
  const pageTitle = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? null;
  const title = amazon.title ?? ld.title ?? meta.get("og:title") ?? meta.get("twitter:title") ?? meta.get("name") ?? (pageTitle ? decode(pageTitle) : null);
  const metaPrice = (k: string, c: string) => (meta.get(k) ? money(meta.get(k)!, meta.get(c) ?? "") : null);
  const found: Found = {
    title,
    image: amazon.image ?? ld.image ?? meta.get("og:image:secure_url") ?? meta.get("og:image") ?? meta.get("twitter:image") ?? meta.get("image") ?? null,
    price: amazon.price ?? ld.price ?? metaPrice("product:price:amount", "product:price:currency") ?? metaPrice("og:price:amount", "og:price:currency") ?? metaPrice("price", "pricecurrency"),
    brand: ld.brand ?? meta.get("product:brand") ?? meta.get("og:brand") ?? null,
  };
  // A real product page can mention "captcha" in its scripts, so only call it a wall when the
  // product's own name is missing too.
  if (!amazon.title && !ld.title && isRobotWall(html, title)) return { title: null, image: null, price: null, brand: null, robotWall: true };
  return { ...found, robotWall: false };
}
