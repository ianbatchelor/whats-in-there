"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { IconMail, IconShare } from "@/components/ui/icons";
import { friendlyError } from "@/lib/supabase/errors";
import { listInviteMessage, looksLikeEmail } from "@/lib/domain/listViewers";
import { cancelListInvite, inviteToList, loadListPeople, removeListViewer, type ListPerson } from "@/lib/listViewers";

/**
 * Invites someone by email into the app for this one present list, and shows who can see it.
 * They see only this list's ideas that nobody is getting yet. Lives in the Share sheet.
 */
export function InviteToList({ listId, first, open }: { listId: string; first: string; open: boolean }) {
  const [email, setEmail] = useState("");
  const [people, setPeople] = useState<ListPerson[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<{ to: string; link: string; emailed: boolean } | null>(null);
  const [said, setSaid] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setPeople(await loadListPeople(listId));
    } catch {
      setPeople([]);
    }
  }, [listId]);

  useEffect(() => {
    if (!open) return;
    /* eslint-disable react-hooks/set-state-in-effect */
    setSent(null);
    setSaid(null);
    setError(null);
    setEmail("");
    /* eslint-enable react-hooks/set-state-in-effect */
    refresh();
  }, [open, listId, refresh]);

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

  const invite = (e: React.FormEvent) => {
    e.preventDefault();
    const to = email.trim();
    if (!looksLikeEmail(to)) return setError(friendlyError("bad_email"));
    work("invite", async () => {
      const r = await inviteToList(listId, to);
      setSent({ to, ...r });
      setEmail("");
      await refresh();
    });
  };

  async function sendByHand() {
    if (!sent) return;
    const text = listInviteMessage(first, sent.link);
    try {
      if (navigator.share) {
        await navigator.share({ text });
        return;
      }
      await navigator.clipboard.writeText(text);
      setSaid("Message and link copied. Paste them into an email or a text.");
    } catch (err) {
      if ((err as { name?: string })?.name !== "AbortError") setSaid(`Send them this link: ${sent.link}`);
    }
  }

  return (
    <section className="flex flex-col gap-3 border-t border-line pt-4" aria-labelledby="invite-h">
      <div>
        <h3 id="invite-h" className="font-display text-[16px] font-bold">
          Invite someone into the app
        </h3>
        <p className="text-[14.5px] text-mute">
          They&apos;ll see only {first}&apos;s list, and only what nobody is getting yet. Nothing else of yours. They sign in with the email you put here.
        </p>
      </div>

      <form onSubmit={invite} className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <Field
            label="Their email"
            type="email"
            inputMode="email"
            autoComplete="off"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
            maxLength={254}
          />
        </div>
        <Button type="submit" busy={busy === "invite"} className="max-sm:w-full">
          <IconMail className="size-[18px]" /> Send invite
        </Button>
      </form>

      {sent ? (
        sent.emailed ? (
          <p className="text-[14px] text-ok">Invitation emailed to {sent.to}. It works once, for that email, for 7 days.</p>
        ) : (
          <div className="flex flex-col gap-2 rounded-2xl bg-sunk p-3 text-[14px]">
            <p>The invitation for {sent.to} is ready, but we couldn&apos;t email it. Send them the link yourself:</p>
            <Button variant="ghost" onClick={sendByHand} className="self-start">
              <IconShare className="size-[18px]" /> Send the invitation
            </Button>
            {said ? <p className="text-mute">{said}</p> : null}
          </div>
        )
      ) : null}

      {error ? <Notice>{error}</Notice> : null}

      {people.length > 0 ? (
        <div className="flex flex-col gap-1">
          <p className="text-[13px] font-semibold text-mute">Can see {first}&apos;s list</p>
          <ul className="flex flex-col divide-y divide-line rounded-2xl border border-line">
            {people.map((p) => (
              <li key={p.userId ?? p.inviteId} className="flex min-h-12 items-center gap-3 px-3.5 text-[14.5px]">
                <span className="min-w-0 flex-1 truncate">
                  {p.label}
                  {p.inviteId ? <span className="text-mute"> · invited, not joined yet</span> : null}
                </span>
                <button
                  disabled={busy !== null}
                  onClick={() =>
                    work(`rm-${p.userId ?? p.inviteId}`, async () => {
                      if (p.userId) await removeListViewer(listId, p.userId);
                      else if (p.inviteId) await cancelListInvite(p.inviteId);
                      await refresh();
                    })
                  }
                  className="min-h-10 shrink-0 text-[13.5px] font-semibold text-mute hover:text-warn"
                >
                  {p.userId ? "Remove" : "Cancel"}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
