// send-notifications: sends phone notifications through Apple (APNs), straight from Supabase. No
// Firebase or other service in between.
//
// Two ways in:
//   - pg_cron calls it with the x-cron-secret header (supabase/scripts/notifications-cron.sql): every
//     minute while something is waiting, and on the hour regardless. It asks notifications_due() what's
//     ready (lists and places quiet for a few minutes, or daily summaries at 6 pm, outside each person's
//     quiet hours), sends one message per person and list or place, and marks them sent. Then it sends
//     the morning reminders from place_reminders_due() (things to use soon).
//   - The "Send me a test" button on the Notifications page calls it signed in, with {"test": true}.
//     That sends one message to the caller's own phones and nothing else.
//
// Secret (Supabase > Edge Functions > Secrets): APNS_KEY, the .p8 file's whole text. The key's id and
// the Apple team aren't secret, so they default here (APNS_KEY_ID, APNS_TEAM_ID override them). The
// cron secret lives in Vault and is read through notify_cron_secret(). Verify JWT is off: the function
// checks the cron secret or the caller's sign-in itself.

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.118.0";
import { message, reminder, type Due, type Message, type Reminder } from "./message.ts";

const TOPIC = Deno.env.get("APNS_TOPIC") ?? "com.seewhatsinhere.app";
const HOSTS = { production: "api.push.apple.com", sandbox: "api.sandbox.push.apple.com" } as const;
type Env = keyof typeof HOSTS;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function reply(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

function sameSecret(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// ---------- Apple's sign-in token (ES256), reused for 50 minutes as Apple asks ----------

const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const b64urlText = (s: string) => b64url(new TextEncoder().encode(s));

let cached: { jwt: string; at: number } | null = null;

async function appleToken(): Promise<string> {
  if (cached && Date.now() - cached.at < 50 * 60_000) return cached.jwt;
  const pem = Deno.env.get("APNS_KEY") ?? "";
  const keyId = Deno.env.get("APNS_KEY_ID") ?? "5F74X37223";
  const team = Deno.env.get("APNS_TEAM_ID") ?? "GS73N238CQ";
  if (!pem || !keyId || !team) throw new Error("apns_not_set_up");
  const der = Uint8Array.from(atob(pem.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "")), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("pkcs8", der, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const head = `${b64urlText(JSON.stringify({ alg: "ES256", kid: keyId }))}.${b64urlText(JSON.stringify({ iss: team, iat: Math.floor(Date.now() / 1000) }))}`;
  const sig = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, new TextEncoder().encode(head)));
  cached = { jwt: `${head}.${b64url(sig)}`, at: Date.now() };
  return cached.jwt;
}

// ---------- Sending ----------

type Outcome = "sent" | "wrong_env" | "gone" | "failed";

async function push(env: Env, token: string, m: Message): Promise<Outcome> {
  const res = await fetch(`https://${HOSTS[env]}/3/device/${token}`, {
    method: "POST",
    headers: {
      authorization: `bearer ${await appleToken()}`,
      "apns-topic": TOPIC,
      "apns-push-type": "alert",
      "apns-priority": "10",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      aps: { alert: { title: m.title, body: m.body }, sound: "default", "thread-id": m.thread },
      url: m.url,
      ...(m.circle ? { circle: m.circle } : {}),
    }),
  });
  if (res.ok) return "sent";
  const reason = ((await res.json().catch(() => ({}))) as { reason?: string }).reason ?? "";
  if (res.status === 410 || reason === "Unregistered") return "gone";
  // A token from an Xcode build only works with the sandbox, and a TestFlight one only with production.
  if (reason === "BadDeviceToken" || reason === "DeviceTokenNotForTopic") return "wrong_env";
  console.error("apns", res.status, reason);
  return "failed";
}

/** Sends to one phone, finding out which of Apple's two services it belongs to the first time. */
async function sendTo(admin: SupabaseClient, device: { token: string; env: Env | null }, m: Message): Promise<boolean> {
  const order: Env[] = device.env ? [device.env] : ["production", "sandbox"];
  for (const env of order) {
    const out = await push(env, device.token, m);
    if (out === "sent") {
      if (device.env !== env) await admin.from("push_devices").update({ apns_env: env }).eq("token", device.token);
      return true;
    }
    if (out === "gone") {
      await admin.from("push_devices").delete().eq("token", device.token);
      return false;
    }
    if (out === "failed") return false;
  }
  // Neither service knows it: an old token from a reinstalled app.
  if (!device.env) await admin.from("push_devices").delete().eq("token", device.token);
  else await admin.from("push_devices").update({ apns_env: null }).eq("token", device.token);
  return false;
}

async function runQueue(admin: SupabaseClient) {
  const { data, error } = await admin.rpc("notifications_due");
  if (error) throw error;
  let sent = 0;
  for (const due of (data ?? []) as Due[]) {
    const m = message(due);
    for (const d of due.devices) if (await sendTo(admin, d, m)) sent++;
    const { error: e2 } = await admin.from("notify_events").update({ sent_at: new Date().toISOString() }).in("id", due.event_ids);
    if (e2) throw e2;
  }
  // Morning reminders for places people follow: at most one a day each, noted before sending so a
  // slow run can't send it twice.
  const { data: rems, error: e3 } = await admin.rpc("place_reminders_due");
  if (e3) throw e3;
  for (const r of (rems ?? []) as Reminder[]) {
    const { error: e4 } = await admin.from("notify_reminders_sent").insert({ user_id: r.recipient, place_id: r.place_id, day: r.day });
    if (e4) continue; // already sent today
    const m = reminder(r);
    for (const d of r.devices) if (await sendTo(admin, d, m)) sent++;
  }
  return { groups: (data ?? []).length, reminders: (rems ?? []).length, sent };
}

async function sendTest(admin: SupabaseClient, userId: string) {
  const { data, error } = await admin.from("push_devices").select("token, apns_env").eq("user_id", userId);
  if (error) throw error;
  const m: Message = { title: "See What's in Here", body: "Notifications are working. You'll hear here when something's added to a list you follow.", url: "/notifications/", thread: "test" };
  let sent = 0;
  for (const d of data ?? []) if (await sendTo(admin, { token: d.token as string, env: (d.apns_env as Env | null) ?? null }, m)) sent++;
  return { phones: (data ?? []).length, sent };
}

let cronCached: string | null = null;
async function cronSecret(admin: SupabaseClient): Promise<string> {
  if (cronCached) return cronCached;
  const { data, error } = await admin.rpc("notify_cron_secret");
  if (error) throw error;
  cronCached = (data as string | null) ?? "";
  return cronCached;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return reply(405, { error: "method" });
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  try {
    const cron = req.headers.get("x-cron-secret");
    if (cron && sameSecret(cron, await cronSecret(admin))) {
      return reply(200, await runQueue(admin));
    }
    const body = (await req.json().catch(() => ({}))) as { test?: boolean };
    const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!body.test || !token) return reply(401, { error: "unauthorized" });
    const { data: who, error } = await admin.auth.getUser(token);
    if (error || !who.user) return reply(401, { error: "unauthorized" });
    return reply(200, await sendTest(admin, who.user.id));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("send-notifications", msg);
    return reply(msg === "apns_not_set_up" ? 503 : 500, { error: msg === "apns_not_set_up" ? msg : "failed" });
  }
});
