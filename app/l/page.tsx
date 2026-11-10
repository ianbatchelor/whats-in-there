"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { isConfigured } from "@/lib/config";
import { useSession } from "@/lib/hooks/useSession";
import { friendlyError } from "@/lib/supabase/errors";
import { stickerCodeFrom, stickerRoute } from "@/lib/domain/sticker";
import { resolveSticker } from "@/lib/stickers";
import { AuthFrame } from "@/components/AuthFrame";
import { SetupNeeded } from "@/components/SetupNeeded";
import { Splash } from "@/components/ui/Screen";
import { Button } from "@/components/ui/Button";

const noopSubscribe = () => () => {};

/**
 * Where a sticker or printed QR label lands: https://seewhatsinhere.com/l/<code> (or /l/?c=<code>).
 * Opens the place it belongs to, after signing in if needed. A code that isn't one of your places
 * gets the same answer whether it doesn't exist or belongs to another household.
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
      router.replace(`/sign-in/?next=${encodeURIComponent(stickerRoute(code))}`);
      return;
    }
    let active = true;
    resolveSticker(code)
      .then((id) => {
        if (!active) return;
        if (id) router.replace(`/place/?id=${id}`);
        else setProblem("unknown");
      })
      .catch((e) => active && setProblem(friendlyError(e)));
    return () => {
      active = false;
    };
  }, [code, session, loading, router]);

  if (!isConfigured) return <SetupNeeded />;
  if (code === undefined || (code && !problem)) return <Splash />;

  return (
    <AuthFrame>
      {problem && problem !== "unknown" ? (
        <>
          <h1 className="font-display text-3xl font-bold tracking-tight">Couldn&apos;t open this sticker</h1>
          <p className="text-mute">{problem}</p>
          <Button onClick={() => window.location.reload()}>Try again</Button>
        </>
      ) : (
        <>
          <h1 className="font-display text-3xl font-bold tracking-tight">This sticker isn&apos;t linked to your places</h1>
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
