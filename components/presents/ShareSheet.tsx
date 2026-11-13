"use client";

import { useEffect, useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { IconCopy, IconShare } from "@/components/ui/icons";
import { publicOrigin } from "@/lib/config";
import { friendlyError } from "@/lib/supabase/errors";
import { firstName, shareMessage, wishShareUrl, type WishList } from "@/lib/domain/presents";
import { bookShareMessage } from "@/lib/domain/books";
import { removeList, shareList, unshareList } from "@/lib/presents";

/**
 * Share a list with family outside the household: a private link that opens a page anyone can
 * read without the app. Stopping sharing makes the old link stop working.
 */
export function ShareSheet({
  open,
  onClose,
  list,
  name,
  mine,
  onChanged,
  onRemoved,
}: {
  open: boolean;
  onClose: () => void;
  list: WishList;
  name: string;
  mine: boolean;
  onChanged: () => void;
  /** Only for lists for someone without an account, which can be removed. */
  onRemoved?: () => void;
}) {
  const [code, setCode] = useState<string | null>(list.shareCode);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [said, setSaid] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setCode(list.shareCode);
    setSaid(null);
    setError(null);
    setConfirmRemove(false);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [list.shareCode, list.id, open]);

  const url = code ? wishShareUrl(publicOrigin(), code) : null;
  const first = firstName(name);
  const books = list.kind === "books";

  async function work(key: string, fn: () => Promise<void>) {
    setBusy(key);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(null);
    }
  }

  const makeLink = () =>
    work("make", async () => {
      setCode(await shareList(list.id));
      onChanged();
    });

  async function send() {
    if (!url) return;
    const text = books ? bookShareMessage(name, url, mine) : shareMessage(name, url, mine);
    try {
      if (navigator.share) {
        await navigator.share({ text });
        return;
      }
      await navigator.clipboard.writeText(text);
      setSaid("Message and link copied. Paste them into a text or WhatsApp.");
    } catch (err) {
      if ((err as { name?: string })?.name !== "AbortError") setSaid(`Couldn't open sharing. Send them this link: ${url}`);
    }
  }

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setSaid("Link copied.");
    } catch {
      setSaid(`Copy this link: ${url}`);
    }
  }

  const stop = () =>
    work("stop", async () => {
      await unshareList(list.id);
      setCode(null);
      setSaid("Sharing stopped. The old link no longer works.");
      onChanged();
    });

  const remove = () =>
    work("remove", async () => {
      await removeList(list.id);
      onRemoved?.();
    });

  return (
    <Sheet open={open} onClose={onClose} title={mine ? "Share your list" : `Share ${first}'s list`}>
      <div className="flex flex-col gap-4">
        <p className="text-[15px] text-mute">
          {books
            ? "Send a private link to friends and family, anyone who might lend or buy you a book. They don't need the app. They can see the books and tap “I'll get this” so nobody buys the same one twice."
            : "Send a private link to grandparents, aunts and uncles, anyone who asks what to get. They don't need the app. They can see the ideas and tap “I'm getting this” so nobody buys the same thing twice."}
          {mine ? " The page asks first whether it's you, so you don't spoil the surprise." : ` ${first} won't see who's getting what.`}
        </p>

        {url ? (
          <>
            <p className="truncate rounded-2xl border border-line bg-sunk px-4 py-3 font-mono text-[14px] text-fg/80">{url}</p>
            <div className="flex flex-wrap gap-2">
              <Button onClick={send} className="max-sm:flex-1">
                <IconShare className="size-[18px]" /> Send link
              </Button>
              <Button variant="ghost" onClick={copy} className="max-sm:flex-1">
                <IconCopy className="size-[18px]" /> Copy
              </Button>
            </div>
            {said ? <p className="text-[14px] text-mute">{said}</p> : null}
            {list.friend ? (
              <p className="text-[14px] text-mute">This is {first}&apos;s own list, started from your link. {first} keeps it up to date from their link.</p>
            ) : (
              <button onClick={stop} disabled={busy !== null} className="min-h-10 self-start text-[14px] font-semibold text-mute hover:text-fg">
                Stop sharing (the link stops working)
              </button>
            )}
          </>
        ) : (
          <>
            {said ? <p className="text-[14px] text-mute">{said}</p> : null}
            <Button onClick={makeLink} busy={busy === "make"} className="max-sm:w-full sm:self-start">
              Make a share link
            </Button>
          </>
        )}

        {error ? <Notice>{error}</Notice> : null}

        {onRemoved ? (
          <div className="border-t border-line pt-4">
            {confirmRemove ? (
              <div className="flex flex-col gap-2">
                <p className="text-[14.5px]">
                  Remove {first}&apos;s list and all its {books ? "books" : "ideas"}? This can&apos;t be undone.
                </p>
                <div className="flex gap-2">
                  <Button variant="danger" onClick={remove} busy={busy === "remove"} className="ring-1 ring-warn/40 ring-inset">
                    Remove the list
                  </Button>
                  <Button variant="ghost" onClick={() => setConfirmRemove(false)}>
                    Keep it
                  </Button>
                </div>
              </div>
            ) : (
              <button onClick={() => setConfirmRemove(true)} className="min-h-10 text-[14px] font-semibold text-warn">
                Remove {first}&apos;s list
              </button>
            )}
          </div>
        ) : null}
      </div>
    </Sheet>
  );
}
