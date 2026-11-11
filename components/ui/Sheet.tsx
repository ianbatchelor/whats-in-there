"use client";

import { useEffect, useRef, useState } from "react";
import { IconX } from "./icons";

/** How far down (px) a drag must go, or how fast (px/ms) a flick must be, to close the sheet. */
const CLOSE_DISTANCE = 90;
const CLOSE_SPEED = 0.6;

/**
 * Bottom sheet built on <dialog>, so focus trapping and Escape come from the browser. On a phone it
 * can be dragged down by its handle or title bar to close, like the system sheets, and every sheet
 * has a close button so there's always an obvious way out.
 */
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
  const drag = useRef<{ id: number; y: number; t: number } | null>(null);
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse" || (e.target as HTMLElement).closest("button")) return;
    drag.current = { id: e.pointerId, y: e.clientY, t: e.timeStamp };
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (drag.current?.id !== e.pointerId) return;
    // Pulling up gives a little resistance; pulling down follows the finger.
    const dy = e.clientY - drag.current.y;
    setOffset(dy > 0 ? dy : dy / 6);
  };
  const onPointerEnd = (e: React.PointerEvent) => {
    const start = drag.current;
    if (start?.id !== e.pointerId) return;
    drag.current = null;
    setDragging(false);
    const dy = e.clientY - start.y;
    const speed = dy / Math.max(1, e.timeStamp - start.t);
    if (e.type === "pointerup" && (dy > CLOSE_DISTANCE || (dy > 20 && speed > CLOSE_SPEED))) {
      setOffset(window.innerHeight);
      window.setTimeout(() => {
        onClose();
        setOffset(0);
      }, 160);
    } else {
      setOffset(0);
    }
  };

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
        style={offset ? { transform: `translateY(${offset}px)` } : undefined}
        className={`mx-auto flex w-full max-w-md flex-col gap-4 rounded-t-[24px] bg-bg sm:rounded-[24px] px-5 pt-1 shadow-[0_-12px_40px_-20px_rgba(0,0,0,0.35)] pb-[max(24px,env(safe-area-inset-bottom))] text-fg ${
          dragging ? "" : "transition-transform duration-200 ease-out"
        } ${side ? "lg:h-full lg:max-w-none lg:rounded-none lg:border-l lg:border-line lg:px-7 lg:pt-7 lg:shadow-[-24px_0_60px_-30px_rgba(0,0,0,0.35)]" : ""}`}
      >
        <div
          className="-mx-5 flex touch-none flex-col gap-2 px-5 pt-1.5 select-none"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
        >
          <span className={`mx-auto h-1.5 w-10 rounded-full bg-line ${side ? "lg:hidden" : ""}`} aria-hidden="true" />
          <div className="flex items-start justify-between gap-3">
            <h2 className="min-w-0 pt-1 font-display text-[1.35rem] font-bold tracking-[-0.02em]">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="-mr-1.5 grid size-10 shrink-0 place-items-center rounded-full bg-card text-mute transition hover:text-fg active:scale-95"
            >
              <IconX className="size-[18px]" />
            </button>
          </div>
        </div>
        {children}
      </div>
    </dialog>
  );
}
