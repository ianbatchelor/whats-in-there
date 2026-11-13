// extract-product: reads a photo of a food or product label and returns the fields for the add form.
//
// One self-contained file so it can be pasted into the Supabase dashboard editor as well as deployed
// with `supabase functions deploy extract-product`. It needs one secret, ANTHROPIC_API_KEY; Supabase
// provides SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY to every function.
//
// Flow: the app uploads one to three resized photos of the same pack (say front and back) to the
// private item-photos bucket under its household folder, then calls this function with their paths. The function checks the caller is a member of that
// household, applies the usage limits, reads the photo as the caller (so storage RLS applies too),
// asks Claude for a strict JSON reading, logs the attempt and returns the reading. The app checks
// every value again before showing it, and nothing is saved until the person confirms.
//
// Cost controls: a small, cheap model reads the labels; each person gets PER_USER_PER_MONTH reads in
// any 30 days on top of the per-minute and per-household-per-day limits, checked and counted in one
// step so they hold even when many scans arrive at once; and when a barcode is read, the shared
// products list supplies the name, brand and weight once two different people have read the same
// name for it, so a product reads the same way everywhere. Dates always come from the photo.
//
// Public barcode lists: when the shared list doesn't know a barcode yet, the function asks free public
// lists what it is: Open Library for books (ISBNs start 978 or 979) and Open Food Facts for groceries
// and household products. Only the barcode digits are sent. A book's title and author always come
// from Open Library, because the back of a book rarely says what the book is called; for other
// products the public name only fills in what the photo didn't show clearly. Each lookup gives up
// after a few seconds, and the reading stands on its own if a list is slow or doesn't know the code.
//
// Many things at once: with `mode: "many"`, the same photos are read as a shelf, rail or drawer of
// separate things (a bookshelf, a wardrobe) and the reply is a list of them, each with a name, a
// detail (the author of a book, the brand of clothes), a category to sort by, and how many. One
// photo of a shelf is one read against the limits, however many things are on it.

import Anthropic from "npm:@anthropic-ai/sdk@1.4.0";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.118.0";

const MODEL = "claude-haiku-5-5";
const PER_HOUSEHOLD_PER_DAY = 50;
const PER_USER_PER_MINUTE = 6;
const PER_USER_PER_MONTH = 300; // calls, not items: one add can be 2 or 3 calls (front, then front and back)
const MAX_BYTES = 8 * 1024 * 1024;
const MAX_PHOTOS = 3;
const MAX_ITEMS = 150;
const LOOKUP_TIMEOUT_MS = 3500;
// Open Food Facts asks every app to say who it is.
const LOOKUP_AGENT = "SeeWhatsInHere/1.0 (seewhatsinhere@findthecool.com)";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const FIELDS = ["product_name", "brand", "quantity", "weight", "use_by_date", "best_before_date", "vintage", "grape", "region"];
const WINE_COLOURS = ["red", "white", "rose", "sparkling", "sweet", "fortified"];
const nullable = (schema: Record<string, unknown>) => ({ anyOf: [schema, { type: "null" }] });

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "readable",
    "product_name",
    "brand",
    "quantity",
    "unit",
    "weight_value",
    "weight_unit",
    "use_by_date",
    "best_before_date",
    "uncertain",
    "barcode",
    "wine",
  ],
  properties: {
    readable: { type: "boolean", description: "False if the photo shows no product or label you can read." },
    product_name: { type: "string", description: "What the product is, as a person would say it, e.g. 'Garden peas'. Empty if unreadable." },
    brand: nullable({ type: "string" }),
    quantity: nullable({ type: "number", description: "How many of the unit are in the photo, usually 1 pack." }),
    unit: { type: "string", enum: ["item", "portion", "pack", "g", "kg", "ml", "l"] },
    weight_value: nullable({ type: "number", description: "Net weight or volume printed on the pack." }),
    weight_unit: nullable({ type: "string", enum: ["g", "kg", "ml", "l"] }),
    use_by_date: nullable({ type: "string", description: "YYYY-MM-DD" }),
    best_before_date: nullable({ type: "string", description: "YYYY-MM-DD" }),
    uncertain: { type: "array", items: { type: "string", enum: FIELDS } },
    barcode: nullable({ type: "string", description: "The digits printed under the barcode, digits only, else null." }),
    wine: nullable({
      type: "object",
      additionalProperties: false,
      required: ["vintage", "colour", "grape", "region", "drink_from", "drink_until"],
      properties: {
        vintage: nullable({ type: "integer", description: "The year printed on the label, else null (non-vintage)." }),
        colour: { type: "string", enum: WINE_COLOURS },
        grape: nullable({ type: "string", description: "Grape or blend, e.g. 'Tempranillo' or 'Cabernet Sauvignon, Merlot'." }),
        region: nullable({ type: "string", description: "Region and country, e.g. 'Rioja, Spain'." }),
        drink_from: nullable({ type: "integer", description: "First year it is likely to be good to drink." }),
        drink_until: nullable({ type: "integer", description: "Last year it is likely to be at its best." }),
      },
    }),
  },
} as const;

