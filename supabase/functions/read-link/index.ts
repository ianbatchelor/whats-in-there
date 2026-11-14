// read-link: opens a shop page from a present idea's link and returns its name, price and picture.
//
// index.ts plus parse.ts (the page-reading helpers, unit tested in tests/unit/readLink.test.ts),
// deployed together with `supabase functions deploy read-link`. It uses the ANTHROPIC_API_KEY secret already set for
// extract-product; Supabase provides SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY.
//
// Flow: the app sends a household and a link. The function checks the caller belongs to the
// household and counts the read against a monthly allowance, then opens the page as an ordinary
// browser would. Most shops put a tidy summary in the page for link previews (Open Graph tags and
// schema.org Product data), which gives the name, picture and price for free. Only when that comes
// back thin, and the page isn't a "are you a robot" wall, the visible page text goes to a small
// Claude model to pick out the same details. Amazon often shows that wall to servers, so for Amazon
// the product name is also taken from the words in the link itself as a last resort.
//
// The picture is copied into the public wish-pictures bucket so it keeps working if the shop changes
// it, and so family viewing a shared list never load anything from the shop.
//
// Safety: only http and https links on ordinary host names (no addresses, no local names, no ports
// other than the usual ones), every redirect is checked the same way, pages and pictures are size
// capped, and each request gives up after a few seconds. Nothing is saved to the idea here: the app
// shows what was found and the person saves it.

import Anthropic from "npm:@anthropic-ai/sdk@1.4.0";
import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import { money, nameFromLink, readPage, safeUrl, tidyTitle, visibleText, type Found } from "./parse.ts";

const MODEL = "claude-haiku-5-5";
const PER_USER_PER_MINUTE = 10;
const PER_USER_PER_MONTH = 100;
const PAGE_TIMEOUT_MS = 7000;
const IMAGE_TIMEOUT_MS = 6000;
const MAX_PAGE_BYTES = 2_500_000;
const MAX_IMAGE_BYTES = 3_000_000;
const MAX_TEXT_FOR_AI = 14_000;
const BUCKET = "wish-pictures";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BROWSER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-GB,en;q=0.9",
};

function reply(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

function privateAddress(ip: string): boolean {
  if (ip.includes(":")) {
    const v = ip.toLowerCase();
    return v === "::1" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80") || v.startsWith("::ffff:") || v === "::";
  }
  const [a, b] = ip.split(".").map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b! >= 16 && b! <= 31) || (a === 192 && b === 168) || (a === 100 && b! >= 64 && b! <= 127) || a! >= 224;
}

/** Refuses host names that point inside a private network. Best effort where DNS lookups aren't allowed. */
async function publicHost(host: string): Promise<boolean> {
  try {
    const found = [
      ...(await Deno.resolveDns(host, "A").catch(() => [] as string[])),
      ...(await Deno.resolveDns(host, "AAAA").catch(() => [] as string[])),
    ];
    return !found.some(privateAddress);
  } catch {
    return true;
  }
}

/** Fetches with redirects followed by hand, checking every hop, and reads at most `max` bytes. */
async function fetchCapped(start: URL, max: number, timeoutMs: number, headers: Record<string, string>) {
  const deadline = AbortSignal.timeout(timeoutMs);
  let url = start;
  for (let hop = 0; hop < 5; hop++) {
    if (!(await publicHost(url.hostname))) return null;
    const res = await fetch(url, { headers, redirect: "manual", signal: deadline });
    if (res.status >= 300 && res.status < 400) {
      const next = res.headers.get("location");
      await res.body?.cancel();
      const nextUrl = next ? safeUrl(new URL(next, url).toString()) : null;
      if (!nextUrl) return null;
      url = nextUrl;
      continue;
    }
    const reader = res.body?.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > max) {
          await reader.cancel();
          break;
        }
        chunks.push(value);
      }
    }
    const bytes = new Uint8Array(Math.min(size, max));
    let at = 0;
    for (const c of chunks) {
      bytes.set(c.subarray(0, Math.min(c.length, bytes.length - at)), at);
      at += c.length;
      if (at >= bytes.length) break;
    }
    return { status: res.status, url, type: res.headers.get("content-type") ?? "", bytes };
  }
  return null;
}

