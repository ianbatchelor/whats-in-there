"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { stickerCodeFrom, stickerRoute } from "@/lib/domain/sticker";

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
        // /l/<code> has no page of its own in the bundled app, so go to the /l/?c=<code> form.
        const code = u.pathname.startsWith("/l/") ? stickerCodeFrom(u.pathname, u.search) : null;
        router.push(code ? stickerRoute(code) : `${u.pathname}${u.search}`);
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