const SYSTEM = `You read photos of food and household product labels, wine labels and books, for a UK home inventory app.
Return only what is printed or clearly visible. Never guess a date that isn't printed, and never decide whether food is safe.
You may get several photos of the same pack, for example the front and the back. Combine them into one reading: the name usually comes from the front, while dates and weights are often on the back, the side or the lid.

- product_name: a short, natural name a person would use, in sentence case, without marketing words or the brand. Always write it out in full words (e.g. "Meat-free sausages", never a code or initials).
- brand: the brand if printed, else null.
- quantity and unit: how many are being put away. A single pack is quantity 1, unit "pack". Loose countable things are "item". Use "portion" only for home-made or portioned food. If unsure, quantity 1, unit "pack".
- weight_value and weight_unit: the net weight or volume printed (e.g. 750 g, 1.5 l), else null.
- Dates are en-GB: 03/04 means 3 April. "Use by" goes in use_by_date. "Best before", "BB", "BBE" and "Best before end" go in best_before_date. If no year is printed, use the next date on or after today's date minus 30 days. If only a month and year are printed, use the last day of that month. Use YYYY-MM-DD.
- barcode: if a barcode is visible, the 8 to 14 digits printed under it, digits only. On a book this is the ISBN, usually 13 digits starting 978 or 979. Null if there is no barcode or you can't read every digit clearly.
- For a book, product_name is the title and brand is the author, and the unit is "item". If you can only see the back cover, write the title if it is printed there, otherwise leave product_name empty and list it in uncertain, but still read the barcode and set readable to true.
- Wine (and port, sherry, champagne and other bottled wine): product_name is the wine as a person would say it, without the vintage year, e.g. "Château Musar", "Rioja Reserva", "Picpoul de Pinet". brand is the producer or château if it differs from the name, else null. The unit is "item" (bottles) and quantity is 1 unless you can see more bottles. Fill in wine: vintage only if a year is printed; colour (rose for rosé, sparkling for champagne, prosecco, cava and other fizz, sweet for dessert wines, fortified for port, sherry and madeira); grape and region from the label, or from what you reliably know about this wine; drink_from and drink_until as a sensible drinking window in years for this wine and vintage, using what you know about the style (most everyday wines are best within two or three years of the vintage; good reds and sweet wines keep longer). The drinking window is always an estimate. For anything that isn't wine, wine is null. Spirits, beer and cider are not wine.
- uncertain: list every field you inferred, guessed or read from blurry or partly hidden print, including any date where you had to supply the year or day.
- If there is no readable product or label, set readable to false, product_name to "" and everything else to null or the defaults.`;

