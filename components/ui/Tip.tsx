"use client";

import { useEffect, useState } from "react";
import { KEYS, readLocal, writeLocal } from "@/lib/storage";
import { IconBulb, IconX } from "./icons";

function dismissed(): string[] {
  try {
    const v = JSON.parse(readLocal(KEYS.tips) ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/**
 * A small tip on the screen where it helps, shown until it's closed. Each tip is closed once, on
 * this device, so the help is there when it's new and gone once it's known.
 */
export function Tip({ id, children }: { id: string; children: React.ReactNode }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShow(!dismissed().includes(id));
  }, [id]);
  if (!show) return null;
  return (
    <aside className="flex items-start gap-3 rounded-[var(--radius-card)] bg-check/70 py-2.5 pr-1.5 pl-3.5 text-[14px] leading-snug text-fg/85" aria-label="Tip">
      <IconBulb className="mt-0.5 size-[18px] shrink-0 text-soon" />
      <p className="min-w-0 flex-1 py-0.5">{children}</p>
      <button
        onClick={() => {
          writeLocal(KEYS.tips, JSON.stringify([...dismissed(), id]));
          setShow(false);
        }}
        aria-label="Close tip"
        className="-my-1 grid size-9 shrink-0 place-items-center rounded-full text-mute hover:bg-black/5 hover:text-fg"
      >
        <IconX className="size-4" />
      </button>
    </aside>
  );
}
