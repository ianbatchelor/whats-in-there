"use client";

import { useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";
import { friendlyError } from "@/lib/supabase/errors";
import { confirmsWithPassword, deleteMyAccount } from "@/lib/account";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { HumanCheck, turnstileSiteKey, type HumanCheckHandle } from "@/components/HumanCheck";

type Step = "explain" | "confirm";

/**
 * "Delete my account": explains what goes and what stays, asks the person to prove it's them again
 * (an email code, or their password if they signed in with one), then deletes the account. Once
 * it is gone the session ends, so the page moves to the sign-in screen, which says the account was deleted.
 */
export function DeleteAccountSheet({ open, onClose, session }: { open: boolean; onClose: () => void; session: Session }) {
  const email = session.user.email ?? "";
  const usePassword = confirmsWithPassword(session.access_token);
  const [step, setStep] = useState<Step>("explain");
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [captcha, setCaptcha] = useState<string | null>(null);
  const humanCheck = useRef<HumanCheckHandle>(null);

  function close() {
    setStep("explain");
    setCodeSent(false);
    setCode("");
    setPassword("");
    setError(null);
    onClose();
  }

  async function sendCode() {
    setError(null);
    if (turnstileSiteKey && !captcha) return setError("Just a moment while we check you're not a robot, then try again.");
    setBusy(true);
    const { error } = await supabase().auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false, ...(captcha ? { captchaToken: captcha } : {}) },
    });
    setBusy(false);
    humanCheck.current?.reset();
    if (error) return setError(friendlyError(error));
    setCodeSent(true);
  }

  async function confirmAndDelete(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (usePassword) {
        if (!password) throw new Error("Enter your password.");
        if (turnstileSiteKey && !captcha) throw new Error("Just a moment while we check you're not a robot, then try again.");
        const { error } = await supabase().auth.signInWithPassword({ email, password, ...(captcha ? { options: { captchaToken: captcha } } : {}) });
        humanCheck.current?.reset();
        if (error) throw new Error(/invalid login credentials/i.test(error.message) ? "That password isn't right." : friendlyError(error));
      } else {
        const token = code.replace(/\D/g, "");
        if (token.length < 6) throw new Error("Enter the code from the email.");
        const { error } = await supabase().auth.verifyOtp({ email, token, type: "email" });
        if (error) throw new Error(friendlyError(error));
      }
      await deleteMyAccount();
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      setError(message === "reauth_needed" || message === "delete_failed" ? friendlyError(message) : message || friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onClose={close} title="Delete your account?">
      {step === "explain" ? (
        <>
          <div className="flex flex-col gap-2 text-mute">
            <p>This can&apos;t be undone.</p>
            <ul className="list-disc pl-5">
              <li>Your sign-in and your name are deleted.</li>
              <li>Any household where you&apos;re the only member is deleted, with all its places, things and photos.</li>
              <li>Households you share carry on for everyone else. Things you added stay, without your name. If you&apos;re the only owner, the person who joined longest ago becomes owner.</li>
            </ul>
          </div>
          <Button variant="go" className="w-full bg-warn" onClick={() => setStep("confirm")}>Continue</Button>
          <Button variant="quiet" onClick={close}>Keep my account</Button>
        </>
      ) : (
        <form onSubmit={confirmAndDelete} className="flex flex-col gap-4" noValidate>
          {usePassword ? (
            <>
              <p className="text-mute">To make sure it&apos;s you, enter the password for {email}.</p>
              <Field label="Password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </>
          ) : !codeSent ? (
            <p className="text-mute">To make sure it&apos;s you, we&apos;ll email a code to {email}.</p>
          ) : (
            <>
              <Notice tone="info">We&apos;ve emailed a code to {email}.</Notice>
              <Field
                label="Code from the email"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]*"
                maxLength={10}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="[&_input]:font-mono [&_input]:text-xl [&_input]:tracking-[0.3em]"
              />
            </>
          )}
          {error ? <Notice>{error}</Notice> : null}
          {usePassword || codeSent ? (
            <Button type="submit" variant="go" className="w-full bg-warn" busy={busy}>Delete my account</Button>
          ) : (
            <Button type="button" className="w-full" busy={busy} onClick={sendCode}>Email me a code</Button>
          )}
          <Button type="button" variant="quiet" onClick={close}>Keep my account</Button>
          {usePassword || !codeSent ? (
            <HumanCheck ref={humanCheck} onToken={setCaptcha} onError={() => setError("We couldn't check you're not a robot. Check your connection and try again.")} />
          ) : null}
        </form>
      )}
    </Sheet>
  );
}
