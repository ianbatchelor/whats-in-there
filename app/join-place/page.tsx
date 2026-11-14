"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { friendlyError } from "@/lib/supabase/errors";
import { isConfigured } from "@/lib/config";
import { readPlaceToken } from "@/lib/domain/sharedPlaces";
import { countThings } from "@/lib/domain/places";
import { joinPlace, previewPlaceInvite, type PlaceInvitePreview } from "@/lib/sharedPlaces";
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
 * Where a place's invitation link lands: /join-place/?t=<token>. Shows which place it is and whose,
 * signs the person in (no household needed), asks what to call them and lets them in.
 */
export default function JoinPlacePage() {
  const router = useRouter();
  const { session, loading } = useSession();
  const token = useSyncExternalStore(
    noopSubscribe,
    () => readPlaceToken(window.location.search),
    () => undefined,
  );
  // undefined while loading; null for a wrong, used, stopped or expired link.
  const [preview, setPreview] = useState<PlaceInvitePreview | null | undefined>(undefined);
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
    previewPlaceInvite(token)
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

  const here = token ? `/join-place/?t=${encodeURIComponent(token)}` : "/";

  async function join(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !session) return;
    if (!name.trim()) return setError("Tell them what to call you.");
    setBusy(true);
    setError(null);
    try {
      const { error: pErr } = await supabase().from("profiles").update({ display_name: name.trim().slice(0, 60) }).eq("user_id", session.user.id);
      if (pErr) throw pErr;
      const id = await joinPlace(token);
      router.replace(`/place/?id=${id}`);
    } catch (err) {
      setError(friendlyError(err));
      setBusy(false);
    }
  }

  if (!preview) {
    return (
      <AuthFrame>
        <h1 className="font-display text-3xl font-bold tracking-tight">This link doesn&apos;t work any more</h1>
        <p className="text-mute">Each link lets one person in, and lasts 7 days. Ask the person who sent it for a new one.</p>
        <Button variant="ghost" onClick={() => router.replace("/")}>
          Go to the app
        </Button>
      </AuthFrame>
    );
  }

  return (
    <AuthFrame>
      <div className="flex flex-col gap-2">
        <p className="font-display text-[12px] font-bold tracking-[0.08em] text-leaf uppercase">You&apos;re invited</p>
        <h1 className="font-display text-[1.9rem] leading-[1.1] font-bold tracking-[-0.02em]">
          {preview.invitedBy} shared the {preview.place} with you
        </h1>
        <p className="text-mute">
          It&apos;s at {preview.household}, with {countThings(preview.things)} in it so far. See what&apos;s in it from anywhere, and add or take
          things out so it stays right for everyone.
        </p>
      </div>
      <ul className="flex flex-col gap-2.5 text-[15px]">
        <li className="flex gap-2.5">
          <IconLock className="mt-0.5 size-[18px] shrink-0 text-leaf" />
          <span>
            You&apos;ll see the {preview.place} only. Nothing else at {preview.household}, and they won&apos;t see your home.
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
            Open the {preview.place}
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
      <p className="text-center text-[13.5px] text-mute">They can take you out at any time, and you can leave whenever you like.</p>
    </AuthFrame>
  );
}