const MANY_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["readable", "kind", "items"],
  properties: {
    readable: { type: "boolean", description: "False if the photos show no separate things you can make out." },
    kind: { type: "string", enum: ["books", "clothes", "shoes", "games", "music", "films", "food", "tools", "mixed", "other"] },
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "detail", "category", "quantity", "unsure"],
        properties: {
          name: { type: "string", description: "A book's title, or a short description of the thing, e.g. 'Navy wool jumper'." },
          detail: nullable({ type: "string", description: "A book's author; otherwise a brand or maker if visible. Null if none." }),
          category: { type: "string", description: "A short shelf-style group to sort by, e.g. 'Crime & thrillers' or 'Jumpers & knitwear'." },
          quantity: { type: "integer", description: "How many of this exact thing, usually 1." },
          unsure: { type: "boolean", description: "True if any part was guessed or the print was hard to read." },
        },
      },
    },
  },
} as const;

const MANY_SYSTEM = `You list the separate things in photos of a shelf, rail, drawer or cupboard for a UK home inventory app, so a person can add them all at once and then check the list.
You may get up to three photos of the same place (say the left and right halves of a long shelf). Count each real thing once, even where photos overlap.

Books (spines and covers):
- name is the title as printed, in title case, without series numbers or "a novel". Include a subtitle only if it is needed to tell books apart.
- detail is the author as a person would say it ("Hilary Mantel"). Null if it isn't printed and you don't know it for certain.
- If you can read only part of a title or author, write what you can and set unsure. If a spine is unreadable, leave that book out.
- category is a bookshop section: Fiction, Crime & thrillers, Sci-fi & fantasy, Children's, Biography & memoir, History, Cookery, Travel, Nature, Art & design, Health & wellbeing, Business, Reference, Poetry, Religion & philosophy, or another short section if none fits. Use what you know about the book; if you don't know it, choose from the title and set unsure.

Clothes, shoes and accessories:
- name is what a person would call it: colour, then material or pattern if obvious, then the type ("Navy wool jumper", "Black ankle boots", "Striped cotton shirt"). Never invent a brand.
- detail is the brand only if a label or logo is clearly readable, else null.
- category is one of: Tops & T-shirts, Shirts & blouses, Jumpers & knitwear, Hoodies & sweatshirts, Coats & jackets, Suits & blazers, Dresses, Skirts, Trousers & jeans, Shorts, Sportswear, Nightwear, Underwear & socks, Shoes, Boots, Bags, Hats & scarves, Belts & ties, Accessories.
- Folded piles: count what you can see; identical items together are one entry with a quantity.

Anything else (games, DVDs, records, tools, toys, tins, craft supplies):
- name is the title or a short plain name; detail is the maker, brand, artist or platform if printed; category is a short, natural group for that place ("Board games", "Vinyl", "Power tools").

Always:
- Write names in full words, in the language printed. No marketing words. Never make up titles, authors or brands.
- quantity is 1 unless there are several of exactly the same thing.
- List the things in a natural order: left to right, top shelf first.
- If you can't make out any separate things, set readable to false and items to [].`;

function reply(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

function mediaType(bytes: Uint8Array): "image/webp" | "image/jpeg" | "image/png" | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  const riff = String.fromCharCode(...bytes.slice(0, 4));
  const webp = String.fromCharCode(...bytes.slice(8, 12));
  if (riff === "RIFF" && webp === "WEBP") return "image/webp";
  return null;
}

