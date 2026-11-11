import { supabase } from "@/lib/supabase/client";
import { KEYS, writeLocal } from "@/lib/storage";

/** How the current session was signed in, newest first, from the token's amr claim ("otp", "password", ...). */
export function signInMethods(accessToken: string): string[] {
  try {
    const part = accessToken.split(".")[1] ?? "";
    const json = atob(part.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(part.length / 4) * 4, "="));
    const amr = JSON.parse(json)?.amr;
    if (!Array.isArray(amr)) return [];
    return [...amr]
      .sort((a, b) => (Number(b?.timestamp) || 0) - (Number(a?.timestamp) || 0))
      .map((a) => String(a?.method ?? ""))
      .filter(Boolean);
  } catch {
    return [];
  }
}

/** Accounts that last signed in with a password confirm with it; everyone else gets an email code. */
export function confirmsWithPassword(accessToken: string): boolean {
  return signInMethods(accessToken)[0] === "password";
}

/**
 * Deletes the signed-in person's account with the delete-account Edge Function. The person must have
 * signed in again in the last few minutes. Afterwards the session is cleared on this device; every
 * other device is signed out because the account no longer exists.
 */
export async function deleteMyAccount(): Promise<void> {
  const { data, error } = await supabase().functions.invoke("delete-account", { body: {} });
  if (error) {
    let code = "";
    try {
      code = (await (error as { context?: Response }).context?.json())?.error ?? "";
    } catch {
      /* not JSON */
    }
    throw new Error(code === "reauth_needed" ? "reauth_needed" : "delete_failed");
  }
  if (!(data as { ok?: boolean })?.ok) throw new Error("delete_failed");
  writeLocal(KEYS.household, null);
  writeLocal(KEYS.lastPlace, null);
  writeLocal(KEYS.searches, null);
  writeLocal(KEYS.pendingInvite, null);
  writeLocal(KEYS.accountDeleted, "1"); // the sign-in screen says so once
  await supabase().auth.signOut({ scope: "local" });
}
