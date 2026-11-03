"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { friendlyError } from "@/lib/supabase/errors";
import { isConfigured } from "@/lib/config";
import { useSession } from "@/lib/hooks/useSession";
import { Screen, Splash } from "@/components/ui/Screen";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { BrandMark, Wordmark } from "@/components/brand/BrandMark";
import { SetupNeeded } from "@/components/SetupNeeded";

/** Only allow same-app paths as a return address. */
function safeNext(): string {
  const next = new URLSearchParams(window.location.search).get("next") ?? "/";
  return next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export default function SignInPage() {
  const router = useRouter();
  const { session, loading } = useSession();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    if (session) router.replace(safeNext());
  }, [session, router]);

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
    setBusy(true);
    const { error } = await supabase().auth.signInWithOtp({ email: address, options: { shouldCreateUser: true } });
    setBusy(false);
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

  return (
    <Screen className="justify-between">
      <header className="flex items-center gap-2.5 pt-2">
        <BrandMark size={34} />
        <Wordmark className="text-lg" />
      </header>

      <section className="flex flex-col gap-6">
        <h1 className="font-display text-[2.6rem] leading-[0.98] font-extrabold tracking-[-0.03em] text-balance">
          Know what&apos;s in <span className="tape inline-block -rotate-1 px-2 pb-1">every</span> freezer.
        </h1>

        {step === "email" ? (
          <form onSubmit={sendCode} className="flex flex-col gap-4" noValidate>
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

      <p className="text-center text-xs text-mute">Your household&apos;s food list is private to the people you invite.</p>
    </Screen>
  );
}