/** A real EAN-8, UPC-A, EAN-13 or GTIN-14: the right length and a correct check digit. */
function validBarcode(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const code = v.replace(/[\s-]/g, "");
  if (!/^(\d{8}|\d{12}|\d{13}|\d{14})$/.test(code)) return null;
  const digits = [...code].map(Number);
  const check = digits.pop()!;
  const sum = digits.reverse().reduce((acc, d, i) => acc + d * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check ? code : null;
}

function base64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return reply(405, { error: "bad_request" });

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  const url = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  if (!apiKey) return reply(503, { error: "not_configured" });

  // Who is asking. The caller's own token is used for everything that RLS can check.
  const authorization = req.headers.get("Authorization") ?? "";
  const token = authorization.replace(/^Bearer\s+/i, "");
  const asUser = createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: auth } = await asUser.auth.getUser(token);
  const user = auth?.user;
  if (!user) return reply(401, { error: "not_signed_in" });

  let householdId = "";
  let imagePaths: string[] = [];
  let many = false;
  try {
    const body = await req.json();
    householdId = String(body?.householdId ?? "");
    many = body?.mode === "many";
    const raw = Array.isArray(body?.imagePaths) ? body.imagePaths : body?.imagePath ? [body.imagePath] : [];
    imagePaths = raw.map((p: unknown) => String(p));
  } catch {
    return reply(400, { error: "bad_request" });
  }
  const pathOk = (p: string) => p.startsWith(`${householdId}/`) && !p.includes("..") && p.length <= 200;
  if (!UUID.test(householdId) || imagePaths.length < 1 || imagePaths.length > MAX_PHOTOS || !imagePaths.every(pathOk)) {
    return reply(400, { error: "bad_request" });
  }
  const imagePath = imagePaths[0];

  const { data: member } = await asUser.rpc("is_member", { hid: householdId });
  if (member !== true) return reply(403, { error: "not_member" });

  // Usage limits. reserve_scan checks them and records this scan in one step, under a lock, so scans
  // sent at the same moment can't slip past. Every exit below fills in the reserved row.
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: reserved, error: reserveError } = await admin.rpc("reserve_scan", {
    p_household: householdId,
    p_user: user.id,
    p_image_path: imagePath,
    p_model: MODEL,
    p_per_user_minute: PER_USER_PER_MINUTE,
    p_per_user_month: PER_USER_PER_MONTH,
    p_per_household_day: PER_HOUSEHOLD_PER_DAY,
  });
  const slot = Array.isArray(reserved) ? reserved[0] : reserved;
  if (reserveError || !slot) return reply(500, { error: "failed" });
  if (slot.refused) return reply(429, { error: slot.refused });
  const attemptId: string = slot.attempt_id;

  const log = (fields: Record<string, unknown>) =>
    admin.from("ai_extraction_attempts").update({ error_code: null, ...fields }).eq("id", attemptId);

  // Read the photos as the caller, so the bucket's household policy applies as well.
  const images: { type: "image/webp" | "image/jpeg" | "image/png"; data: string }[] = [];
  for (const path of imagePaths) {
    const { data: file, error: fileError } = await asUser.storage.from("item-photos").download(path);
    if (fileError || !file) {
      await log({ error_code: "no_photo" });
      return reply(400, { error: "bad_request" });
    }
    if (file.size > MAX_BYTES) {
      await log({ error_code: "image_too_large" });
      return reply(413, { error: "image_too_large" });
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const type = mediaType(bytes);
    if (!type) {
      await log({ error_code: "bad_image" });
      return reply(400, { error: "unreadable" });
    }
    images.push({ type, data: base64(bytes) });
  }

  const today = new Date().toISOString().slice(0, 10);
  const started = Date.now();
  try {
    const anthropic = new Anthropic({ apiKey, maxRetries: 1, timeout: many ? 110_000 : 45_000 });
    const pictures = images.map((img) => ({ type: "image" as const, source: { type: "base64" as const, media_type: img.type, data: img.data } }));
    const response = await anthropic.messages.create({
      model: MODEL,
      // A full bookshelf is a long list, and reading small spines needs a little more care.
      max_tokens: many ? 16000 : 4000,
      output_config: { effort: many ? "medium" : "low", format: { type: "json_schema", schema: many ? MANY_SCHEMA : SCHEMA } },
      system: many ? MANY_SYSTEM : SYSTEM,
      messages: [
        {
          role: "user",
          content: [
            ...pictures,
            {
              type: "text",
              text: many
                ? `List every separate thing you can make out${images.length > 1 ? ` across these ${images.length} photos of the same place` : " in this photo"}.`
                : `Today is ${today}. Read this label${images.length > 1 ? ` from these ${images.length} photos of the same pack` : ""}.`,
            },
          ],
        },
      ],
    });
    const usage = {
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
      latency_ms: Date.now() - started,
    };

    if (response.stop_reason === "refusal") {
      await log({ ...usage, error_code: "refusal" });
      return reply(422, { error: "unreadable" });
    }
    const text = response.content.find((b) => b.type === "text");
    if (response.stop_reason !== "end_turn" || !text || text.type !== "text") {
      await log({ ...usage, error_code: `stop_${response.stop_reason}` });
      return reply(502, { error: "failed" });
    }
    const reading = JSON.parse(text.text);
    if (many) {
      const items = Array.isArray(reading?.items) ? reading.items.slice(0, MAX_ITEMS) : [];
      await log({ ...usage, parsed_json: { kind: reading?.kind, count: items.length }, error_code: items.length ? null : "none_found" });
      if (reading?.readable === false || !items.length) return reply(422, { error: "unreadable" });
      return reply(200, { list: { kind: reading.kind, items } });
    }
    const barcode = validBarcode(reading?.barcode);
    if (reading?.readable === false && !barcode) {
      await log({ ...usage, parsed_json: reading });
      return reply(422, { error: "unreadable" });
    }
    reading.barcode = barcode;
    const fromCache = barcode ? await useProductList(admin, user.id, barcode, reading) : false;
    const fromPublic = barcode && !fromCache ? await usePublicList(barcode, reading) : null;
    if (fromPublic) reading.readable = true;
    await log({ ...usage, parsed_json: { ...reading, looked_up: fromPublic }, barcode, from_cache: fromCache });
    if (reading.readable === false || !String(reading.product_name ?? "").trim()) return reply(422, { error: "unreadable" });
    return reply(200, { reading });
  } catch (err) {
    const code =
      err instanceof Anthropic.RateLimitError
        ? "anthropic_rate_limited"
        : err instanceof Anthropic.AuthenticationError
          ? "anthropic_auth"
          : err instanceof Anthropic.APIError
            ? `anthropic_${err.status ?? "error"}`
            : err instanceof SyntaxError
              ? "bad_json"
              : "failed";
    await log({ latency_ms: Date.now() - started, error_code: code });
    return reply(code === "anthropic_auth" ? 503 : 502, { error: code === "anthropic_auth" ? "not_configured" : "failed" });
  }
});

