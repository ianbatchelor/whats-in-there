"use client";

import { useEffect } from "react";

export type ToastData = { id: number; message: string; actionLabel?: string; onAction?: () => void };

/** One short message at the bottom of the screen, with an optional action such as Undo. */
export function Toast({ toast, onDone, ms = 7000 }: { toast: ToastData | null; onDone: () => void; ms?: number }) {
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(onDone, ms);
    return () => clearTimeout(t);
  }, [toast, onDone, ms]);
  if (!toast) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[max(16px,env(safe-area-inset-bottom))]">
      <div
        role="status"
        className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl bg-fg py-2 pr-2 pl-4 text-bg shadow-[0_12px_32px_-12px_rgba(6,18,22,0.5)]"
      >
        <p className="min-w-0 flex-1 py-1.5 text-[15px] leading-snug">{toast.message}</p>
        {toast.actionLabel && toast.onAction ? (
          <button
            onClick={() => {
              toast.onAction?.();
              onDone();
            }}
            className="min-h-11 shrink-0 rounded-xl px-3.5 font-display text-[15px] font-bold text-tape"
          >
            {toast.actionLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}
