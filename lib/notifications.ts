import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { supabase } from "@/lib/supabase/client";
import { KEYS, readLocal, writeLocal } from "@/lib/storage";
import { startingMode, type NotifyKind, type NotifyMode, type Visibility } from "@/lib/domain/notifications";

export type NotifyPrefs = { paused: boolean; quietFrom: number; quietTo: number; timeZone: string };
export const DEFAULT_PREFS: NotifyPrefs = { paused: false, quietFrom: 22, quietTo: 8, timeZone: "Europe/London" };

/** Only the iPhone app can show notifications. */
export const canNotify = () => Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios";

export type Permission = "granted" | "denied" | "prompt";

export async function permission(): Promise<Permission> {
  if (!canNotify()) return "denied";
  const { receive } = await PushNotifications.checkPermissions();
  return receive === "granted" ? "granted" : receive === "denied" ? "denied" : "prompt";
}

/** Asks Apple for this phone's address and keeps it against whoever is signed in. */
function register(): Promise<void> {
  return new Promise((resolve, reject) => {
    let done = false;
    const finish = (fn: () => void) => {
      if (done) return;
      done = true;
      ok.then((h) => h.remove());
      bad.then((h) => h.remove());
      fn();
    };
    const ok = PushNotifications.addListener("registration", ({ value }) =>
      finish(() => {
        writeLocal(KEYS.pushToken, value);
        supabase()
          .rpc("register_push_device", { p_token: value })
          .then(({ error }) => (error ? reject(error) : resolve()));
      }),
    );
    const bad = PushNotifications.addListener("registrationError", (e) => finish(() => reject(new Error(e.error))));
    PushNotifications.register().catch((e) => finish(() => reject(e)));
  });
}

/**
 * Turning a bell on: ask the phone's permission the first time (not when the app opens), then
 * register. Returns false if the person has said no to notifications in the phone's Settings.
 */
export async function askToNotify(): Promise<boolean> {
  if (!canNotify()) return true; // the choice is still saved, for when they use the app
  let p = await permission();
  if (p === "prompt") p = (await PushNotifications.requestPermissions()).receive === "granted" ? "granted" : "denied";
  if (p !== "granted") return false;
  await register();
  return true;
}

/** On opening the app: if notifications are already allowed, refresh this phone's address. */
export async function refreshDevice(): Promise<void> {
  if (!canNotify() || (await permission()) !== "granted") return;
  await register();
}

/** Signing out: stop sending to this phone. */
export async function forgetDevice(): Promise<void> {
  const token = readLocal(KEYS.pushToken);
  if (!token) return;
  await supabase().rpc("forget_push_device", { p_token: token });
  writeLocal(KEYS.pushToken, null);
}

export async function loadFollow(kind: NotifyKind, id: string, visibility?: Visibility): Promise<NotifyMode> {
  const { data, error } = await supabase().from("notify_follows").select("mode").eq("target_kind", kind).eq("target_id", id).maybeSingle();
  if (error) throw error;
  return (data?.mode as NotifyMode | undefined) ?? startingMode(kind, visibility);
}

/** Every bell you've set, by "kind:id". */
export async function loadFollows(): Promise<Map<string, NotifyMode>> {
  const { data, error } = await supabase().from("notify_follows").select("target_kind, target_id, mode");
  if (error) throw error;
  return new Map((data ?? []).map((r) => [`${r.target_kind}:${r.target_id}`, r.mode as NotifyMode]));
}

export async function setFollow(kind: NotifyKind, id: string, mode: NotifyMode): Promise<void> {
  const { error } = await supabase().from("notify_follows").upsert({ target_kind: kind, target_id: id, mode }, { onConflict: "user_id,target_kind,target_id" });
  if (error) throw error;
}

export async function loadPrefs(): Promise<NotifyPrefs> {
  const { data, error } = await supabase().from("notify_prefs").select("paused, quiet_from, quiet_to, time_zone").maybeSingle();
  if (error) throw error;
  if (!data) return { ...DEFAULT_PREFS, timeZone: localZone() };
  return { paused: data.paused as boolean, quietFrom: data.quiet_from as number, quietTo: data.quiet_to as number, timeZone: data.time_zone as string };
}

export async function savePrefs(p: NotifyPrefs): Promise<void> {
  const { error } = await supabase()
    .from("notify_prefs")
    .upsert({ paused: p.paused, quiet_from: p.quietFrom, quiet_to: p.quietTo, time_zone: p.timeZone }, { onConflict: "user_id" });
  if (error) throw error;
}

/** Whether this account has a phone that will get notifications. */
export async function hasPhone(): Promise<boolean> {
  const { count, error } = await supabase().from("push_devices").select("token", { count: "exact", head: true });
  if (error) return false;
  return (count ?? 0) > 0;
}

export async function sendTest(): Promise<number> {
  const { data, error } = await supabase().functions.invoke("send-notifications", { body: { test: true } });
  if (error) throw error;
  return (data as { sent?: number })?.sent ?? 0;
}

export function localZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_PREFS.timeZone;
  } catch {
    return DEFAULT_PREFS.timeZone;
  }
}
