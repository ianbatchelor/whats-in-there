"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

/**
 * Cloudflare Turnstile, the "are you a human?" check on the sign-in page. It is usually invisible and
 * only asks someone to tick a box when it isn't sure. It stops bots creating accounts or using the
 * sign-in page to send codes to other people's inboxes. Supabase checks the token it produces, once
 * CAPTCHA protection is switched on there (Authentication > Attack Protection).
 *
 * Shown only when NEXT_PUBLIC_TURNSTILE_SITE_KEY is set, so builds without it behave as before.
 */
export const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

type Turnstile = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  reset: (id: string) => void;
  remove: (id: string) => void;
};
declare global {
  interface Window {
    turnstile?: Turnstile;
  }
}

const SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let loading: Promise<Turnstile> | null = null;

function loadTurnstile(): Promise<Turnstile> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  loading ??= new Promise<Turnstile>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SCRIPT;
    s.async = true;
    s.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error("turnstile")));
    s.onerror = () => {
      loading = null;
      reject(new Error("turnstile"));
    };
    document.head.appendChild(s);
  });
  return loading;
}

export type HumanCheckHandle = { reset: () => void };

type Props = {
  /** Called with a fresh token, or null when it expires or fails. Each token works once. */
  onToken: (token: string | null) => void;
  onError?: () => void;
};

export const HumanCheck = forwardRef<HumanCheckHandle, Props>(function HumanCheck({ onToken, onError }, ref) {
  const box = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);
  const callbacks = useRef({ onToken, onError });
  useEffect(() => {
    callbacks.current = { onToken, onError };
  });

  useImperativeHandle(ref, () => ({
    reset: () => {
      callbacks.current.onToken(null);
      if (widget.current && window.turnstile) window.turnstile.reset(widget.current);
    },
  }));

  useEffect(() => {
    if (!turnstileSiteKey) return;
    let cancelled = false;
    loadTurnstile()
      .then((t) => {
        if (cancelled || !box.current) return;
        widget.current = t.render(box.current, {
          sitekey: turnstileSiteKey,
          appearance: "interaction-only",
          theme: "auto",
          callback: (token: string) => callbacks.current.onToken(token),
          "expired-callback": () => callbacks.current.onToken(null),
          "error-callback": () => {
            callbacks.current.onToken(null);
            callbacks.current.onError?.();
          },
        });
      })
      .catch(() => callbacks.current.onError?.());
    return () => {
      cancelled = true;
      if (widget.current && window.turnstile) window.turnstile.remove(widget.current);
      widget.current = null;
    };
  }, []);

  if (!turnstileSiteKey) return null;
  return <div ref={box} className="flex justify-center empty:hidden" />;
});
