"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import { isConfigured } from "@/lib/config";
import { useSession } from "@/lib/hooks/useSession";
import { SetupNeeded } from "@/components/SetupNeeded";
import { Splash } from "@/components/ui/Screen";

/** Renders children only for a signed-in user; otherwise sends them to sign in and back. */
export function AuthGate({ children }: { children: (session: Session) => React.ReactNode }) {
  const { session, loading } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (!isConfigured || loading || session) return;
    const next = window.location.pathname + window.location.search;
    router.replace(`/sign-in/?next=${encodeURIComponent(next)}`);
  }, [loading, session, router]);

  if (!isConfigured) return <SetupNeeded />;
  if (loading || !session) return <Splash />;
  return <>{children(session)}</>;
}
