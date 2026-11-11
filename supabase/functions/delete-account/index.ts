// delete-account: deletes the signed-in person's account, for the "Delete my account" button.
//
// One self-contained file so it can be pasted into the Supabase dashboard editor as well as deployed
// with `supabase functions deploy delete-account`. It needs no secrets of its own: Supabase provides
// SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY to every function.
//
// Flow: the app asks the person to confirm by signing in again (a fresh email code, or their password
// for accounts that have one), then calls this function. The function:
//   1. checks the caller's token, and that they signed in within the last RECENT_SECONDS;
//   2. runs delete_account_data, which leaves every household (handing ownership on where needed) and
//      deletes the households where they were the only member, returning those ids;
//   3. deletes the photos stored under each deleted household;
//   4. deletes their sign-in (auth.users), which also ends every session on every device.

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.118.0";

const RECENT_SECONDS = 10 * 60;
const BUCKET = "item-photos";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function reply(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

/** The newest sign-in time in the token's amr claim (seconds), or 0. getUser has already verified the token. */
export function lastSignIn(token: string): number {
  try {
    const part = token.split(".")[1] ?? "";
    const json = atob(part.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(part.length / 4) * 4, "="));
    const amr = JSON.parse(json)?.amr;
    if (!Array.isArray(amr)) return 0;
    return Math.max(0, ...amr.map((a: { timestamp?: unknown }) => (typeof a?.timestamp === "number" ? a.timestamp : 0)));
  } catch {
    return 0;
  }
}

/** Every file under a folder of the bucket, however deep. */
async function filesUnder(admin: SupabaseClient, folder: string): Promise<string[]> {
  const out: string[] = [];
  const pending = [folder];
  while (pending.length) {
    const dir = pending.pop()!;
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await admin.storage.from(BUCKET).list(dir, { limit: 1000, offset });
      if (error) throw error;
      for (const entry of data ?? []) {
        const path = `${dir}/${entry.name}`;
        if (entry.id === null) pending.push(path); // a folder
        else out.push(path);
      }
      if (!data || data.length < 1000) break;
    }
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return reply(405, { error: "bad_request" });

  const url = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const authorization = req.headers.get("Authorization") ?? "";
  const token = authorization.replace(/^Bearer\s+/i, "");
  const asUser = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: auth } = await asUser.auth.getUser(token);
  const user = auth?.user;
  if (!user) return reply(401, { error: "not_signed_in" });

  if (Date.now() / 1000 - lastSignIn(token) > RECENT_SECONDS) return reply(403, { error: "reauth_needed" });

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  const { data: deleted, error: dataError } = await admin.rpc("delete_account_data", { p_user: user.id });
  if (dataError) {
    console.error("delete_account_data", dataError.message);
    return reply(500, { error: "failed" });
  }

  // Photos of households that no longer exist. Nobody can reach them any more (storage access needs
  // membership), so a failure here is logged and doesn't stop the account being deleted.
  for (const householdId of (deleted ?? []) as string[]) {
    try {
      const files = await filesUnder(admin, householdId);
      for (let i = 0; i < files.length; i += 500) {
        const { error } = await admin.storage.from(BUCKET).remove(files.slice(i, i + 500));
        if (error) throw error;
      }
    } catch (e) {
      console.error("photos", householdId, e instanceof Error ? e.message : e);
    }
  }

  const { error: userError } = await admin.auth.admin.deleteUser(user.id);
  if (userError) {
    console.error("deleteUser", userError.message);
    return reply(500, { error: "failed" });
  }
  return reply(200, { ok: true });
});
