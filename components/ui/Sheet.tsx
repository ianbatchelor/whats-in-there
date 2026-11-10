"use client";

import { useEffect, useRef } from "react";
import { IconX } from "./icons";

/** Bottom sheet built on <dialog>, so focus trapping and Escape come from the browser. */
export function Sheet({
  open,
  onClose,
  title,
  children,
  side = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  /** On big screens, open as a full-height panel on the right instead of a centred card. */
  side?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-label={title}
      className={`m-0 mt-auto w-full max-w-none bg-transparent p-0 backdrop:bg-[#0c1a14]/45 backdrop:backdrop-blur-[2px] sm:m-auto sm:max-w-md ${
        side ? "lg:m-0 lg:ml-auto lg:h-dvh lg:max-h-none lg:w-[440px] lg:max-w-none lg:backdrop:bg-[#0c1a14]/25 lg:backdrop:backdrop-blur-none" : ""
      }`}
    >
      <div
        className={`mx-auto flex w-full max-w-md flex-col gap-4 rounded-t-[24px] bg-bg sm:rounded-[24px] px-5 pt-2.5 shadow-[0_-12px_40px_-20px_rgba(0,0,0,0.35)] pb-[max(24px,env(safe-area-inset-bottom))] text-fg ${
          side ? "lg:h-full lg:max-w-none lg:rounded-none lg:border-l lg:border-line lg:px-7 lg:pt-7 lg:shadow-[-24px_0_60px_-30px_rgba(0,0,0,0.35)]" : ""
        }`}
      >
        <span className={`mx-auto h-1.5 w-10 rounded-full bg-line ${side ? "lg:hidden" : ""}`} aria-hidden="true" />
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-display text-[1.35rem] font-bold tracking-[-0.02em]">{title}</h2>
          {side ? (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="hidden size-9 shrink-0 place-items-center rounded-full text-mute hover:bg-card hover:text-fg lg:grid"
            >
              <IconX className="size-[18px]" />
            </button>
          ) : null}
        </div>
        {children}
      </div>
    </dialog>
  );
}
