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
      className="m-0 mt-auto w-full max-w-none bg-transparent p-0 backdrop:bg-[#061216]/45 sm:mx-auto sm:max-w-md"
    >
      <div className="mx-auto flex w-full max-w-md flex-col gap-4 rounded-t-[26px] bg-bg px-4 pt-2.5 pb-[max(24px,env(safe-area-inset-bottom))] text-fg">
        <span className="mx-auto h-1.5 w-10 rounded-full bg-line" aria-hidden="true" />
        <h2 className="font-display text-xl font-extrabold tracking-tight">{title}</h2>
        {children}
      </div>
    </dialog>
  );
}
