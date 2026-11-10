"use client";

import { useEffect, useRef, useState } from "react";
import { writeFailure, writeStickerLink } from "@/lib/webNfc";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { IconCheck, IconSticker } from "@/components/ui/icons";

type State = { kind: "idle" } | { kind: "waiting" } | { kind: "done" } | { kind: "error"; message: string };

/** Writes a place's link to an NFC sticker from this phone (Chrome on Android). */
export function WriteSticker({ link, placeName }: { link: string; placeName: string }) {
  const [state, setState] = useState<State>({ kind: "idle" });
  const abort = useRef<AbortController | null>(null);

  useEffect(() => () => abort.current?.abort(), []);

  async function start() {
    abort.current?.abort();
    const ctl = new AbortController();
    abort.current = ctl;
    setState({ kind: "waiting" });
    try {
      await writeStickerLink(link, ctl.signal);
      setState({ kind: "done" });
    } catch (e) {
      const f = writeFailure(e);
      if (f === "cancelled") return setState({ kind: "idle" });
      setState({
        kind: "error",
        message:
          f === "blocked"
            ? "Your phone didn't allow NFC. Check NFC is switched on in Settings, and allow it for this site when asked."
            : "That didn't write. Hold the sticker still against the back of your phone until it says it's done, then try again.",
      });
    } finally {
      if (abort.current === ctl) abort.current = null;
    }
  }

  if (state.kind === "waiting") {
    return (
      <div className="flex flex-col items-center gap-3 rounded-[var(--radius-card)] bg-ice p-5 text-center" role="status">
        <span className="relative grid size-16 place-items-center rounded-full bg-card text-go shadow-[var(--shadow-card)]">
          <span className="absolute inset-0 animate-ping rounded-full bg-go/15" aria-hidden="true" />
          <IconSticker className="size-8" />
        </span>
        <p className="font-display text-[16px] font-bold">Hold a sticker to the back of your phone</p>
        <p className="text-[14px] text-mute">Keep it still for a second. Writing it links the sticker to {placeName}.</p>
        <Button variant="ghost" onClick={() => abort.current?.abort()}>
          Cancel
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {state.kind === "done" ? (
        <Notice tone="success">
          <span className="inline-flex items-center gap-1.5 font-semibold">
            <IconCheck className="size-4" /> Sticker written.
          </span>{" "}
          Tap it with your phone to check it opens {placeName}.
        </Notice>
      ) : null}
      {state.kind === "error" ? <Notice>{state.message}</Notice> : null}
      <Button variant={state.kind === "done" ? "ghost" : "go"} onClick={start}>
        <IconSticker /> {state.kind === "done" ? "Write another sticker" : "Write to a sticker"}
      </Button>
    </div>
  );
}
