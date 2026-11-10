"use client";

import { useEffect, useRef } from "react";

/** Bottom sheet built on <dialog>, so focus trapping and Escape come from the browser. */
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
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
      className="m-0 mt-auto w-full max-w-none bg-transparent p-0 backdrop:bg-[#0c1a14]/45 backdrop:backdrop-blur-[2px] sm:mx-auto sm:max-w-md"
    >
      <div className="mx-auto flex w-full max-w-md flex-col gap-4 rounded-t-[28px] bg-bg px-5 pt-2.5 shadow-[0_-12px_40px_-20px_rgba(0,0,0,0.35)] pb-[max(24px,env(safe-area-inset-bottom))] text-fg">
        <span className="mx-auto h-1.5 w-10 rounded-full bg-line" aria-hidden="true" />
        <h2 className="font-display text-[1.35rem] font-bold tracking-[-0.02em]">{title}</h2>
        {children}
      </div>
    </dialog>
  );
}
