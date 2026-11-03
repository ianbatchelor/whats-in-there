"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import { AuthGate } from "@/components/AuthGate";
import { supabase } from "@/lib/supabase/client";
import { friendlyError } from "@/lib/supabase/errors";
import { rememberHousehold } from "@/lib/household";
import { KEYS, readLocal } from "@/lib/storage";
import { Screen } from "@/components/ui/Screen";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { BrandMark } from "@/components/brand/BrandMark";

export default function WelcomePage() {
  return <AuthGate>{(session) => <Welcome session={session} />}</AuthGate>;
}

function Welcome({ session }: { session: Session }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [household, setHousehold] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const pending = readLocal(KEYS.pendingInvite);
    if (pending) {
      router.replace(`/invite/?token=${encodeURIComponent(pending)}`);
      return;
    }
    supabase()
      .from("profiles")
      .select("display_name")
      .eq("user_id", session.user.id)
      .maybeSingle()
      .then(({ data }) => data && setName((n) => n || (data.display_name as string)));
  }, [router, session.user.id]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return setError("Tell us what to call you.");
    setBusy(true);
    const sb = supabase();
    const { error: pErr } = await sb.from("profiles").update({ display_name: name.trim().slice(0, 60) }).eq("user_id", session.user.id);
    if (pErr) {
      setBusy(false);
      return setError(friendlyError(pErr));
    }
    const { data, error: hErr } = await sb.rpc("create_household", { p_name: household.trim() || "Our House" });
    setBusy(false);
    if (hErr) return setError(friendlyError(hErr));
    rememberHousehold(data as string);
    router.replace("/");
  }

  return (
    <Screen>
      <BrandMark size={44} className="mt-4" />
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-4xl leading-none font-extrabold tracking-tight">Welcome in</h1>
        <p className="text-mute">Set up your household. You can invite everyone else in a moment.</p>
      </div>
      <form onSubmit={create} className="flex flex-col gap-4">
        <Field label="Your name" autoComplete="given-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
        <Field
          label="Household name"
          placeholder="Our House"
          value={household}
          onChange={(e) => setHousehold(e.target.value)}
          maxLength={80}
          hint="Everyone you invite sees this name."
        />
        {error ? <Notice>{error}</Notice> : null}
        <Button type="submit" busy={busy} className="w-full">
          Create household
        </Button>
      </form>
      <div className="mt-auto rounded-[var(--radius-card)] border border-dashed border-line p-4 text-sm text-mute">
        <strong className="text-fg">Joining someone else?</strong> Open the invitation link they sent you on this phone and
        you&apos;ll go straight in.
      </div>
    </Screen>
  );
}
