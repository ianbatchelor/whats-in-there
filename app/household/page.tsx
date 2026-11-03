"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import { AuthGate } from "@/components/AuthGate";
import { supabase } from "@/lib/supabase/client";
import { friendlyError } from "@/lib/supabase/errors";
import { publicOrigin } from "@/lib/config";
import { buildInviteUrl } from "@/lib/domain/invite";
import { formatDay } from "@/lib/domain/dates";
import { loadMembers, loadMemberships, pickCurrent, rememberHousehold, type Member, type Membership } from "@/lib/household";
import { KEYS, writeLocal } from "@/lib/storage";
import { Screen, Splash } from "@/components/ui/Screen";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { Field } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Sheet";
import { IconCheck, IconChevronLeft, IconCopy } from "@/components/ui/icons";

type Invite = { id: string; expires_at: string; created_at: string };

export default function HouseholdPage() {
  return <AuthGate>{(session) => <Household session={session} />}</AuthGate>;
}

function Household({ session }: { session: Session }) {
  const router = useRouter();
  const [all, setAll] = useState<Membership[]>([]);
  const [current, setCurrent] = useState<Membership | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState("");
  const [confirmLeave, setConfirmLeave] = useState(false);

  const isOwner = current?.role === "owner";

  const load = useCallback(async () => {
    const memberships = await loadMemberships(session.user.id);
    setAll(memberships);
    const chosen = pickCurrent(memberships);
    if (!chosen) return router.replace("/welcome/");
    setCurrent(chosen);
    setMembers(await loadMembers(chosen.householdId));
    if (chosen.role === "owner") {
      const { data } = await supabase()
        .from("household_invitations")
        .select("id, expires_at, created_at")
        .eq("household_id", chosen.householdId)
        .is("used_at", null)
        .is("revoked_at", null)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false });
      setInvites((data ?? []) as Invite[]);
    }
  }, [session.user.id, router]);

  useEffect(() => {
    // Fetching on mount; state is only set after the awaits resolve.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load().catch((e) => setError(friendlyError(e)));
  }, [load]);

  async function run(key: string, fn: () => Promise<void>) {
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

  const createInvite = () =>
    run("invite", async () => {
      const { data, error } = await supabase().rpc("create_invitation", { p_household: current!.householdId });
      if (error) throw error;
      const row = (data as { token: string }[])[0]!;
      setLink(buildInviteUrl(publicOrigin(), row.token));
      setCopied(false);
      await load();
    });

  async function copyLink() {
    if (!link) return;
    try {
      if (navigator.share) {
        await navigator.share({ title: `Join ${current?.name} on See What's in Here`, url: link });
        return;
      }
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      /* user cancelled share */
    }
  }

  const revoke = (id: string) =>
    run(`revoke-${id}`, async () => {
      const { error } = await supabase().rpc("revoke_invitation", { p_invitation: id });
      if (error) throw error;
      await load();
    });

  const rename = (e: React.FormEvent) => {
    e.preventDefault();
    return run("rename", async () => {
      const { error } = await supabase().from("households").update({ name: newName.trim() }).eq("id", current!.householdId);
      if (error) throw error;
      setRenaming(false);
      await load();
    });
  };

  const removeMember = (m: Member) =>
    run(`remove-${m.userId}`, async () => {
      const { error } = await supabase().rpc("remove_member", { p_household: current!.householdId, p_user: m.userId });
      if (error) throw error;
      await load();
    });

  const makeOwner = (m: Member) =>
    run(`owner-${m.userId}`, async () => {
      const { error } = await supabase().rpc("set_member_role", { p_household: current!.householdId, p_user: m.userId, p_role: "owner" });
      if (error) throw error;
      await load();
    });

  const leave = () =>
    run("leave", async () => {
      const { error } = await supabase().rpc("leave_household", { p_household: current!.householdId });
      if (error) throw error;
      writeLocal(KEYS.household, null);
      router.replace("/");
    });

  const signOut = () =>
    run("signout", async () => {
      await supabase().auth.signOut();
      writeLocal(KEYS.household, null);
      router.replace("/sign-in/");
    });

  if (!current) return error ? <Screen><Notice>{error}</Notice></Screen> : <Splash />;

  return (
    <Screen>
      <Link href="/" className="flex items-center gap-0.5 self-start pt-2 font-bold text-go">
        <IconChevronLeft className="size-4" /> Home
      </Link>

      <header className="flex flex-col gap-1">
        <h1 className="font-display text-[1.9rem] leading-none font-extrabold tracking-[-0.02em]">{current.name}</h1>
        <p className="text-sm text-mute">
          {members.length === 1 ? "Just you so far" : `${members.length} people`} · you&apos;re {isOwner ? "an owner" : "a member"}
        </p>
        {isOwner ? (
          <Button variant="quiet" className="min-h-0! self-start px-0! py-1!" onClick={() => { setNewName(current.name); setRenaming(true); }}>
            Rename household
          </Button>
        ) : null}
      </header>

      {error ? <Notice>{error}</Notice> : null}

      <section aria-labelledby="people-h" className="flex flex-col gap-2.5">
        <h2 id="people-h" className="font-mono text-[11px] tracking-[0.1em] text-mute uppercase">People</h2>
        <ul className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-card">
          {members.map((m, i) => (
            <li key={m.userId} className="flex items-center gap-3 border-t border-line px-3.5 py-3 first:border-t-0">
              <Avatar name={m.displayName} index={i} size={36} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">
                  {m.displayName}
                  {m.userId === session.user.id ? <span className="font-normal text-mute"> (you)</span> : null}
                </p>
                <p className="text-xs text-mute">
                  {m.role === "owner" ? "Owner" : "Member"} · joined {formatDay(m.joinedAt)}
                </p>
              </div>
              {isOwner && m.userId !== session.user.id ? (
                <div className="flex flex-col items-end">
                  {m.role === "member" ? (
                    <Button variant="quiet" className="min-h-0! px-0! py-0.5! text-sm" busy={busy === `owner-${m.userId}`} onClick={() => makeOwner(m)}>
                      Make owner
                    </Button>
                  ) : null}
                  <Button variant="danger" className="min-h-0! px-0! py-0.5! text-sm" busy={busy === `remove-${m.userId}`} onClick={() => removeMember(m)}>
                    Remove
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      {isOwner ? (
        <section aria-labelledby="invite-h" className="flex flex-col gap-2.5">
          <h2 id="invite-h" className="font-mono text-[11px] tracking-[0.1em] text-mute uppercase">Invite someone</h2>
          {link ? (
            <div className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-line bg-card p-4">
              <p className="text-sm">Send this link to one person. It works once and expires in 7 days.</p>
              <code className="block rounded-lg bg-bg px-3 py-2 font-mono text-xs break-all text-mute select-all">{link}</code>
              <Button onClick={copyLink} className="w-full">
                {copied ? <><IconCheck /> Copied</> : <><IconCopy /> Share link</>}
              </Button>
            </div>
          ) : (
            <Button variant="ink" busy={busy === "invite"} onClick={createInvite} className="w-full">
              Create an invitation link
            </Button>
          )}
          {invites.length > 0 ? (
            <ul className="flex flex-col gap-1.5 text-sm">
              {invites.map((inv) => (
                <li key={inv.id} className="flex items-center justify-between gap-2 text-mute">
                  <span>Link made {formatDay(inv.created_at, { year: false })}, expires {formatDay(inv.expires_at, { year: false })}</span>
                  <Button variant="danger" className="min-h-0! px-0! py-0.5! text-sm" busy={busy === `revoke-${inv.id}`} onClick={() => revoke(inv.id)}>
                    Cancel
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      {all.length > 1 ? (
        <section aria-labelledby="switch-h" className="flex flex-col gap-2.5">
          <h2 id="switch-h" className="font-mono text-[11px] tracking-[0.1em] text-mute uppercase">Your households</h2>
          <div className="flex flex-wrap gap-2">
            {all.map((h) => (
              <button
                key={h.householdId}
                onClick={() => { rememberHousehold(h.householdId); router.replace("/"); }}
                className={`rounded-full border px-3.5 py-1.5 text-sm ${h.householdId === current.householdId ? "border-fg bg-fg text-bg" : "border-line bg-card"}`}
              >
                {h.name}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <div className="mt-auto flex flex-col gap-1 pt-6">
        <Button variant="ghost" busy={busy === "signout"} onClick={signOut} className="w-full">
          Sign out
        </Button>
        <Button variant="danger" onClick={() => setConfirmLeave(true)}>
          Leave this household
        </Button>
      </div>

      <Sheet open={renaming} onClose={() => setRenaming(false)} title="Rename household">
        <form onSubmit={rename} className="flex flex-col gap-4">
          <Field label="Household name" value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={80} required />
          <Button type="submit" busy={busy === "rename"} disabled={!newName.trim()} className="w-full">Save</Button>
        </form>
      </Sheet>

      <Sheet open={confirmLeave} onClose={() => setConfirmLeave(false)} title="Leave this household?">
        <p className="text-mute">
          {members.length === 1
            ? "You're the only member, so the household and everything in it will be deleted."
            : "You'll stop seeing its food. Someone can invite you back later."}
        </p>
        <Button variant="go" className="w-full bg-warn" busy={busy === "leave"} onClick={leave}>
          {members.length === 1 ? "Delete household" : "Leave household"}
        </Button>
        <Button variant="quiet" onClick={() => setConfirmLeave(false)}>Keep it</Button>
      </Sheet>
    </Screen>
  );
}
