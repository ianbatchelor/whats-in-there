"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { Session } from "@supabase/supabase-js";
import { AuthGate } from "@/components/AuthGate";
import { AppShell, SectionLabel } from "@/components/AppShell";
import { HouseholdLoading, PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { IconBell, IconBook, IconBox, IconGift, IconHouse, IconPeople, IconSnow } from "@/components/ui/icons";
import { supabase } from "@/lib/supabase/client";
import { friendlyError } from "@/lib/supabase/errors";
import { loadLists } from "@/lib/ownLists";
import { loadNames } from "@/lib/sharedPlaces";
import {
  askToNotify,
  canNotify,
  hasPhone,
  loadFollows,
  loadPrefs,
  localZone,
  permission,
  savePrefs,
  sendTest,
  setFollow,
  type NotifyPrefs,
  type Permission,
} from "@/lib/notifications";
import { HOURS, MODES, hourLabel, quietLine, startingMode, type NotifyKind, type NotifyMode, type Visibility } from "@/lib/domain/notifications";

export default function NotificationsPage() {
  return <AuthGate>{(session) => <Notifications session={session} />}</AuthGate>;
}

type Row = { kind: NotifyKind; id: string; title: string; sub: string; visibility?: Visibility; icon: "gift" | "book" | "people" | "house" | "snow" | "box"; href: string };

const ICONS = { gift: IconGift, book: IconBook, people: IconPeople, house: IconHouse, snow: IconSnow, box: IconBox } as const;
const first = (n: string) => n.trim().split(/\s+/)[0] || n;

/** Everything you could hear about: other people's wish lists, lists shared with you or by you, and places. */
async function loadRows(me: string): Promise<Row[]> {
  const [wish, lists, places] = await Promise.all([
    supabase().from("wish_lists").select("id, for_user, name, kind, friend"),
    loadLists(),
    supabase().from("storage_locations").select("id, name, type").is("parent_id", null).is("archived_at", null).order("sort_order"),
  ]);
  if (wish.error) throw wish.error;
  if (places.error) throw places.error;
  // A friend's own book list lives outside the household, so nobody here is told about it.
  const others = (wish.data ?? []).filter((w) => w.for_user !== me && !w.friend);
  const names = await loadNames(others.map((w) => w.for_user as string).filter(Boolean)).catch(() => new Map<string, string>());
  const rows: Row[] = others.map((w) => {
    const who = first((w.for_user && names.get(w.for_user as string)) || (w.name as string | null) || "Someone");
    const books = w.kind === "books";
    const key = (w.for_user as string | null) ?? (w.id as string);
    return {
      kind: "wish_list",
      id: w.id as string,
      title: `${who}'s ${books ? "book wish list" : "wish list"}`,
      sub: books ? "New books on it" : "New present ideas",
      icon: books ? "book" : "gift",
      href: books ? `/books/?for=${key}` : `/presents/?for=${key}`,
    };
  });
  for (const l of lists) {
    if (l.visibility === "me") continue;
    rows.push({
      kind: "list",
      id: l.id,
      title: l.title,
      sub: l.visibility === "group" ? "Shared with a group" : l.visibility === "family" ? "Shared with family" : "Shared at home",
      visibility: l.visibility as Visibility,
      icon: l.visibility === "group" ? "people" : l.visibility === "family" ? "gift" : "house",
      href: `/my-list/?id=${l.id}`,
    });
  }
  for (const p of places.data ?? []) {
    rows.push({
      kind: "place",
      id: p.id as string,
      title: p.name as string,
      sub: "Things going in or out, and what to use soon",
      icon: p.type === "freezer" ? "snow" : "box",
      href: `/place/?id=${p.id}`,
    });
  }
  return rows;
}

function Notifications({ session }: { session: Session }) {
  const me = session.user.id;
  const native = canNotify();
  const [prefs, setPrefs] = useState<NotifyPrefs | null>(null);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [follows, setFollows] = useState<Map<string, NotifyMode>>(new Map());
  const [perm, setPerm] = useState<Permission | null>(null);
  const [phone, setPhone] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [p, r, f, ph, pm] = await Promise.all([loadPrefs(), loadRows(me), loadFollows(), hasPhone(), permission()]);
      setPrefs(p);
      setRows(r);
      setFollows(f);
      setPhone(ph);
      setPerm(pm);
    } catch (e) {
      setError(friendlyError(e));
    }
  }, [me]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  async function run(key: string, work: () => Promise<void>) {
    setError(null);
    setNote(null);
    setBusy(key);
    try {
      await work();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(null);
    }
  }

  const change = (next: NotifyPrefs) =>
    run("prefs", async () => {
      await savePrefs({ ...next, timeZone: localZone() });
      setPrefs(next);
    });

  const modeOf = (r: Row): NotifyMode => follows.get(`${r.kind}:${r.id}`) ?? startingMode(r.kind, r.visibility);
  const choose = (r: Row, next: NotifyMode) =>
    run(`row-${r.id}`, async () => {
      if (next !== "off" && native && !(await askToNotify())) {
        setPerm("denied");
        return;
      }
      await setFollow(r.kind, r.id, next);
      setFollows((m) => new Map(m).set(`${r.kind}:${r.id}`, next));
      if (next !== "off" && native) setPhone(true);
    });

  const turnOn = () =>
    run("allow", async () => {
      const ok = await askToNotify();
      setPerm(ok ? "granted" : "denied");
      if (ok) setPhone(true);
    });

  const test = () =>
    run("test", async () => {
      const sent = await sendTest();
      setNote(sent > 0 ? "Sent. It should arrive in a few seconds." : "Nothing was sent. Is this phone set to allow notifications?");
    });

  return (
    <AppShell>
      <PageHeader title="Notifications" back={{ href: "/household/", label: "People" }} sub="Hear on your phone when something's added to a list. Nothing about who's getting what is ever sent." />
      {error ? <Notice>{error}</Notice> : null}
      {note ? <Notice tone="info">{note}</Notice> : null}

      {prefs === null || rows === null ? (
        <HouseholdLoading />
      ) : (
        <>
          {!native ? (
            <Notice tone="info">Notifications arrive in the iPhone app. Choices you make here are saved for it.</Notice>
          ) : perm === "denied" ? (
            <Notice tone="info">Notifications are switched off for this app. Turn them on in your iPhone&apos;s Settings, then Notifications, then See What&apos;s in Here.</Notice>
          ) : perm === "prompt" ? (
            <div className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-4 shadow-[var(--shadow-card)]">
              <p className="text-[15px]">Let this phone show notifications, so you hear when someone adds a present idea.</p>
              <Button busy={busy === "allow"} onClick={turnOn} className="self-start">
                <IconBell className="size-5" /> Turn on notifications
              </Button>
            </div>
          ) : null}

          <section aria-labelledby="follow-h" className="flex flex-col gap-2.5">
            <SectionLabel id="follow-h">What you hear about</SectionLabel>
            {rows.length === 0 ? (
              <p className="text-[14.5px] text-mute">
                Nothing shared with you yet. Present lists and lists shared with family or a group show up here. <Link href="/lists/" className="font-semibold text-leaf">Lists</Link>
              </p>
            ) : (
              <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card shadow-[var(--shadow-card)]">
                {rows.map((r) => {
                  const Icon = ICONS[r.icon];
                  return (
                    <li key={`${r.kind}:${r.id}`} className="flex min-h-16 items-center gap-3 px-4 py-2.5">
                      <Icon className="size-5 shrink-0 text-leaf" />
                      <Link href={r.href} className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">{r.title}</span>
                        <span className="block truncate text-[13.5px] text-mute">{r.sub}</span>
                      </Link>
                      <select
                        value={modeOf(r)}
                        onChange={(e) => choose(r, e.target.value as NotifyMode)}
                        disabled={busy === `row-${r.id}` || prefs.paused}
                        aria-label={`Notifications for ${r.title}`}
                        className={`min-h-10 shrink-0 rounded-full border px-3 font-display text-[13px] font-bold disabled:opacity-50 ${modeOf(r) === "off" ? "border-line bg-card text-mute" : "border-leaf/30 bg-leaf/10 text-leaf"}`}
                      >
                        {MODES.map((m) => (
                          <option key={m.mode} value={m.mode}>
                            {m.mode === "every" ? "Every change" : m.mode === "daily" ? "Daily" : "Off"}
                          </option>
                        ))}
                      </select>
                    </li>
                  );
                })}
              </ul>
            )}
            <p className="text-[13.5px] text-mute">Lists you share at home and places start off, so the shopping list and the freezer don&apos;t buzz all day. Wish lists and family or group lists start on. A daily summary comes at 6 pm, and places you follow also send a 9 am reminder when something needs using soon.</p>
          </section>

          <section aria-labelledby="quiet-h" className="flex flex-col gap-2.5">
            <SectionLabel id="quiet-h">Quiet hours</SectionLabel>
            <div className="flex flex-wrap items-center gap-2 text-[15px]">
              <span>From</span>
              <select
                value={prefs.quietFrom}
                onChange={(e) => change({ ...prefs, quietFrom: Number(e.target.value) })}
                className="min-h-11 rounded-xl border border-line bg-card px-3"
                aria-label="Quiet from"
              >
                {HOURS.map((h) => (
                  <option key={h} value={h}>
                    {hourLabel(h)}
                  </option>
                ))}
              </select>
              <span>to</span>
              <select
                value={prefs.quietTo}
                onChange={(e) => change({ ...prefs, quietTo: Number(e.target.value) })}
                className="min-h-11 rounded-xl border border-line bg-card px-3"
                aria-label="Quiet until"
              >
                {HOURS.map((h) => (
                  <option key={h} value={h}>
                    {hourLabel(h)}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-[13.5px] text-mute">{quietLine(prefs.quietFrom, prefs.quietTo)}</p>
          </section>

          <section aria-labelledby="pause-h" className="flex flex-col gap-2.5">
            <SectionLabel id="pause-h">Pause</SectionLabel>
            <Button variant="ghost" busy={busy === "prefs"} onClick={() => change({ ...prefs, paused: !prefs.paused })} className="w-full">
              {prefs.paused ? "Turn notifications back on" : "Pause all notifications"}
            </Button>
            {prefs.paused ? <p className="text-[13.5px] text-mute">Paused. Nothing is sent, and nothing saves up for later.</p> : null}
          </section>

          {native && phone && perm === "granted" ? (
            <Button variant="quiet" busy={busy === "test"} onClick={test} className="self-center">
              Send me a test notification
            </Button>
          ) : null}
        </>
      )}
    </AppShell>
  );
}