const AI_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["is_product", "title", "price", "currency"],
  properties: {
    is_product: { type: "boolean", description: "True only if the page is about one thing you can buy." },
    title: { anyOf: [{ type: "string" }, { type: "null" }] },
    price: { anyOf: [{ type: "number" }, { type: "null" }] },
    currency: { anyOf: [{ type: "string", enum: ["GBP", "EUR", "USD"] }, { type: "null" }] },
  },
} as const;

const AI_SYSTEM = `You read the text of one shop web page for a family present wish list in the UK.
Return the product's name as a person would say it on a wish list: brand first if it's part of how people know it, then the product, with key options like colour or size only if the page clearly shows one chosen. Keep it under 80 characters, no selling words ("Best", "New", "Free delivery"), no shop name.
Return the current selling price shown for it, as a number, and its currency. Null if there isn't one clear price.
If the page isn't about one product (a search page, a home page, an error, a robot check), set is_product to false and the rest to null.
Only use what the page says.`;

async function askClaude(apiKey: string, text: string, host: string) {
  const anthropic = new Anthropic({ apiKey, maxRetries: 1, timeout: 25_000 });
  const res = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 600,
    output_config: { effort: "low", format: { type: "json_schema", schema: AI_SCHEMA } },
    system: AI_SYSTEM,
    messages: [{ role: "user", content: `Shop: ${host}\n\nPage text:\n${text}` }],
  });
  const block = res.content.find((b) => b.type === "text");
  if (res.stop_reason !== "end_turn" || !block || block.type !== "text") return null;
  const r = JSON.parse(block.text) as { is_product: boolean; title: string | null; price: number | null; currency: string | null };
  if (!r.is_product) return null;
  return { title: r.title, price: r.price != null ? money(String(r.price), r.currency ?? "GBP") : null };
}

// ---------- Keeping a copy of the picture ----------

function pictureType(b: Uint8Array): { ext: string; type: string } | null {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { ext: "jpg", type: "image/jpeg" };
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return { ext: "png", type: "image/png" };
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return { ext: "gif", type: "image/gif" };
  if (String.fromCharCode(...b.slice(0, 4)) === "RIFF" && String.fromCharCode(...b.slice(8, 12)) === "WEBP") return { ext: "webp", type: "image/webp" };
  return null;
}

// deno-lint-ignore no-explicit-any
async function keepPicture(admin: any, householdId: string, src: string, page: URL): Promise<string | null> {
  try {
    const u = safeUrl(new URL(src, page).toString());
    if (!u) return null;
    const got = await fetchCapped(u, MAX_IMAGE_BYTES, IMAGE_TIMEOUT_MS, { ...BROWSER_HEADERS, Accept: "image/avif,image/webp,image/png,image/jpeg,*/*;q=0.5", Referer: page.origin });
    if (!got || got.status !== 200 || got.bytes.length < 500 || got.bytes.length >= MAX_IMAGE_BYTES) return null;
    const kind = pictureType(got.bytes);
    if (!kind) return null;
    const path = `${householdId}/${crypto.randomUUID()}.${kind.ext}`;
    const { error } = await admin.storage.from(BUCKET).upload(path, got.bytes, { contentType: kind.type, upsert: false });
    return error ? null : path;
  } catch {
    return null;
  }
}

