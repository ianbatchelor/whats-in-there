"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Capacitor } from "@capacitor/core";
import { appStoreUrl, isConfigured } from "@/lib/config";
import { useSession } from "@/lib/hooks/useSession";
import { friendlyError } from "@/lib/supabase/errors";
import { stickerCodeFrom, stickerRoute } from "@/lib/domain/sticker";
import { resolveSticker } from "@/lib/stickers";
import { AuthFrame } from "@/components/AuthFrame";
import { SetupNeeded } from "@/components/SetupNeeded";
import { Splash } from "@/components/ui/Screen";
import { Button, buttonBase, buttonStyles } from "@/components/ui/Button";

const noopSubscribe = () => () => {};

/**
 * Where a sticker or printed QR label lands: https://seewhatsinhere.com/l/<code> (or /l/?c=<code>).
 * Opens the place it belongs to, with the quick choices (took out, put in, moved here) on top,
 * for people signed in to that household. On the website, someone who isn't signed in (usually someone
 * without the app) gets a page about the app with "Sign in" and the App Store; inside the app they go
 * straight to sign-in. Nothing about the place is looked up until someone is signed in, and a code that
 * isn't one of your places gets the same answer whether it doesn't exist or belongs to another household.
 */
export default function StickerPage() {
  const router = useRouter();
  const { session, loading } = useSession();
  // undefined while prerendering, then the code (or null) once we can read the address.
  const code = useSyncExternalStore(
    noopSubscribe,
    () => stickerCodeFrom(window.location.pathname, window.location.search),
    () => undefined,
  );
  const [problem, setProblem] = useState<"unknown" | string | null>(null);

  useEffect(() => {
    if (!isConfigured || loading || code === undefined || !code) return;
    if (!session) {
      if (Capacitor.isNativePlatform()) router.replace(signInFor(code));
      return;
    }
    let active = true;
    resolveSticker(code)
      .then((id) => {
        if (!active) return;
        if (id) router.replace(`/place/?id=${id}&quick=1`);
        else setProblem("unknown");
      })
      .catch((e) => active && setProblem(friendlyError(e)));
    return () => {
      active = false;
    };
  }, [code, session, loading, router]);

  if (!isConfigured) return <SetupNeeded />;
  if (code && !loading && !session && !Capacitor.isNativePlatform()) return <StickerWelcome code={code} />;
  if (code === undefined || (code && !problem)) return <Splash />;

  return (
    <AuthFrame>
      {problem && problem !== "unknown" ? (
        <>
          <h1 className="font-serif text-[2.1rem] leading-[1.05] font-semibold tracking-[-0.015em] text-forest">Couldn&apos;t open this sticker</h1>
          <p className="text-mute">{problem}</p>
          <Button onClick={() => window.location.reload()}>Try again</Button>
        </>
      ) : (
        <>
          <h1 className="font-serif text-[2.1rem] leading-[1.05] font-semibold tracking-[-0.015em] text-forest">This sticker isn&apos;t linked to your places</h1>
          <p className="text-mute">
            {code
              ? "It may belong to a household you're not in, its place may have been removed, or it was replaced with a new link. If it's yours, open the place in the app and print or write a fresh one."
              : "The link on it isn't complete. Open the place in the app and print or write a fresh one."}
          </p>
          <Button variant="ghost" onClick={() => router.replace("/")}>
            Go to your places
          </Button>
        </>
      )}
    </AuthFrame>
  );
}

function signInFor(code: string): string {
  return `/sign-in/?next=${encodeURIComponent(stickerRoute(code))}`;
}

/**
 * The website's answer to a sticker for someone who isn't signed in: anyone who tapped a sticker
 * without the app. It says what the sticker is without saying anything about the place or whose it is.
 */
function StickerWelcome({ code }: { code: string }) {
  const store = appStoreUrl();
  return (
    <AuthFrame>
      <div className="flex flex-col gap-3">
        <p className="text-sm font-semibold tracking-wide text-leaf uppercase">A See What&apos;s in Here sticker</p>
        <h1 className="font-serif text-[2.1rem] leading-[1.05] font-semibold tracking-[-0.015em] text-forest">Someone keeps track of what&apos;s in here</h1>
        <p className="text-mute">
          This sticker shows a household what&apos;s stored here: in a freezer, a cupboard, a wine rack, a loft. Only people in that
          household can see inside.
        </p>
      </div>

      <section className="flex flex-col gap-3 rounded-2xl bg-card p-5 ring-1 ring-line ring-inset">
        <h2 className="font-display text-lg font-bold">Get the app</h2>
        {store ? (
          <>
            <p className="text-mute">Keep track of everything you have, wherever you store it.</p>
            <a href={store} className={`${buttonBase} ${buttonStyles.ink}`}>
              Get it on the App Store
            </a>
          </>
        ) : (
          <p className="text-mute">
            Coming soon to the iPhone App Store. Until then it works here on the website, on any phone or computer.
          </p>
        )}
      </section>

      <div className="flex flex-col gap-3">
        <p className="text-mute">Is this your household&apos;s sticker? Sign in to see what&apos;s in here.</p>
        <Link href={signInFor(code)} className={`${buttonBase} ${store ? buttonStyles.ghost : buttonStyles.go}`}>
          Sign in
        </Link>
        <Link href="/" className={`${buttonBase} ${buttonStyles.quiet}`}>
          What is See What&apos;s in Here?
        </Link>
      </div>
    </AuthFrame>
  );
}