type Reading = Record<string, unknown> & { uncertain?: unknown };

/**
 * Shares what a barcode is across households. A barcode's name, brand and weight are shared only once
 * two different people have scanned it and read the same name (share_product_reading in the database
 * decides). When it is shared, those details replace the reading's and are no longer marked
 * uncertain. Dates are never shared. Returns true when the shared details were used. Never throws:
 * the reading stands on its own if the list can't be reached.
 */
async function useProductList(admin: SupabaseClient, userId: string, barcode: string, reading: Reading): Promise<boolean> {
  try {
    const uncertain = Array.isArray(reading.uncertain) ? (reading.uncertain as string[]) : [];
    const name = typeof reading.product_name === "string" && !uncertain.includes("product_name") ? reading.product_name.trim() : "";
    const brand = typeof reading.brand === "string" && !uncertain.includes("brand") ? reading.brand.trim() : "";
    const weightOk = !uncertain.includes("weight") && typeof reading.weight_value === "number" && ["g", "kg", "ml", "l"].includes(String(reading.weight_unit));
    const { data: known, error } = await admin.rpc("share_product_reading", {
      p_barcode: barcode,
      p_user: userId,
      p_name: name || null,
      p_brand: brand || null,
      p_weight_value: weightOk ? reading.weight_value : null,
      p_weight_unit: weightOk ? reading.weight_unit : null,
    });
    if (error || !known || typeof known !== "object") return false;
    reading.product_name = known.product_name;
    reading.brand = known.brand;
    if (known.weight_value != null && known.weight_unit) {
      reading.weight_value = Number(known.weight_value);
      reading.weight_unit = known.weight_unit;
    }
    reading.uncertain = uncertain.filter((f) => f !== "product_name" && f !== "brand" && (f !== "weight" || known.weight_value == null));
    return true;
  } catch {
    return false;
  }
}

// ---- Public barcode lists ----

type Found = { name: string; brand: string | null; weight_value: number | null; weight_unit: string | null };

function isIsbn(barcode: string): boolean {
  return /^97[89]\d{10}$/.test(barcode);
}

