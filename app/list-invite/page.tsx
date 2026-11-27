"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { friendlyError } from "@/lib/supabase/errors";
import { isConfigured } from "@/lib/config";
import { readListToken } from "@/lib/domain/listViewers";
import { firstName } from "@/lib/domain/presents";
import { joinList, previewListInvite, type ListInvitePreview } from "@/lib/listViewers";
import { useSession } from "@/lib/hooks/useSession";
import { AuthFrame } from "@/components/AuthFrame";
import { Splash } from "@/components/ui/Screen";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { SetupNeeded } from "@/components/SetupNeeded";
import { IconGift, IconLock, IconMail } from "@/components/ui/icons";

const noopSubscribe = () => () => {};

/**
 * Where an invitation to one present list lands: /list-invite/?t=<token>. Says whose list it is,
 * signs the person in with the email it was sent to (no household needed), and opens the list.
 */
export default function ListInvitePage() {
  const router = useRouter();
  const { session, loading } = useSession();
  const token = useSyncExternalStore(
    noopSubscribe,
    () => readListToken(window.location.search),
    () => undefined,
  );
  // undefined while loading; null for a wrong, used, cancelled or expired link.
  const [preview, setPreview] = useState<ListInvitePreview | null | undefined>(undefined);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wrongEmail, setWrongEmail] = useState(false);

  useEffect(() => {
    if (token === undefined || !isConfigured) return;
    if (!token) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPreview(null);
      return;
    }
    previewListInvite(token)
      .then(setPreview)
      .catch(() => setPreview(null));
  }, [token]);

  useEffect(() => {
    if (!session) return;
    supabase()
      .from("profiles")
      .select("display_name")
      .eq("user_id", session.user.id)
      .maybeSingle()
      .then(({ data }) => data && setName((n) => n || (data.display_name as string)));
  }, [session]);

  if (!isConfigured) return <SetupNeeded />;
  if (loading || token === undefined || preview === undefined) return <Splash />;

  const here = token ? `/list-invite/?t=${encodeURIComponent(token)}` : "/";

  async function join(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !session) return;
    if (!name.trim()) return setError("Tell them what to call you.");
    setBusy(true);
    setError(null);
    setWrongEmail(false);
    try {
      const { error: pErr } = await supabase().from("profiles").update({ display_name: name.trim().slice(0, 60) }).eq("user_id", session.user.id);
      if (pErr) throw pErr;
      const id = await joinList(token);
      router.replace(`/gift-list/?id=${id}`);
    } catch (err) {
      const raw = (err as { message?: string })?.message ?? "";
      if (raw.startsWith("wrong_email")) setWrongEmail(true);
      else setError(friendlyError(err));
      setBusy(false);
    }
  }

  async function switchEmail() {
    await supabase().auth.signOut();
    router.replace(`/sign-in/?next=${encodeURIComponent(here)}`);
  }

  if (!preview) {
    return (
      <AuthFrame>
        <h1 className="font-display text-3xl font-bold tracking-tight">This link doesn&apos;t work any more</h1>
        <p className="text-mute">Each invitation works once, and lasts 7 days. Ask the person who sent it for a new one.</p>
        <Button variant="ghost" onClick={() => router.replace("/")}>
          Go to the app
        </Button>
      </AuthFrame>
    );
  }

  const whose = firstName(preview.name);
  return (
    <AuthFrame>
      <div className="flex flex-col gap-2">
        <IconGift className="size-8 text-[#8f2d2d]" />
        <p className="font-display text-[12px] font-bold tracking-[0.08em] text-leaf uppercase">You&apos;re invited</p>
        <h1 className="font-display text-[1.9rem] leading-[1.1] font-bold tracking-[-0.02em]">
          {firstName(preview.invitedBy)} shared {whose}&apos;s present list with you
        </h1>
        <p className="text-mute">
          See the ideas nobody is getting yet, and tap &ldquo;I&apos;m getting this&rdquo; so no one buys the same thing twice. {whose} won&apos;t see
          who&apos;s getting what.
        </p>
      </div>
      <ul className="flex flex-col gap-2.5 text-[15px]">
        <li className="flex gap-2.5">
          <IconLock className="mt-0.5 size-[18px] shrink-0 text-leaf" />
          <span>You&apos;ll see {whose}&apos;s list only. Nothing else at {preview.household}.</span>
        </li>
        {!session ? (
          <li className="flex gap-2.5">
            <IconMail className="mt-0.5 size-[18px] shrink-0 text-leaf" />
            <span>Sign in with the email this was sent to ({preview.emailHint}). We send a code, no password.</span>
          </li>
        ) : null}
      </ul>
      {wrongEmail ? (
        <div className="flex flex-col gap-3">
          <Notice>
            This invitation is for {preview.emailHint}, and you&apos;re signed in as {session?.user.email ?? "someone else"}. Sign in with the email it was
            sent to.
          </Notice>
          <Button onClick={switchEmail} className="w-full">
            Sign in with a different email
          </Button>
        </div>
      ) : session ? (
        <form onSubmit={join} className="flex flex-col gap-4">
          <Field
            label="What should they call you?"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            placeholder="Your first name"
            autoComplete="given-name"
            required
          />
          {error ? <Notice>{error}</Notice> : null}
          <Button type="submit" busy={busy} className="w-full">
            Open {whose}&apos;s list
          </Button>
          <Button type="button" variant="quiet" onClick={() => router.replace("/")}>
            Not now
          </Button>
        </form>
      ) : (
        <Button onClick={() => router.push(`/sign-in/?next=${encodeURIComponent(here)}`)} className="w-full">
          Sign in with my email
        </Button>
      )}
      <p className="text-center text-[13.5px] text-mute">They can take you off the list at any time, and you can leave whenever you like.</p>
    </AuthFrame>
  );
}