// ---------- The request ----------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return reply(405, { error: "bad_request" });

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  const url = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const authorization = req.headers.get("Authorization") ?? "";
  const asUser = createClient(url, anonKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false, autoRefreshToken: false } });
  const { data: auth } = await asUser.auth.getUser(authorization.replace(/^Bearer\s+/i, ""));
  const user = auth?.user;
  if (!user) return reply(401, { error: "not_signed_in" });

  let householdId = "";
  let link: URL | null = null;
  try {
    const body = await req.json();
    householdId = String(body?.householdId ?? "");
    link = safeUrl(String(body?.url ?? "").slice(0, 2000));
  } catch {
    return reply(400, { error: "bad_request" });
  }
  if (!UUID.test(householdId)) return reply(400, { error: "bad_request" });
  if (!link) return reply(400, { error: "bad_link" });

  // Family (presents only) can paste links too. Older databases without in_family fall back to is_member.
  const family = await asUser.rpc("in_family", { hid: householdId });
  const member = family.error ? (await asUser.rpc("is_member", { hid: householdId })).data : family.data;
  if (member !== true) return reply(403, { error: "not_member" });

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const host = link.hostname.replace(/^www\./, "");
  const { data: reserved, error: reserveError } = await admin.rpc("reserve_link_read", {
    p_household: householdId,
    p_user: user.id,
    p_host: host,
    p_per_minute: PER_USER_PER_MINUTE,
    p_per_month: PER_USER_PER_MONTH,
  });
  const slot = Array.isArray(reserved) ? reserved[0] : reserved;
  if (reserveError || !slot) return reply(500, { error: "failed" });
  if (slot.refused) return reply(429, { error: slot.refused });
  const log = (fields: Record<string, unknown>) => admin.from("link_reads").update({ error_code: null, ...fields }).eq("id", slot.read_id);

  const found: Found = { title: null, price: null, image: null, brand: null };
  let usedAi = false;
  let finalUrl = link;
  let problem: string | null = null;
  try {
    const page = await fetchCapped(link, MAX_PAGE_BYTES, PAGE_TIMEOUT_MS, BROWSER_HEADERS);
    if (!page) problem = "blocked_link";
    else if (page.status >= 400) problem = `http_${page.status}`;
    else if (!/html|xml/i.test(page.type)) problem = "not_html";
    if (page && !problem) {
      finalUrl = page.url;
      const html = new TextDecoder().decode(page.bytes);
      const read = readPage(html, finalUrl);
      Object.assign(found, { title: read.title, image: read.image, price: read.price, brand: read.brand });
      if (read.robotWall) {
        problem = "robot_wall";
      } else if (apiKey && (!found.title || !found.price)) {
        // Thin summary: let Claude read the page text for what's missing.
        const text = visibleText(html, MAX_TEXT_FOR_AI);
        if (text.length > 200) {
          usedAi = true;
          const ai = await askClaude(apiKey, text, host).catch(() => null);
          if (ai) {
            found.title = found.title ?? ai.title;
            found.price = found.price ?? ai.price;
          }
        }
      }
    }
  } catch (err) {
    problem = err instanceof DOMException && err.name === "TimeoutError" ? "timeout" : "fetch_failed";
  }

  let title = found.title ? tidyTitle(found.title, host) : "";
  let fromLink = false;
  if (!title) {
    title = nameFromLink(finalUrl) ?? nameFromLink(link) ?? "";
    fromLink = !!title;
  }
  const imagePath = found.image ? await keepPicture(admin, householdId, found.image, finalUrl) : null;
  const price = found.price ? found.price.slice(0, 18) : null;

  await log({
    used_ai: usedAi,
    found: [title && (fromLink ? "name_from_link" : "name"), price && "price", imagePath && "picture"].filter(Boolean).join(",") || null,
    error_code: problem,
  });
  if (!title && !price && !imagePath) return reply(422, { error: problem === "robot_wall" ? "shop_blocked" : "unreadable", shop: host });
  return reply(200, {
    shop: host,
    title: title || null,
    titleFromLink: fromLink,
    price,
    brand: found.brand,
    imagePath,
    partial: problem === "robot_wall" || !price || !imagePath,
  });
});