function clean(v: unknown, max: number): string {
  return typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

async function getJson(url: string, fetcher: typeof fetch): Promise<unknown> {
  const res = await fetcher(url, {
    headers: { "User-Agent": LOOKUP_AGENT, Accept: "application/json" },
    signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
  });
  return res.ok ? await res.json() : null;
}

/** A book's title and authors from Open Library's search, or null if it doesn't know the ISBN. */
async function lookUpBook(isbn: string, fetcher: typeof fetch): Promise<Found | null> {
  const data = (await getJson(
    `https://openlibrary.org/search.json?isbn=${isbn}&fields=title,subtitle,author_name&limit=1`,
    fetcher,
  )) as { docs?: { title?: unknown; author_name?: unknown }[] } | null;
  const doc = data?.docs?.[0];
  const name = clean(doc?.title, 120);
  if (!name) return null;
  const authors = Array.isArray(doc?.author_name) ? doc.author_name.map((a) => clean(a, 60)).filter(Boolean) : [];
  const brand = authors.length > 2 ? `${authors[0]} and others` : authors.join(" and ");
  return { name, brand: brand.slice(0, 80) || null, weight_value: null, weight_unit: null };
}

/** A product's name, brand and net weight from Open Food Facts, or null if it doesn't know the code. */
async function lookUpProduct(barcode: string, fetcher: typeof fetch): Promise<Found | null> {
  const data = (await getJson(
    `https://world.openfoodfacts.org/api/v2/product/${barcode}.json?fields=product_name_en,product_name,brands,product_quantity,product_quantity_unit`,
    fetcher,
  )) as { status?: unknown; product?: Record<string, unknown> } | null;
  const p = data?.status === 1 ? data.product : null;
  const name = clean(p?.product_name_en, 120) || clean(p?.product_name, 120);
  if (!p || !name) return null;
  const brand = clean(String(p.brands ?? "").split(",")[0], 80) || null;
  const value = Number(p.product_quantity);
  const unit = String(p.product_quantity_unit ?? "").toLowerCase();
  const weightOk = Number.isFinite(value) && value > 0 && value <= 100_000 && ["g", "kg", "ml", "l"].includes(unit);
  return { name, brand, weight_value: weightOk ? value : null, weight_unit: weightOk ? unit : null };
}

/**
 * Fills a reading in from the public barcode lists when the shared list didn't know the barcode.
 * Books take their title and author from Open Library. Other products take Open Food Facts' name and
 * brand only where the photo left them empty or uncertain, and its weight only if the photo had none.
 * Dates always stay as the photo had them. Returns which list answered, or null. Never throws.
 */
async function usePublicList(barcode: string, reading: Reading, fetcher: typeof fetch = fetch): Promise<string | null> {
  try {
    const book = isIsbn(barcode);
    const found = book ? await lookUpBook(barcode, fetcher) : await lookUpProduct(barcode, fetcher);
    if (!found) return null;
    let uncertain = Array.isArray(reading.uncertain) ? (reading.uncertain as string[]) : [];
    const doubtful = (field: string, value: unknown) => !clean(value, 200) || uncertain.includes(field);
    if (book || doubtful("product_name", reading.product_name)) {
      reading.product_name = found.name;
      uncertain = uncertain.filter((f) => f !== "product_name");
    }
    if (found.brand && (book || doubtful("brand", reading.brand))) {
      reading.brand = found.brand;
      uncertain = uncertain.filter((f) => f !== "brand");
    }
    if (found.weight_value != null && (reading.weight_value == null || uncertain.includes("weight"))) {
      reading.weight_value = found.weight_value;
      reading.weight_unit = found.weight_unit;
      uncertain = uncertain.filter((f) => f !== "weight");
    }
    if (book) {
      reading.quantity = 1;
      reading.unit = "item";
      reading.weight_value = null;
      reading.weight_unit = null;
    }
    reading.uncertain = uncertain;
    return book ? "open_library" : "open_food_facts";
  } catch {
    return null;
  }
}
