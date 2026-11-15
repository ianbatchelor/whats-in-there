"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { IconBell, IconBellOff } from "@/components/ui/icons";
import { askToNotify, canNotify, loadFollow, setFollow } from "@/lib/notifications";
import { hasBell, type NotifyKind, type NotifyMode, type Visibility } from "@/lib/domain/notifications";
import { friendlyError } from "@/lib/supabase/errors";

/**
 * The bell on a list: whether you hear on your phone when something's added. Asking the phone for
 * permission happens here, the first time a bell is turned on, never when the app opens.
 */
export function NotifyBell({
  kind,
  id,
  visibility,
  tone = "plain",
}: {
  kind: NotifyKind;
  id: string;
  visibility?: Visibility;
  /** "onWrap" sits on a coloured present band and takes its colours from it. */
  tone?: "plain" | "onWrap";
}) {
  const key = `${kind}:${id}:${visibility ?? ""}`;
  /** The bell's state, for the list it was loaded for (the presents page switches lists in place). */
  const [got, setGot] = useState<{ key: string; mode: NotifyMode } | null>(null);
  const mode = got?.key === key ? got.mode : null;
  const setMode = (m: NotifyMode) => setGot({ key, mode: m });
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<React.ReactNode>(null);

  useEffect(() => {
    let live = true;
    loadFollow(kind, id, visibility)
      .then((m) => live && setGot({ key, mode: m }))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [key, kind, id, visibility]);

  if (!hasBell(kind, visibility) || mode === null) return null;
  const on = mode === "every";

  async function toggle() {
    setBusy(true);
    setNote(null);
    try {
      if (!on) {
        const allowed = await askToNotify();
        if (!allowed) {
          setNote("Notifications are switched off for this app on your iPhone. Turn them on in Settings, then Notifications, then See What's in Here.");
          return;
        }
      }
      const next: NotifyMode = on ? "off" : "every";
      await setFollow(kind, id, next);
      setMode(next);
      if (next === "every" && !canNotify()) {
        setNote(
          <>
            Saved. Notifications arrive on the iPhone app.{" "}
            <Link href="/notifications/" className="font-semibold underline underline-offset-2">
              Notifications
            </Link>
          </>,
        );
      }
    } catch (e) {
      setNote(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }

  const label = on ? "Notifying you" : "Notify me";
  const what = kind === "wish_list" ? "new ideas" : "new things on this list";
  const look =
    tone === "onWrap"
      ? `bg-black/20 ${on ? "" : "opacity-85"}`
      : on
        ? "bg-leaf/10 text-leaf ring-1 ring-inset ring-leaf/25"
        : "bg-card text-mute ring-1 ring-inset ring-line";
  return (
    <div className="flex flex-col items-start gap-1.5">
      <button
        onClick={toggle}
        disabled={busy}
        aria-pressed={on}
        title={on ? `You'll get a notification about ${what}. Tap to stop.` : `Get a notification about ${what}`}
        className={`inline-flex min-h-10 items-center gap-1.5 rounded-full px-3.5 font-display text-[13.5px] font-bold transition active:scale-[0.98] disabled:opacity-60 ${look}`}
      >
        {on ? <IconBell className="size-[17px]" /> : <IconBellOff className="size-[17px]" />}
        {label}
      </button>
      {note ? <p className="max-w-xs text-[13px] leading-snug opacity-90">{note}</p> : null}
    </div>
  );
}
