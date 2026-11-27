"use client";

import { useEffect, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { stickerCodeFrom, stickerRoute } from "@/lib/domain/sticker";
import { AuthFrame } from "@/components/AuthFrame";
import { Splash } from "@/components/ui/Screen";
import { buttonBase, buttonStyles } from "@/components/ui/Button";

const noopSubscribe = () => () => {};

/**
 * Any address the site doesn't have. A sticker address (/l/<code>) that reaches here, because the
 * vercel.json rewrite didn't apply, is sent on to /l/?c=<code> so a sticker never shows a dead end.
 */
export default function NotFound() {
  const router = useRouter();
  // undefined while prerendering, then the sticker code (or null) once we can read the address.
  const code = useSyncExternalStore(
    noopSubscribe,
    () => stickerCodeFrom(window.location.pathname),
    () => undefined,
  );

  useEffect(() => {
    if (code) router.replace(stickerRoute(code));
  }, [code, router]);

  if (code === undefined || code) return <Splash />;

  return (
    <AuthFrame>
      <h1 className="font-serif text-[2.1rem] leading-[1.05] font-semibold tracking-[-0.015em] text-forest">This page isn&apos;t here</h1>
      <p className="text-mute">The link may be old or mistyped.</p>
      <Link href="/" className={`${buttonBase} ${buttonStyles.go}`}>
        Go to See What&apos;s in Here
      </Link>
    </AuthFrame>
  );
}
