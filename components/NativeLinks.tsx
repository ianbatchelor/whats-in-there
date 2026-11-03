"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";

/**
 * In the iOS and Android apps, links like https://seewhatsinhere.com/invite/?token=… or /l/<code>
 * (from a sticker, QR code or message) open the app; route them to the matching screen.
 */
export function NativeLinks() {
  const router = useRouter();
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const sub = App.addListener("appUrlOpen", ({ url }) => {
      try {
        const u = new URL(url);
        router.push(`${u.pathname}${u.search}`);
      } catch {
        /* not a URL we understand */
      }
    });
    return () => {
      sub.then((h) => h.remove());
    };
  }, [router]);
  return null;
}
