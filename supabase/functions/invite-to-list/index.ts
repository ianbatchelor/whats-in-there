// invite-to-list: invites someone by email into the app for one present list (Carol, for Michele's).
//
// One self-contained file so it can be pasted into the Supabase dashboard editor as well as deployed
// with `supabase functions deploy invite-to-list`. Supabase provides SUPABASE_URL and SUPABASE_ANON_KEY.
// Sending email needs the RESEND_API_KEY secret (a Resend key that can send from seewhatsinhere.com).
// Without it the invitation is still made, and the app shows the link to send by hand.
//
// Flow: the app sends a list and an email address. The function calls invite_to_wish_list as the
// signed-in person, so the database decides whether they may invite anyone (they must live in the
// list's household), caps invitations at 20 a day each, and refuses the list's own person. It then
// emails a fixed message with the link. Nothing the caller types goes into the email except through
// the database (names), and those are escaped, so this can't be used to send arbitrary mail.

import { createClient } from "npm:@supabase/supabase-js@2.118.0";

const SITE = "https://seewhatsinhere.com";
const FROM = "See What's in Here <hello@seewhatsinhere.com>";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KNOWN = new Set(["not_found", "bad_email", "own_list", "too_many_invites", "not_signed_in"]);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function reply(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function firstName(s: string): string {
  return s.trim().split(/\s+/)[0] || s;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return reply(405, { error: "bad_request" });

  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return reply(401, { error: "not_signed_in" });

  let body: { listId?: unknown; email?: unknown };
  try {
    body = await req.json();
  } catch {
    return reply(400, { error: "bad_request" });
  }
  const listId = typeof body.listId === "string" && UUID.test(body.listId) ? body.listId : null;
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!listId) return reply(400, { error: "bad_request" });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 254) return reply(400, { error: "bad_email" });

  // Everything as the signed-in person, so the database's own checks apply.
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });

  const { data: token, error } = await db.rpc("invite_to_wish_list", { p_list: listId, p_email: email });
  if (error || typeof token !== "string") {
    const code = error?.message && KNOWN.has(error.message) ? error.message : "failed";
    return reply(code === "failed" ? 500 : 400, { error: code });
  }

  const { data: rows } = await db.rpc("wish_list_invite_preview", { p_token: token });
  const preview = (rows as { name: string; invited_by: string }[] | null)?.[0];
  const key = Deno.env.get("RESEND_API_KEY");
  if (!preview || !key) return reply(200, { token, emailed: false });

  const link = `${SITE}/list-invite/?t=${encodeURIComponent(token)}`;
  const who = firstName(preview.invited_by);
  const whose = firstName(preview.name);
  const subject = `${who} shared ${whose}'s present list with you`;
  const text = [
    `${who} has shared ${whose}'s present list with you on See What's in Here.`,
    ``,
    `You'll see the ideas nobody is getting yet, and can say "I'm getting this" so no one buys the same thing twice. ${whose} won't see who's getting what.`,
    ``,
    `Open the list: ${link}`,
    ``,
    `Sign in with this email address (${email}). We'll send you a code, no password. The link works once and lasts 7 days.`,
    ``,
    `You'll only see this one list, nothing else of theirs. If you weren't expecting this, you can ignore it.`,
  ].join("\n");
  const html = `<!doctype html><html><body style="margin:0;background:#f6f5f1;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#15211c">
<div style="max-width:520px;margin:0 auto;padding:32px 20px">
<div style="background:#8f2d2d;height:10px;border-radius:10px 10px 0 0"></div>
<div style="background:#ffffff;border:1px solid #e5e3dd;border-top:0;border-radius:0 0 16px 16px;padding:28px 24px">
<p style="margin:0 0 6px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#2f6b50;font-weight:700">Present ideas</p>
<h1 style="margin:0 0 14px;font-family:Georgia,serif;font-size:26px;line-height:1.15">${esc(who)} shared ${esc(whose)}&#39;s present list with you</h1>
<p style="margin:0 0 14px;font-size:16px;line-height:1.5;color:#3d4743">You&#39;ll see the ideas nobody is getting yet, and can tap &ldquo;I&#39;m getting this&rdquo; so no one buys the same thing twice. ${esc(whose)} won&#39;t see who&#39;s getting what.</p>
<p style="margin:22px 0"><a href="${esc(link)}" style="display:inline-block;background:#1e4a38;color:#ffffff;text-decoration:none;font-weight:700;font-size:16px;padding:13px 22px;border-radius:12px">Open ${esc(whose)}&#39;s list</a></p>
<p style="margin:0 0 10px;font-size:14px;line-height:1.5;color:#66706b">Sign in with this email address (${esc(email)}). We&#39;ll send you a code, no password. The link works once and lasts 7 days.</p>
<p style="margin:0;font-size:14px;line-height:1.5;color:#66706b">You&#39;ll only see this one list, nothing else of theirs. If you weren&#39;t expecting this, you can ignore it.</p>
</div></div></body></html>`;

  try {
    const sent = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to: [email], subject, text, html }),
      signal: AbortSignal.timeout(8000),
    });
    return reply(200, { token, emailed: sent.ok });
  } catch {
    return reply(200, { token, emailed: false });
  }
});
