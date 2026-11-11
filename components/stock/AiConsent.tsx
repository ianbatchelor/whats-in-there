"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { KEYS, readLocal, writeLocal } from "@/lib/storage";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";

/**
 * Asks once, before the first photo scan, whether photos may be sent to Claude (Anthropic) to be read.
 * Apple requires clear permission before personal data goes to a third-party AI (guideline 5.1.2(i)).
 * The answer is remembered on this device; "Not now" leaves adding by hand as it is.
 */
export function useAiConsent() {
  const [pending, setPending] = useState<(() => void) | null>(null);

  const withConsent = useCallback((go: () => void) => {
    if (readLocal(KEYS.aiConsent) === "yes") go();
    else setPending(() => go);
  }, []);

  const allow = () => {
    writeLocal(KEYS.aiConsent, "yes");
    const go = pending;
    setPending(null);
    go?.(); // still inside the tap, so the camera is allowed to open
  };

  const sheet = (
    <Sheet open={pending !== null} onClose={() => setPending(null)} title="Read photos with AI?">
      <div className="flex flex-col gap-2 text-mute">
        <p>
          To fill things in for you, your photo is sent to <b className="text-fg">Claude, an AI made by Anthropic</b>, which reads the
          names, brands, sizes and dates it can see.
        </p>
        <p>Anthropic doesn&apos;t use your photos to train its AI. You can always add things by hand instead.</p>
        <p className="text-sm">
          <Link href="/privacy/" className="font-semibold underline underline-offset-4">How your data is used</Link>
        </p>
      </div>
      <Button className="w-full" onClick={allow}>OK, read my photos</Button>
      <Button variant="quiet" onClick={() => setPending(null)}>Not now</Button>
    </Sheet>
  );

  return { withConsent, sheet };
}
