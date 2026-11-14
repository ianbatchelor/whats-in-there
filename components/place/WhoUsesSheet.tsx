"use client";

import { PeopleLink } from "@/components/common/PeopleLink";
import { useEffect, useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { IconCopy, IconLink, IconLock, IconShare } from "@/components/ui/icons";
import { friendlyError } from "@/lib/supabase/errors";
import { publicOrigin } from "@/lib/config";
import type { Member } from "@/lib/household";
import { placeJoinMessage, placeJoinUrl } from "@/lib/domain/sharedPlaces";
import { makePlaceLink, placeLinkExpiry, sharePlaceWith, stopPlaceLinks, unsharePlace, type PlacePerson } from "@/lib/sharedPlaces";

/**
 * Who can use one place without living in the household. People at home tick family in, send a
 * link to anyone else, or take someone out. Someone who was let in sees who else uses it and can leave.
 */
export function WhoUsesSheet({
  open,
  onClose,
  place,
  guest,
  household,
  me,
  family,
  people,
  onChanged,
  onLeft,
}: {
  open: boolean;
  onClose: () => void;
  place: { id: string; name: string };
  /** You were let in; you don't live there. */
  guest: boolean;
  /** The household's name, for guests. */
  household?: string;
  me: string;
  /** Family members of the household (presents only), who can be ticked in. */
  family: Member[];
  /** Everyone let into this place. */
  people: PlacePerson[];
  onChanged: () => void;
  onLeft: () => void;
}) {
  const [token, setToken] = useState<string | null>(null);
  const [expires, setExpires] = useState<string | null | undefined>(undefined);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [said, setSaid] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    /* eslint-disable react-hooks/set-state-in-effect */
    setSaid(null);
    setError(null);
    setToken(null);
    /* eslint-enable react-hooks/set-state-in-effect */
    if (guest) return;
    placeLinkExpiry(place.id)
      .then(setExpires)
      .catch(() => setExpires(null));
  }, [open, guest, place.id]);

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

  const url = token ? placeJoinUrl(publicOrigin(), token) : null;
  const inIds = new Set(people.map((p) => p.userId));
  const others = people.filter((p) => !family.some((f) => f.userId === p.userId));

  const newLink = () =>
    work("make", async () => {
      setToken(await makePlaceLink(place.id));
      setExpires(await placeLinkExpiry(place.id).catch(() => null));
    });

  async function send() {
    if (!url) return;
    const text = placeJoinMessage(place.name, url);
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
      await stopPlaceLinks(place.id);
      setToken(null);
      setExpires(null);
      setSaid("Links you sent have stopped working. Anyone already in stays.");
    });

  const toggle = (m: Member) =>
    work(m.userId, async () => {
      if (inIds.has(m.userId)) {
        await unsharePlace(place.id, m.userId);
        setSaid(`${m.displayName} can no longer see ${place.name}.`);
      } else {
        await sharePlaceWith(place.id, m.userId);
        setSaid(`${m.displayName} can now see and use ${place.name}. It shows on their Home.`);
      }
      onChanged();
    });

  const remove = (p: PlacePerson) =>
    work(p.userId, async () => {
      await unsharePlace(place.id, p.userId);
      setSaid(`${p.name} can no longer see ${place.name}.`);
      onChanged();
    });

  const leave = () =>
    work("leave", async () => {
      await unsharePlace(place.id, me);
      onLeft();
    });

  const until = expires ? new Date(expires).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" }) : null;
  const initial = (name: string) => name.trim().charAt(0).toUpperCase() || "?";

  if (guest) {
    return (
      <Sheet open={open} onClose={onClose} title="Shared with you">
        <div className="flex flex-col gap-4">
          <p className="flex gap-2.5 text-[15px]">
            <IconLock className="mt-0.5 size-[18px] shrink-0 text-leaf" />
            <span>
              {household ?? "Their household"} let you into {place.name}. You can see what&apos;s in it and add and take things out. You don&apos;t see
              anything else of theirs, and they don&apos;t see your home.
            </span>
          </p>
          {people.length > 1 ? (
            <section aria-labelledby="place-people" className="flex flex-col gap-2">
              <h3 id="place-people" className="font-display text-sm font-bold">
                Also let in
              </h3>
              <ul className="overflow-hidden rounded-2xl border border-line bg-card">
                {people
                  .filter((p) => p.userId !== me)
                  .map((p) => (
                    <li key={p.userId} className="flex min-h-12 items-center gap-3 border-b border-line px-3 py-2 last:border-b-0">
                      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-sunk font-display text-[14px] font-bold" aria-hidden="true">
                        {initial(p.name)}
                      </span>
                      <span className="truncate font-semibold">{p.name}</span>
                    </li>
                  ))}
              </ul>
            </section>
          ) : null}
          {error ? <Notice>{error}</Notice> : null}
          <Button variant="danger" onClick={leave} busy={busy === "leave"} className="self-start px-0">
            Stop using {place.name}
          </Button>
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet open={open} onClose={onClose} title="Who else uses this?">
      <div className="flex flex-col gap-4">
        <p className="text-[15px] text-mute">
          Let in someone who doesn&apos;t live here, like a grown-up child who keeps food in your freezer. They see {place.name} and the boxes
          inside it, and can add and take things out. Nothing else in your home, and you see nothing of theirs.
        </p>

        <section aria-labelledby="place-family" className="flex flex-col gap-2">
          <h3 id="place-family" className="font-display text-sm font-bold">
            Family
          </h3>
          {family.length > 0 ? (
            <ul className="overflow-hidden rounded-2xl border border-line bg-card">
              {family.map((m) => {
                const on = inIds.has(m.userId);
                return (
                  <li key={m.userId} className="flex min-h-14 items-center gap-3 border-b border-line px-3 py-2 last:border-b-0">
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-plum-bg font-display text-[14px] font-bold text-plum" aria-hidden="true">
                      {initial(m.displayName)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{m.displayName}</span>
                      <span className="block text-[13px] text-mute">{on ? `Uses ${place.name}` : "Presents only"}</span>
                    </span>
                    <Button
                      variant={on ? "quiet" : "ghost"}
                      onClick={() => toggle(m)}
                      busy={busy === m.userId}
                      aria-pressed={on}
                      className={`min-h-10 px-3 text-[14px] ${on ? "text-warn" : ""}`}
                    >
                      {on ? "Take out" : "Let in"}
                    </Button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-[14px] text-mute">Family you add on the People page show up here, ready to let in.</p>
          )}
        </section>

        {others.length > 0 ? (
          <section aria-labelledby="place-others" className="flex flex-col gap-2">
            <h3 id="place-others" className="font-display text-sm font-bold">
              Joined with a link
            </h3>
            <ul className="overflow-hidden rounded-2xl border border-line bg-card">
              {others.map((p) => (
                <li key={p.userId} className="flex min-h-14 items-center gap-3 border-b border-line px-3 py-2 last:border-b-0">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-sunk font-display text-[14px] font-bold" aria-hidden="true">
                    {initial(p.name)}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-semibold">{p.name}</span>
                  <Button variant="quiet" onClick={() => remove(p)} busy={busy === p.userId} className="min-h-10 px-2 text-[14px] text-warn">
                    Take out
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section aria-labelledby="place-link" className="flex flex-col gap-2">
          <h3 id="place-link" className="font-display text-sm font-bold">
            Someone else
          </h3>
          {url ? (
            <div className="flex flex-col gap-2">
              <Button onClick={send} className="w-full">
                <IconShare className="size-[18px]" /> Send the link
              </Button>
              <Button variant="ghost" onClick={copy} className="w-full">
                <IconCopy className="size-[18px]" /> Copy the link
              </Button>
              <p className="text-[13.5px] text-mute">It lets one person in, and works for 7 days.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <Button variant="ghost" onClick={newLink} busy={busy === "make"} className="w-full">
                <IconLink className="size-[18px]" /> Make an invitation link
              </Button>
              <p className="text-[13.5px] text-mute">
                {until ? `A link you sent works until ${until}. ` : ""}Each link lets one person in, and works for 7 days.
              </p>
            </div>
          )}
          {expires ? (
            <Button variant="danger" onClick={stop} busy={busy === "stop"} className="self-start px-0">
              Stop the links
            </Button>
          ) : null}
        </section>

        {said ? <Notice tone="info">{said}</Notice> : null}
        {error ? <Notice>{error}</Notice> : null}
        <PeopleLink />
      </div>
    </Sheet>
  );
}
