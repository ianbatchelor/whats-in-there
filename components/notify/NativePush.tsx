"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { PushNotifications } from "@capacitor/push-notifications";
import { supabase } from "@/lib/supabase/client";
import { canNotify, refreshDevice } from "@/lib/notifications";
import { KEYS, writeLocal } from "@/lib/storage";

/**
 * In the iPhone app: keeps this phone's notification address up to date for whoever is signed in
 * (only if they've already allowed notifications; nothing is asked here), and opens the right list
 * when a notification is tapped.
 */
export function NativePush() {
  const router = useRouter();
  useEffect(() => {
    if (!canNotify()) return;
    const { data } = supabase().auth.onAuthStateChange((event, session) => {
      if (session && (event === "INITIAL_SESSION" || event === "SIGNED_IN")) refreshDevice().catch(() => {});
    });
    const tapped = PushNotifications.addListener("pushNotificationActionPerformed", ({ notification }) => {
      const d = notification.data as { url?: unknown; circle?: unknown } | undefined;
      if (typeof d?.circle === "string") writeLocal(KEYS.presentsCircle, d.circle);
      if (typeof d?.url === "string" && d.url.startsWith("/")) router.push(d.url);
    });
    return () => {
      data.subscription.unsubscribe();
      tapped.then((h) => h.remove());
    };
  }, [router]);
  return null;
}
