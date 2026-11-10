"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { publicOrigin } from "@/lib/config";
import { friendlyError } from "@/lib/supabase/errors";
import { stickerLink } from "@/lib/domain/sticker";
import { loadMyRole, loadStickerCode, rotateSticker } from "@/lib/stickers";
import { Sheet } from "@/components/ui/Sheet";
import { Button, buttonBase, buttonStyles } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { IconCheck, IconCopy, IconPrinter } from "@/components/ui/icons";
import { QrCode } from "./QrCode";
import { WriteSticker } from "./WriteSticker";
import { canWriteStickersHere } from "@/lib/webNfc";

/**
 * A place's sticker link: the QR code to print, the address to write to an NFC sticker, and
 * (for owners) a way to replace a link that's been shared or lost.
 */
export function StickerSheet({
  open,
  onClose,
  place,
}: {
  open: boolean;
  onClose: () => void;
  place: { id: string; name: string; householdId: string };
}) {
  const [code, setCode] = useState<string | null>(null);
  const [owner, setOwner] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [replaced, setReplaced] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([loadStickerCode(place.id), loadMyRole(place.householdId).catch(() => null)])
      .then(([c, role]) => {
        if (!active) return;
        setCode(c);
        setOwner(role === "owner");
      })
      .catch((e) => active && setError(friendlyError(e)));
    return () => {
      active = false;
    };
  }, [place.id, place.householdId]);

  const link = code ? stickerLink(publicOrigin(), code) : null;
  const canWrite = canWriteStickersHere();

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setError("Couldn't copy. Press and hold the link to copy it instead.");
    }
  }

  async function replace() {
    setBusy(true);
    setError(null);
    try {
      setCode(await rotateSticker(place.id));
      setReplaced(true);
      setConfirm(false);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Sticker and QR label">
      <div className="-mx-1 flex max-h-[68dvh] flex-col gap-5 overflow-y-auto px-1 pb-1">
        <p className="text-[15px] text-mute">
          Put this on {place.name}. Anyone in your household who scans it with their phone camera, or taps an NFC sticker with the same link, goes
          straight here.
        </p>

        {error ? <Notice>{error}</Notice> : null}
        {replaced ? <Notice tone="success">New link made. Old stickers and labels for {place.name} no longer work, so print or write fresh ones.</Notice> : null}

        <div className="flex items-center gap-4 rounded-[var(--radius-card)] border border-line bg-card p-4">
          <div className="size-32 shrink-0 overflow-hidden rounded-xl bg-white p-1 ring-1 ring-line">
            {link ? <QrCode value={link} className="size-full" title={`QR code for ${place.name}`} /> : <div className="size-full animate-pulse rounded-lg bg-sunk" />}
          </div>
          <div className="flex min-w-0 flex-col gap-2">
            <span className="font-display text-sm font-bold">Sticker link</span>
            <code className="font-mono text-[13px] break-all text-fg/85 select-all">{link ?? "Loading…"}</code>
            <button
              onClick={copy}
              disabled={!link}
              className="inline-flex min-h-9 w-fit items-center gap-1.5 rounded-full bg-sunk px-3 text-[13px] font-semibold text-fg transition hover:bg-line disabled:opacity-50"
            >
              {copied ? <IconCheck className="size-4 text-ok" /> : <IconCopy className="size-4" />}
              {copied ? "Copied" : "Copy link"}
            </button>
          </div>
        </div>

        {canWrite && link ? <WriteSticker link={link} placeName={place.name} /> : null}

        <Link href={`/stickers/?id=${place.id}`} className={`${buttonBase} ${canWrite ? buttonStyles.ghost : buttonStyles.go}`}>
          <IconPrinter /> Print QR label
        </Link>

        <section aria-labelledby="nfc-h" className="flex flex-col gap-2.5 rounded-[var(--radius-card)] bg-sunk/70 p-4">
          <h3 id="nfc-h" className="font-display text-[15px] font-bold">
            {canWrite ? "Writing from another phone" : "Writing an NFC sticker"}
          </h3>
          <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-[14px] text-fg/85 marker:font-semibold marker:text-mute">
            <li>Copy the link above.</li>
            <li>
              Install the free <b>NFC Tools</b> app on your phone.
            </li>
            <li>
              Tap <b>Write</b>, then <b>Add a record</b>, then <b>URL / URI</b>, and paste the link.
            </li>
            <li>
              Tap <b>Write</b> and hold the top of your phone against the sticker.
            </li>
          </ol>
          <p className="text-[13px] text-mute">
            Leave the sticker unlocked, so it can be rewritten if you ever replace the link. On an iPhone, tapping a written sticker shows a banner; tap it
            to open {place.name}.
          </p>
        </section>

        {owner ? (
          confirm ? (
            <div className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-warn/40 bg-warn/5 p-4">
              <p className="text-[14px]">
                Make a new link for {place.name}? Every sticker and printed label you already have for it will stop working.
              </p>
              <div className="flex gap-2">
                <Button variant="ghost" className="flex-1" onClick={() => setConfirm(false)}>
                  Keep this one
                </Button>
                <Button className="flex-1 bg-warn! text-white!" busy={busy} onClick={replace}>
                  Make new link
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="danger" className="self-start px-0" onClick={() => setConfirm(true)}>
              Lost a sticker? Make a new link
            </Button>
          )
        ) : null}
      </div>
    </Sheet>
  );
}
