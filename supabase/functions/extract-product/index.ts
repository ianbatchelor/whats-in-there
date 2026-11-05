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

import Anthropic from "npm:@anthropic-ai/sdk@1.4.0";
import { createClient } from "npm:@supabase/supabase-js@2.118.0";

const MODEL = "claude-opus-5-5";
const PER_HOUSEHOLD_PER_DAY = 50;
const PER_USER_PER_MINUTE = 6;
const MAX_BYTES = 8 * 1024 * 1024;
const MAX_PHOTOS = 3;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const FIELDS = ["product_name", "brand", "quantity", "weight", "use_by_date", "best_before_date"];
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
  },
} as const;

const SYSTEM = `You read photos of food and household product labels for a UK home inventory app.
Return only what is printed or clearly visible. Never guess a date that isn't printed, and never decide whether food is safe.
You may get several photos of the same pack, for example the front and the back. Combine them into one reading: the name usually comes from the front, while dates and weights are often on the back, the side or the lid.

- product_name: a short, natural name a person would use, in sentence case, without marketing words or the brand. Always write it out in full words (e.g. "Meat-free sausages", never a code or initials).
- brand: the brand if printed, else null.
- quantity and unit: how many are being put away. A single pack is quantity 1, unit "pack". Loose countable things are "item". Use "portion" only for home-made or portioned food. If unsure, quantity 1, unit "pack".
- weight_value and weight_unit: the net weight or volume printed (e.g. 750 g, 1.5 l), else null.
- Dates are en-GB: 03/04 means 3 April. "Use by" goes in use_by_date. "Best before", "BB", "BBE" and "Best before end" go in best_before_date. If no year is printed, use the next date on or after today's date minus 30 days. If only a month and year are printed, use the last day of that month. Use YYYY-MM-DD.
- uncertain: list every field you inferred, guessed or read from blurry or partly hidden print, including any date where you had to supply the year or day.
- If there is no readable product or label, set readable to false, product_name to "" and everything else to null or the defaults.`;

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
  try {
    const body = await req.json();
    householdId = String(body?.householdId ?? "");
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

  // Usage limits, counted from the attempts log (written only by this function).
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const since = (ms: number) => new Date(Date.now() - ms).toISOString();
  const [day, minute] = await Promise.all([
    admin.from("ai_extraction_attempts").select("id", { count: "exact", head: true }).eq("household_id", householdId).gte("created_at", since(86_400_000)),
    admin.from("ai_extraction_attempts").select("id", { count: "exact", head: true }).eq("actor_user_id", user.id).gte("created_at", since(60_000)),
  ]);
  if (day.error || minute.error) return reply(500, { error: "failed" });
  if ((day.count ?? 0) >= PER_HOUSEHOLD_PER_DAY) return reply(429, { error: "too_many_today" });
  if ((minute.count ?? 0) >= PER_USER_PER_MINUTE) return reply(429, { error: "too_many_now" });

  const log = (fields: Record<string, unknown>) =>
    admin.from("ai_extraction_attempts").insert({ household_id: householdId, actor_user_id: user.id, image_path: imagePath, model: MODEL, ...fields });

  // Read the photos as the caller, so the bucket's household policy applies as well.
  const images: { type: "image/webp" | "image/jpeg" | "image/png"; data: string }[] = [];
  for (const path of imagePaths) {
    const { data: file, error: fileError } = await asUser.storage.from("item-photos").download(path);
    if (fileError || !file) return reply(400, { error: "bad_request" });
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
    const anthropic = new Anthropic({ apiKey, maxRetries: 1, timeout: 45_000 });
    const response = await anthropic.beta.messages.create({
      model: MODEL,
      max_tokens: 4000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: [
            ...images.map((img) => ({ type: "image" as const, source: { type: "base64" as const, media_type: img.type, data: img.data } })),
            { type: "text", text: `Today is ${today}. Read this label${images.length > 1 ? ` from these ${images.length} photos of the same pack` : ""}.` },
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
    await log({ ...usage, parsed_json: reading });
    if (reading?.readable === false) return reply(422, { error: "unreadable" });
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
