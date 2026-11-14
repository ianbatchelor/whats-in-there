"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { friendlyError } from "@/lib/supabase/errors";
import { isConfigured } from "@/lib/config";
import { readJoinToken } from "@/lib/domain/ownLists";
import { joinList, previewInvite, type InvitePreview } from "@/lib/ownLists";
import { useSession } from "@/lib/hooks/useSession";
import { AuthFrame } from "@/components/AuthFrame";
import { Splash } from "@/components/ui/Screen";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { SetupNeeded } from "@/components/SetupNeeded";
import { IconLock, IconMail } from "@/components/ui/icons";

const noopSubscribe = () => () => {};

/**
 * Where a group list's invitation link lands: /join/?t=<token>. Shows what the list is, then signs the
 * person in (no household needed), asks what to call them and adds them to the group.
 */
export default function JoinPage() {
  const router = useRouter();
  const { session, loading } = useSession();
  const token = useSyncExternalStore(
    noopSubscribe,
    () => readJoinToken(window.location.search),
    () => undefined,
  );
  // undefined while loading; null for a wrong, stopped or expired link.
  const [preview, setPreview] = useState<InvitePreview | null | undefined>(undefined);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (token === undefined || !isConfigured) return;
    if (!token) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPreview(null);
      return;
    }
    previewInvite(token)
      .then(setPreview)
      .catch(() => setPreview(null));
  }, [token]);

  // What they're called already, if they have an account.
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

  const here = token ? `/join/?t=${encodeURIComponent(token)}` : "/";

  async function join(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !session) return;
    if (!name.trim()) return setError("Tell the group what to call you.");
    setBusy(true);
    setError(null);
    try {
      const { error: pErr } = await supabase().from("profiles").update({ display_name: name.trim().slice(0, 60) }).eq("user_id", session.user.id);
      if (pErr) throw pErr;
      const id = await joinList(token);
      router.replace(`/my-list/?id=${id}`);
    } catch (err) {
      setError(friendlyError(err));
      setBusy(false);
    }
  }

  if (!preview) {
    return (
      <AuthFrame>
        <h1 className="font-display text-3xl font-bold tracking-tight">This link doesn&apos;t work any more</h1>
        <p className="text-mute">Links last 7 days, and the person who sent it may have made a new one. Ask them to send it again.</p>
        <Button variant="ghost" onClick={() => router.replace("/")}>
          Go to the app
        </Button>
      </AuthFrame>
    );
  }

  const things = preview.things === 1 ? "1 thing" : `${preview.things} things`;
  const people = preview.people === 1 ? `just ${preview.ownerName} so far` : `${preview.people} people`;

  return (
    <AuthFrame>
      <div className="flex flex-col gap-2">
        <p className="font-display text-[12px] font-bold tracking-[0.08em] text-plum uppercase">You&apos;re invited</p>
        <h1 className="font-display text-[1.9rem] leading-[1.1] font-bold tracking-[-0.02em]">
          {preview.ownerName} asked you to join “{preview.title}”
        </h1>
        <p className="text-mute">
          A shared list of {things}, with {people}. Add to it and tick things off together.
        </p>
      </div>
      <ul className="flex flex-col gap-2.5 text-[15px]">
        <li className="flex gap-2.5">
          <IconLock className="mt-0.5 size-[18px] shrink-0 text-leaf" />
          <span>
            You&apos;ll see this list only. Nothing else in {preview.ownerName}&apos;s home, and {preview.ownerName} won&apos;t see yours.
          </span>
        </li>
        {!session ? (
          <li className="flex gap-2.5">
            <IconMail className="mt-0.5 size-[18px] shrink-0 text-leaf" />
            <span>Sign in with your email. We send a code, no password.</span>
          </li>
        ) : null}
      </ul>
      {session ? (
        <form onSubmit={join} className="flex flex-col gap-4">
          <Field
            label="What should the group call you?"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            placeholder="Your first name"
            autoComplete="given-name"
            required
          />
          {error ? <Notice>{error}</Notice> : null}
          <Button type="submit" busy={busy} className="w-full">
            Join the list
          </Button>
          <Button type="button" variant="quiet" onClick={() => router.replace("/")}>
            Not now
          </Button>
        </form>
      ) : (
        <Button onClick={() => router.push(`/sign-in/?next=${encodeURIComponent(here)}`)} className="w-full">
          Join with my email
        </Button>
      )}
      <p className="text-center text-[13.5px] text-mute">{preview.ownerName} can stop the link at any time.</p>
    </AuthFrame>
  );
}
