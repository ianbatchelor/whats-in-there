"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { friendlyError } from "@/lib/supabase/errors";
import { isConfigured } from "@/lib/config";
import { safeReturnPath } from "@/lib/domain/returnPath";
import { KEYS, readLocal, writeLocal } from "@/lib/storage";
import { useSession } from "@/lib/hooks/useSession";
import { AuthFrame } from "@/components/AuthFrame";
import { Splash } from "@/components/ui/Screen";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { SetupNeeded } from "@/components/SetupNeeded";
import { HumanCheck, turnstileSiteKey, type HumanCheckHandle } from "@/components/HumanCheck";

/** Only allow same-app paths as a return address. */
function safeNext(): string {
  return safeReturnPath(new URLSearchParams(window.location.search).get("next"));
}

export default function SignInPage() {
  const router = useRouter();
  const { session, loading } = useSession();
  const [step, setStep] = useState<"email" | "code" | "password">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [captcha, setCaptcha] = useState<string | null>(null);
  const humanCheck = useRef<HumanCheckHandle>(null);

  useEffect(() => {
    if (session) router.replace(safeNext());
  }, [session, router]);

  // Straight after "Delete my account".
  useEffect(() => {
    if (readLocal(KEYS.accountDeleted)) {
      writeLocal(KEYS.accountDeleted, null);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setInfo("Your account has been deleted. Thanks for trying See What's in Here.");
    }
  }, []);

  if (!isConfigured) return <SetupNeeded />;
  if (loading || session) return <Splash />;

  async function sendCode(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);
    setInfo(null);
    const address = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
      setError("Enter a valid email address.");
      return;
    }
    if (turnstileSiteKey && !captcha) {
      setError("Just a moment while we check you're not a robot, then try again.");
      return;
    }
    setBusy(true);
    const { error } = await supabase().auth.signInWithOtp({
      email: address,
      options: { shouldCreateUser: true, ...(captcha ? { captchaToken: captcha } : {}) },
    });
    setBusy(false);
    humanCheck.current?.reset(); // each check works once; get a fresh one for "Send a new code"
    if (error) return setError(friendlyError(error));
    setEmail(address);
    setStep("code");
    setInfo(`We've emailed a sign-in code to ${address}.`);
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const token = code.replace(/\D/g, "");
    if (token.length < 6) return setError("Enter the code from the email.");
    setBusy(true);
    const { error } = await supabase().auth.verifyOtp({ email, token, type: "email" });
    setBusy(false);
    if (error) return setError(friendlyError(error));
    // onAuthStateChange redirects
  }

  // Accounts with a password (such as the demo account for Apple's reviewers) can sign in without an email code.
  async function signInWithPassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const address = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address) || !password) return setError("Enter your email and password.");
    if (turnstileSiteKey && !captcha) {
      setError("Just a moment while we check you're not a robot, then try again.");
      return;
    }
    setBusy(true);
    const { error } = await supabase().auth.signInWithPassword({
      email: address,
      password,
      ...(captcha ? { options: { captchaToken: captcha } } : {}),
    });
    setBusy(false);
    humanCheck.current?.reset();
    if (error) return setError(/invalid login credentials/i.test(error.message) ? "That email and password don't match." : friendlyError(error));
    // onAuthStateChange redirects
  }

  const switchTo = (next: "email" | "password") => {
    setStep(next);
    setError(null);
    setPassword("");
  };

  return (
    <AuthFrame>
      <section className="rise flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="font-display text-[2.2rem] leading-[1.02] font-bold tracking-[-0.03em] text-balance">
            {step === "email" ? "Sign in or get started" : step === "password" ? "Sign in with a password" : "Check your email"}
          </h1>
          <p className="text-mute">
            {step === "email"
              ? "New here? The same steps create your account."
              : step === "password"
                ? "For accounts that have a password. Everyone else signs in with an email code."
                : `We sent a sign-in code to ${email.trim()}.`}
          </p>
        </div>

        {step === "email" ? (
          <form onSubmit={sendCode} className="flex flex-col gap-4" noValidate>
            {info ? <Notice tone="success">{info}</Notice> : null}
            <Field
              label="Email"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              hint="We'll send you a code. No password to remember."
            />
            {error ? <Notice>{error}</Notice> : null}
            <Button type="submit" busy={busy} className="w-full">
              Send my code
            </Button>
            <Button type="button" variant="quiet" className="self-center text-sm" onClick={() => switchTo("password")}>
              Sign in with a password
            </Button>
          </form>
        ) : step === "password" ? (
          <form onSubmit={signInWithPassword} className="flex flex-col gap-4" noValidate>
            <Field
              label="Email"
              type="email"
              inputMode="email"
              autoComplete="username"
              autoCapitalize="none"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Field
              label="Password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {error ? <Notice>{error}</Notice> : null}
            <Button type="submit" busy={busy} className="w-full">
              Sign in
            </Button>
            <Button type="button" variant="quiet" className="self-center text-sm" onClick={() => switchTo("email")}>
              Use an email code instead
            </Button>
          </form>
        ) : (
          <form onSubmit={verify} className="flex flex-col gap-4" noValidate>
            {info ? <Notice tone="info">{info}</Notice> : null}
            <Field
              label="Code from the email"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={10}
              placeholder="12345678"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="[&_input]:font-mono [&_input]:text-xl [&_input]:tracking-[0.3em]"
            />
            {error ? <Notice>{error}</Notice> : null}
            <Button type="submit" busy={busy} className="w-full">
              Sign in
            </Button>
            <div className="flex justify-between">
              <Button type="button" variant="quiet" className="px-0!" onClick={() => { setStep("email"); setCode(""); setError(null); }}>
                Use another email
              </Button>
              <Button type="button" variant="quiet" className="px-0!" onClick={() => sendCode()} disabled={busy}>
                Send a new code
              </Button>
            </div>
          </form>
        )}
      </section>

      <HumanCheck
        ref={humanCheck}
        onToken={setCaptcha}
        onError={() => setError("We couldn't check you're not a robot. Check your connection and reload the page.")}
      />

      <p className="text-center text-xs text-mute lg:hidden">Your household&apos;s list is private to the people you invite.</p>
    </AuthFrame>
  );
}
