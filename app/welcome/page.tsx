"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import { AuthGate } from "@/components/AuthGate";
import { supabase } from "@/lib/supabase/client";
import { friendlyError } from "@/lib/supabase/errors";
import { familiesOf, loadMemberships, rememberHousehold } from "@/lib/household";
import { KEYS, readLocal } from "@/lib/storage";
import { loadLists } from "@/lib/ownLists";
import { AuthFrame } from "@/components/AuthFrame";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";

export default function WelcomePage() {
  return <AuthGate>{(session) => <Welcome session={session} />}</AuthGate>;
}

function Welcome({ session }: { session: Session }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [household, setHousehold] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Someone who joined a friend's group list has lists before they have a home.
  const [hasLists, setHasLists] = useState(false);
  // Someone who's family in another household (presents only) before they have a home of their own.
  const [family, setFamily] = useState<string | null>(null);

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
    loadMemberships(session.user.id)
      .then((m) => setFamily(familiesOf(m)[0]?.name ?? null))
      .catch(() => {});
    loadLists()
      .then((l) => setHasLists(l.length > 0))
      .catch(() => {});
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
    <AuthFrame>
      <div className="rise flex flex-col gap-2">
        <h1 className="font-display text-[2.2rem] leading-none font-bold tracking-[-0.03em]">Welcome in</h1>
        <p className="text-mute">Set up your household. You can invite everyone else in a moment.</p>
      </div>
      {family ? (
        <div className="flex flex-col gap-2 rounded-[var(--radius-card)] border border-line bg-card p-4">
          <p className="text-[15px]">
            <strong>You&apos;re family at {family}.</strong> Their present lists are ready. Set up a household below only if you want to keep track of your own home.
          </p>
          <Button variant="ghost" onClick={() => router.push("/presents/")} className="w-full">
            Go to presents
          </Button>
        </div>
      ) : null}
      {hasLists ? (
        <div className="flex flex-col gap-2 rounded-[var(--radius-card)] border border-line bg-card p-4">
          <p className="text-[15px]">
            <strong>Here for a shared list?</strong> You don&apos;t need a household for that.
          </p>
          <Button variant="ghost" onClick={() => router.push("/lists/")} className="w-full">
            Go to my lists
          </Button>
        </div>
      ) : null}
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
      <div className="rounded-[var(--radius-card)] border-2 border-dashed border-line bg-sunk/40 p-4 text-sm text-mute">
        <strong className="text-fg">Joining someone else?</strong> Open the invitation link they sent you on this phone and
        you&apos;ll go straight in.
      </div>
    </AuthFrame>
  );
}
