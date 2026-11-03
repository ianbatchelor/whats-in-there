"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { friendlyError } from "@/lib/supabase/errors";
import { isConfigured } from "@/lib/config";
import { readInviteToken } from "@/lib/domain/invite";
import { rememberHousehold } from "@/lib/household";
import { useSession } from "@/lib/hooks/useSession";
import { KEYS, writeLocal } from "@/lib/storage";
import { AuthFrame } from "@/components/AuthFrame";
import { Splash } from "@/components/ui/Screen";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { SetupNeeded } from "@/components/SetupNeeded";

const noopSubscribe = () => () => {};

export default function InvitePage() {
  const router = useRouter();
  const { session, loading } = useSession();
  // undefined while prerendering, then the token (or null) once we can read the URL.
  const token = useSyncExternalStore(
    noopSubscribe,
    () => readInviteToken(window.location.search),
    () => undefined,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading || token === undefined || session || !token) return;
    // Remember the invite through sign-in, then come back here.
    writeLocal(KEYS.pendingInvite, token);
    router.replace(`/sign-in/?next=${encodeURIComponent(`/invite/?token=${token}`)}`);
  }, [loading, session, token, router]);

  if (!isConfigured) return <SetupNeeded />;
  if (loading || token === undefined || (token && !session)) return <Splash />;

  async function join() {
    if (!token) return;
    setBusy(true);
    setError(null);
    const { data, error } = await supabase().rpc("accept_invitation", { p_token: token });
    setBusy(false);
    writeLocal(KEYS.pendingInvite, null);
    if (error) return setError(friendlyError(error));
    rememberHousehold(data as string);
    router.replace("/");
  }

  return (
    <AuthFrame>
      {token ? (
        <>
          <div className="flex flex-col gap-2">
            <h1 className="font-display text-[2.2rem] leading-none font-extrabold tracking-[-0.03em]">You&apos;re invited</h1>
            <p className="text-mute">Join the household to see and update the same places and everything in them.</p>
          </div>
          {error ? <Notice>{error}</Notice> : null}
          <Button onClick={join} busy={busy} className="w-full">
            Join household
          </Button>
          <Button variant="quiet" onClick={() => { writeLocal(KEYS.pendingInvite, null); router.replace("/"); }}>
            Not now
          </Button>
        </>
      ) : (
        <>
          <h1 className="font-display text-3xl font-extrabold tracking-tight">This link isn&apos;t complete</h1>
          <p className="text-mute">Ask the person who invited you to send the link again, then open it on this phone.</p>
          <Button variant="ghost" onClick={() => router.replace("/")}>Go to the app</Button>
        </>
      )}
    </AuthFrame>
  );
}
