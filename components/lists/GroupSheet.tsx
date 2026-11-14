"use client";

import { PeopleLink } from "@/components/common/PeopleLink";
import { useEffect, useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { IconCopy, IconLink, IconShare } from "@/components/ui/icons";
import { friendlyError } from "@/lib/supabase/errors";
import { publicOrigin } from "@/lib/config";
import { joinMessage, joinUrl, type ListPerson, type OwnList } from "@/lib/domain/ownLists";
import { linkExpiry, makeLink, removeMember, stopLink } from "@/lib/ownLists";

/**
 * The people in a group list. Its owner sends the invitation link, makes a new one, stops it or
 * takes someone out; anyone else can leave.
 */
export function GroupSheet({
  open,
  onClose,
  list,
  people,
  me,
  onChanged,
  onLeft,
}: {
  open: boolean;
  onClose: () => void;
  list: OwnList;
  people: ListPerson[];
  me: string;
  onChanged: () => void;
  onLeft: () => void;
}) {
  const isOwner = list.owner === me;
  // The link itself is only known right after making it; afterwards we only know one is out.
  const [token, setToken] = useState<string | null>(null);
  const [expires, setExpires] = useState<string | null | undefined>(undefined);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [said, setSaid] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !isOwner) return;
    /* eslint-disable react-hooks/set-state-in-effect */
    setSaid(null);
    setError(null);
    /* eslint-enable react-hooks/set-state-in-effect */
    linkExpiry(list.id)
      .then(setExpires)
      .catch(() => setExpires(null));
  }, [open, isOwner, list.id]);

  async function work(key: string, fn: () => Promise<void>) {
    setBusy(key);
    setError(null);
    setSaid(null);
    try {
      await fn();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(null);
    }
  }

  const url = token ? joinUrl(publicOrigin(), token) : null;

  const newLink = () =>
    work("make", async () => {
      const made = await makeLink(list.id);
      setToken(made.token);
      setExpires(made.expiresAt);
      onChanged();
    });

  async function send() {
    if (!url) return;
    const text = joinMessage(list.title, url);
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
      await stopLink(list.id);
      setToken(null);
      setExpires(null);
      setSaid("The link has stopped working. Everyone already in the group stays.");
    });

  const remove = (p: ListPerson) =>
    work(p.userId, async () => {
      await removeMember(list.id, p.userId);
      setSaid(`${p.name} is out of the group. Make a new link if they still have the old one.`);
      onChanged();
    });

  const leave = () =>
    work("leave", async () => {
      await removeMember(list.id, me);
      onLeft();
    });

  const sorted = [...people].sort((a, b) => Number(b.isOwner) - Number(a.isOwner) || Number(b.userId === me) - Number(a.userId === me));
  const until = expires ? new Date(expires).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" }) : null;

  return (
    <Sheet open={open} onClose={onClose} title={isOwner ? "Invite people" : "The group"}>
      <div className="flex flex-col gap-4">
        {isOwner ? (
          <>
            <p className="text-[15px] text-mute">
              Anyone with the link can join with their email. They see this list only: nothing else in your home, and you see nothing of
              theirs.
            </p>
            {url ? (
              <div className="flex flex-col gap-2">
                <Button onClick={send} className="w-full">
                  <IconShare className="size-[18px]" /> Send the link
                </Button>
                <Button variant="ghost" onClick={copy} className="w-full">
                  <IconCopy className="size-[18px]" /> Copy the link
                </Button>
                {until ? <p className="text-[13.5px] text-mute">Works until {until}.</p> : null}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <Button onClick={newLink} busy={busy === "make"} className="w-full">
                  <IconLink className="size-[18px]" /> {expires ? "Make a new link" : "Make an invitation link"}
                </Button>
                {expires ? (
                  <p className="text-[13.5px] text-mute">
                    A link is out until {until}. For safety we don&apos;t keep a copy, so making a new one stops the old one.
                  </p>
                ) : (
                  <p className="text-[13.5px] text-mute">Links work for 7 days. You can stop one at any time.</p>
                )}
              </div>
            )}
            {expires ? (
              <Button variant="danger" onClick={stop} busy={busy === "stop"} className="self-start px-0">
                Stop the link
              </Button>
            ) : null}
          </>
        ) : null}

        {said ? <Notice tone="info">{said}</Notice> : null}
        {error ? <Notice>{error}</Notice> : null}

        <section aria-labelledby="group-people" className="flex flex-col gap-2">
          <h3 id="group-people" className="font-display text-sm font-bold">
            In the group · {people.length}
          </h3>
          <ul className="overflow-hidden rounded-2xl border border-line bg-card">
            {sorted.map((p) => (
              <li key={p.userId} className="flex min-h-14 items-center gap-3 border-b border-line px-3 py-2 last:border-b-0">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-plum-bg font-display text-[14px] font-bold text-plum" aria-hidden="true">
                  {p.name.trim().charAt(0).toUpperCase() || "?"}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{p.userId === me ? `${p.name} (you)` : p.name}</span>
                  {p.isOwner ? <span className="block text-[13px] text-mute">Made the list</span> : null}
                </span>
                {isOwner && !p.isOwner ? (
                  <Button variant="quiet" onClick={() => remove(p)} busy={busy === p.userId} className="min-h-10 px-2 text-[14px]">
                    Remove
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        </section>

        {isOwner ? <PeopleLink /> : null}
        {!isOwner ? (
          <Button variant="danger" onClick={leave} busy={busy === "leave"} className="self-start px-0">
            Leave this list
          </Button>
        ) : null}
      </div>
    </Sheet>
  );
}
