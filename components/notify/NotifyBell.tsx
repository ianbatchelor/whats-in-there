"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Sheet } from "@/components/ui/Sheet";
import { IconBell, IconBellOff, IconCheck } from "@/components/ui/icons";
import { askToNotify, canNotify, loadFollow, setFollow } from "@/lib/notifications";
import { MODES, PLACE_REMINDER_LINE, hasBell, modeHelp, type NotifyKind, type NotifyMode, type Visibility } from "@/lib/domain/notifications";
import { friendlyError } from "@/lib/supabase/errors";

/**
 * The bell on a list or place: every change, a daily summary, or off. Asking the phone for
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
  /** "onWrap" sits on a coloured present band and takes its colours from it. "onPhoto" is a round
   * icon button for a place's photo header, beside the sticker and edit buttons. */
  tone?: "plain" | "onWrap" | "onPhoto";
}) {
  const key = `${kind}:${id}:${visibility ?? ""}`;
  /** The bell's state, for the list it was loaded for (the presents page switches lists in place). */
  const [got, setGot] = useState<{ key: string; mode: NotifyMode } | null>(null);
  const mode = got?.key === key ? got.mode : null;
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<NotifyMode | null>(null);
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
  const on = mode !== "off";

  async function choose(next: NotifyMode) {
    if (next === mode) return setOpen(false);
    setBusy(next);
    setNote(null);
    try {
      if (next !== "off" && !(await askToNotify())) {
        setNote("Notifications are switched off for this app on your iPhone. Turn them on in Settings, then Notifications, then See What's in Here.");
        return;
      }
      await setFollow(kind, id, next);
      setGot({ key, mode: next });
      if (next !== "off" && !canNotify()) {
        setNote(
          <>
            Saved. Notifications arrive on the iPhone app.{" "}
            <Link href="/notifications/" className="font-semibold text-leaf underline underline-offset-2">
              All notifications
            </Link>
          </>,
        );
      } else {
        setOpen(false);
      }
    } catch (e) {
      setNote(friendlyError(e));
    } finally {
      setBusy(null);
    }
  }

  const label = mode === "every" ? "Notifying you" : mode === "daily" ? "Daily summary" : "Notify me";
  const look =
    tone === "onWrap"
      ? `bg-black/20 ${on ? "" : "opacity-85"}`
      : on
        ? "bg-leaf/10 text-leaf ring-1 ring-inset ring-leaf/25"
        : "bg-card text-mute ring-1 ring-inset ring-line";
  return (
    <>
      <button
        onClick={() => {
          setNote(null);
          setOpen(true);
        }}
        aria-haspopup="dialog"
        aria-label={tone === "onPhoto" ? `Notifications: ${label}` : undefined}
        title={tone === "onPhoto" ? label : undefined}
        className={tone === "onPhoto" ? `relative grid size-11 place-items-center rounded-full bg-[#fffdf8]/92 shadow-[var(--shadow-card)] backdrop-blur transition hover:bg-[#fffdf8] ${on ? "text-leaf" : "text-[#17242a]"}` : `inline-flex min-h-10 items-center gap-1.5 rounded-full px-3.5 font-display text-[13.5px] font-bold transition active:scale-[0.98] ${look}`}
      >
        {tone === "onPhoto" ? (
          on ? (
            <IconBell className="size-5" />
          ) : (
            <IconBellOff className="size-5" />
          )
        ) : (
          <>
            {on ? <IconBell className="size-[17px]" /> : <IconBellOff className="size-[17px]" />}
            {label}
          </>
        )}
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Notifications">
        <div className="flex flex-col gap-3">
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card">
            {MODES.map((m) => (
              <li key={m.mode}>
                <button
                  onClick={() => choose(m.mode)}
                  disabled={busy !== null}
                  aria-pressed={m.mode === mode}
                  className="flex min-h-16 w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-sunk/50 disabled:opacity-60"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{m.label}</span>
                    <span className="block text-[13.5px] text-mute">{modeHelp(kind, m.mode)}</span>
                  </span>
                  {m.mode === mode ? <IconCheck className="size-5 shrink-0 text-leaf" /> : null}
                </button>
              </li>
            ))}
          </ul>
          {kind === "place" ? <p className="text-[13.5px] text-mute">{PLACE_REMINDER_LINE}</p> : null}
          {note ? <p className="text-[14px] leading-snug">{note}</p> : null}
          <Link href="/notifications/" className="self-start text-[14px] font-semibold text-leaf">
            Quiet hours and all your notifications
          </Link>
        </div>
      </Sheet>
    </>
  );
}
