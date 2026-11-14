"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import { AuthGate } from "@/components/AuthGate";
import { supabase } from "@/lib/supabase/client";
import { friendlyError } from "@/lib/supabase/errors";
import { publicOrigin } from "@/lib/config";
import { buildInviteUrl } from "@/lib/domain/invite";
import { formatDay } from "@/lib/domain/dates";
import { familiesOf, homesOf, loadMembers, loadMemberships, pickCurrent, rememberHousehold, type Member, type Membership, type Role } from "@/lib/household";
import { KEYS, writeLocal } from "@/lib/storage";
import { Splash } from "@/components/ui/Screen";
import { AppShell, SectionLabel } from "@/components/AppShell";
import { PageHeader } from "@/components/common/PageHeader";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { Field } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Sheet";
import { IconCheck, IconChevronRight, IconCopy, IconMore } from "@/components/ui/icons";
import Link from "next/link";
import { DeleteAccountSheet } from "@/components/account/DeleteAccountSheet";
import { LegalLinks } from "@/components/common/LegalLinks";

type Invite = { id: string; expires_at: string; created_at: string; role: Role };

export default function HouseholdPage() {
  return <AuthGate>{(session) => <Household session={session} />}</AuthGate>;
}

function Household({ session }: { session: Session }) {
  const router = useRouter();
  const [all, setAll] = useState<Membership[]>([]);
  const [current, setCurrent] = useState<Membership | null>(null);
  /** True once memberships have loaded (someone who's only family elsewhere has no current household). */
  const [loaded, setLoaded] = useState(false);
  /** Choosing who to invite: someone who lives here, or family with their own home. */
  const [inviting, setInviting] = useState(false);
  const [inviteKind, setInviteKind] = useState<"member" | "family">("family");
  const [linkKind, setLinkKind] = useState<"member" | "family">("member");
  /** The family you're about to leave. */
  const [leavingFamily, setLeavingFamily] = useState<Membership | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  /** The person whose options are open, and whether we're asking "are you sure?" about removing them. */
  const [managing, setManaging] = useState<{ member: Member; confirm: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState("");
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isOwner = current?.role === "owner";

  const load = useCallback(async () => {
    const memberships = await loadMemberships(session.user.id);
    setAll(memberships);
    const chosen = pickCurrent(memberships);
    if (!chosen && familiesOf(memberships).length === 0) return router.replace("/welcome/");
    setCurrent(chosen);
    setLoaded(true);
    if (!chosen) return;
    setMembers(await loadMembers(chosen.householdId));
    if (chosen.role === "owner") {
      const { data } = await supabase()
        .from("household_invitations")
        .select("id, expires_at, created_at, role")
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
      const { data, error } = await supabase().rpc("create_invitation", { p_household: current!.householdId, p_role: inviteKind });
      if (error) throw error;
      const row = (data as { token: string }[])[0]!;
      setLink(buildInviteUrl(publicOrigin(), row.token));
      setLinkKind(inviteKind);
      setCopied(false);
      setInviting(false);
      await load();
    });

  const setRole = (m: Member, role: Role) =>
    run(`role-${m.userId}`, async () => {
      const { error } = await supabase().rpc("set_member_role", { p_household: current!.householdId, p_user: m.userId, p_role: role });
      if (error) throw error;
      setManaging(null);
      await load();
    });

  const leaveFamily = (f: Membership) =>
    run(`leave-${f.householdId}`, async () => {
      const { error } = await supabase().rpc("leave_household", { p_household: f.householdId });
      if (error) throw error;
      setLeavingFamily(null);
      await load();
    });

  async function copyLink() {
    if (!link) return;
    try {
      if (navigator.share) {
        await navigator.share({
          title: linkKind === "family" ? `Join ${current?.name} as family on See What's in Here` : `Join ${current?.name} on See What's in Here`,
          url: link,
        });
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
      setManaging(null);
      await load();
    });

  const makeOwner = (m: Member) =>
    run(`owner-${m.userId}`, async () => {
      const { error } = await supabase().rpc("set_member_role", { p_household: current!.householdId, p_user: m.userId, p_role: "owner" });
      if (error) throw error;
      setManaging(null);
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

  const homes = homesOf(all);
  const families = familiesOf(all);
  const atHome = members.filter((m) => m.role !== "family");
  const family = members.filter((m) => m.role === "family");

  const familySection =
    families.length > 0 ? (
      <section aria-labelledby="families-h" className="flex flex-col gap-2.5">
        <SectionLabel id="families-h">Family you&apos;re part of</SectionLabel>
        <ul className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-card shadow-[var(--shadow-card)]">
          {families.map((f) => (
            <li key={f.householdId} className="flex items-center gap-3 border-t border-line px-3.5 py-3 first:border-t-0">
              <div className="min-w-0 flex-1">
                <p className="truncate font-display font-bold">{f.name}</p>
                <p className="text-xs text-mute">Presents and Christmas only. They don&apos;t see your home.</p>
              </div>
              <Link href="/presents/" className="shrink-0 px-2 text-sm font-semibold text-leaf">
                Presents
              </Link>
              <button
                onClick={() => setLeavingFamily(f)}
                aria-label={`Leave ${f.name}`}
                className="grid size-11 shrink-0 place-items-center rounded-full text-mute transition hover:bg-sunk hover:text-fg"
              >
                <IconMore className="size-5" />
              </button>
            </li>
          ))}
        </ul>
      </section>
    ) : null;

  const leaveFamilySheet = (
    <Sheet open={leavingFamily !== null} onClose={() => setLeavingFamily(null)} title={`Leave ${leavingFamily?.name ?? ""}?`}>
      <p className="text-mute">You&apos;ll stop seeing their present lists, and your own list there goes too. They can invite you back any time.</p>
      {error ? <Notice>{error}</Notice> : null}
      <Button variant="go" className="w-full bg-warn" busy={busy === `leave-${leavingFamily?.householdId}`} onClick={() => leavingFamily && leaveFamily(leavingFamily)}>
        Leave
      </Button>
      <Button variant="quiet" onClick={() => setLeavingFamily(null)}>Stay</Button>
    </Sheet>
  );

  if (!current) {
    if (!loaded) return error ? <AppShell><Notice>{error}</Notice></AppShell> : <Splash />;
    // Family elsewhere, with no home of their own here (yet).
    return (
      <AppShell>
        <PageHeader title="You" sub="You're here as family. Set up a household any time to keep track of your own home." />
        {error ? <Notice>{error}</Notice> : null}
        {familySection}
        <Button variant="ghost" onClick={() => router.push("/welcome/")} className="w-full">
          Set up my own household
        </Button>
        <div className="flex flex-col gap-8 border-t border-line pt-6">
          <Button variant="ghost" busy={busy === "signout"} onClick={signOut} className="w-full">
            Sign out
          </Button>
        </div>
        <section aria-labelledby="account-h" className="flex flex-col gap-2.5">
          <SectionLabel id="account-h">Your account</SectionLabel>
          <div className="flex flex-col gap-1 rounded-[var(--radius-card)] border border-line bg-card px-3.5 py-3 shadow-[var(--shadow-card)]">
            <p className="truncate text-sm text-mute">Signed in as {session.user.email}</p>
            <Button variant="danger" className="min-h-10 self-start px-0! text-[13.5px] font-semibold" onClick={() => setDeleting(true)}>
              Delete my account
            </Button>
          </div>
          <LegalLinks className="justify-center pt-2" />
        </section>
        <DeleteAccountSheet open={deleting} onClose={() => setDeleting(false)} session={session} />
        {leaveFamilySheet}
      </AppShell>
    );
  }

  const personRow = (m: Member, i: number) => (
    <li key={m.userId} className="flex items-center gap-3 border-t border-line px-3.5 py-3 first:border-t-0">
      <Avatar name={m.displayName} index={i} size={36} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-display font-bold">
          {m.displayName}
          {m.userId === session.user.id ? <span className="font-normal text-mute"> (you)</span> : null}
        </p>
        <p className="text-xs text-mute">
          {roleLabel(m.role)} · joined {formatDay(m.joinedAt)}
        </p>
      </div>
      {isOwner && m.userId !== session.user.id ? (
        <button
          onClick={() => setManaging({ member: m, confirm: false })}
          aria-label={`Options for ${m.displayName}`}
          className="grid size-11 shrink-0 place-items-center rounded-full text-mute transition hover:bg-sunk hover:text-fg"
        >
          <IconMore className="size-5" />
        </button>
      ) : null}
    </li>
  );

  return (
    <AppShell>
      <PageHeader
        title={current.name}
        sub={<>{atHome.length === 1 ? "Just you at home" : `${atHome.length} people at home`}{family.length ? ` and ${family.length} family` : ""} · you&apos;re {isOwner ? "an owner" : "a member"}</>}
        action={
          isOwner ? (
            <Button variant="ghost" className="min-h-10! px-4!" onClick={() => { setNewName(current.name); setRenaming(true); }}>
              Rename
            </Button>
          ) : null
        }
      />

      {error ? <Notice>{error}</Notice> : null}

      <Link
        href="/help/"
        className="flex min-h-12 items-center gap-3 rounded-2xl border border-line bg-card px-4 text-[14.5px] transition hover:bg-sunk/50"
      >
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-sunk font-display text-[14px] font-bold text-leaf" aria-hidden="true">
          ?
        </span>
        <span className="min-w-0 flex-1">
          <b className="font-semibold">Help</b>
          <span className="text-mute"> · how everything works, and how to reach us</span>
        </span>
        <IconChevronRight className="size-4 shrink-0 text-mute/70" />
      </Link>

      <section aria-labelledby="people-h" className="flex flex-col gap-2.5">
        <SectionLabel id="people-h">At home · sees everything</SectionLabel>
        <ul className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-card shadow-[var(--shadow-card)]">
          {atHome.map(personRow)}
        </ul>
      </section>

      {family.length > 0 ? (
        <section aria-labelledby="family-h" className="flex flex-col gap-2.5">
          <SectionLabel id="family-h">Family · presents and Christmas</SectionLabel>
          <ul className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-card shadow-[var(--shadow-card)]">
            {family.map((m, i) => personRow(m, atHome.length + i))}
          </ul>
          <p className="px-1 text-[13.5px] leading-snug text-mute">
            Family see everyone&apos;s present lists and can say what they&apos;re getting. They don&apos;t see your places, shopping list or anything else.
          </p>
        </section>
      ) : null}

      {isOwner ? (
        <section aria-labelledby="invite-h" className="flex flex-col gap-2.5">
          <SectionLabel id="invite-h">Invite someone</SectionLabel>
          {link ? (
            <div className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-line bg-card p-4 shadow-[var(--shadow-card)]">
              <p className="text-sm">
                {linkKind === "family"
                  ? "Send this link to one family member. They'll see the present lists, nothing else. It works once and expires in 7 days."
                  : "Send this link to one person who lives here. It works once and expires in 7 days."}
              </p>
              <code className="block rounded-xl bg-sunk px-3 py-2 font-mono text-xs break-all text-mute select-all">{link}</code>
              <Button onClick={copyLink} className="w-full">
                {copied ? <><IconCheck /> Copied</> : <><IconCopy /> Share link</>}
              </Button>
            </div>
          ) : (
            <Button onClick={() => setInviting(true)} className="w-full">
              Invite someone
            </Button>
          )}
          {invites.length > 0 ? (
            <ul className="flex flex-col gap-1.5 text-sm">
              {invites.map((inv) => (
                <li key={inv.id} className="flex items-center justify-between gap-2 text-mute">
                  <span>
                    {inv.role === "family" ? "Family link" : "Link"} made {formatDay(inv.created_at, { year: false })}, expires {formatDay(inv.expires_at, { year: false })}
                  </span>
                  <Button variant="danger" className="min-h-0! px-0! py-0.5! text-sm" busy={busy === `revoke-${inv.id}`} onClick={() => revoke(inv.id)}>
                    Cancel
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      {familySection}

      {homes.length > 1 ? (
        <section aria-labelledby="switch-h" className="flex flex-col gap-2.5">
          <SectionLabel id="switch-h">Your households</SectionLabel>
          <div className="flex flex-wrap gap-2">
            {homes.map((h) => (
              <button
                key={h.householdId}
                onClick={() => { rememberHousehold(h.householdId); router.replace("/"); }}
                className={`rounded-full border px-3.5 py-1.5 text-sm ${h.householdId === current.householdId ? "border-go bg-go text-on-go" : "border-line bg-card"}`}
              >
                {h.name}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <div className="flex flex-col gap-8 border-t border-line pt-6">
        <Button variant="ghost" busy={busy === "signout"} onClick={signOut} className="w-full">
          Sign out
        </Button>
        <Button variant="danger" className="min-h-10 self-center text-[13.5px] font-semibold" onClick={() => setConfirmLeave(true)}>
          Leave this household
        </Button>
      </div>

      <section aria-labelledby="account-h" className="flex flex-col gap-2.5">
        <SectionLabel id="account-h">Your account</SectionLabel>
        <div className="flex flex-col gap-1 rounded-[var(--radius-card)] border border-line bg-card px-3.5 py-3 shadow-[var(--shadow-card)]">
          <p className="truncate text-sm text-mute">Signed in as {session.user.email}</p>
          <Button variant="danger" className="min-h-10 self-start px-0! text-[13.5px] font-semibold" onClick={() => setDeleting(true)}>
            Delete my account
          </Button>
        </div>
        <LegalLinks className="justify-center pt-2" />
      </section>

      <DeleteAccountSheet open={deleting} onClose={() => setDeleting(false)} session={session} />

      <Sheet open={renaming} onClose={() => setRenaming(false)} title="Rename household">
        <form onSubmit={rename} className="flex flex-col gap-4">
          <Field label="Household name" value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={80} required />
          <Button type="submit" busy={busy === "rename"} disabled={!newName.trim()} className="w-full">Save</Button>
        </form>
      </Sheet>

      <Sheet open={confirmLeave} onClose={() => setConfirmLeave(false)} title="Leave this household?">
        <p className="text-mute">
          {atHome.length === 1
            ? family.length
              ? "You're the only one living here, so the household and everything in it will be deleted, and family lose its present lists."
              : "You're the only member, so the household and everything in it will be deleted."
            : "You'll stop seeing its places and everything in them. Someone can invite you back later."}
        </p>
        <Button variant="go" className="w-full bg-warn" busy={busy === "leave"} onClick={leave}>
          {atHome.length === 1 ? "Delete household" : "Leave household"}
        </Button>
        <Button variant="quiet" onClick={() => setConfirmLeave(false)}>Keep it</Button>
      </Sheet>
      <Sheet open={managing !== null} onClose={() => setManaging(null)} title={managing?.member.displayName ?? ""}>
        {managing ? (
          managing.confirm ? (
            <div className="flex flex-col gap-4">
              <p>
                Remove <b>{managing.member.displayName}</b> from {current.name}?{" "}
                {managing.member.role === "family"
                  ? "They'll stop seeing the present lists straight away, and their own list here goes too."
                  : "They'll stop seeing its places straight away. Things they added stay here."}{" "}
                You can invite them back any time.
              </p>
              {error ? <Notice>{error}</Notice> : null}
              <div className="flex gap-2">
                <Button
                  variant="danger"
                  className="flex-1 border border-warn/40"
                  busy={busy === `remove-${managing.member.userId}`}
                  onClick={() => removeMember(managing.member)}
                >
                  Remove {managing.member.displayName}
                </Button>
                <Button variant="ghost" onClick={() => setManaging({ ...managing, confirm: false })}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-mute">
                {roleLabel(managing.member.role)} · joined {formatDay(managing.member.joinedAt)}
              </p>
              {managing.member.role === "member" ? (
                <>
                  <Button variant="ghost" className="justify-start" busy={busy === `owner-${managing.member.userId}`} onClick={() => makeOwner(managing.member)}>
                    Make an owner
                    <span className="ml-auto text-sm font-normal text-mute">Can invite and remove people</span>
                  </Button>
                  <Button variant="ghost" className="justify-start" busy={busy === `role-${managing.member.userId}`} onClick={() => setRole(managing.member, "family")}>
                    Family only
                    <span className="ml-auto text-sm font-normal text-mute">Moved out: presents, nothing else</span>
                  </Button>
                </>
              ) : managing.member.role === "family" ? (
                <Button variant="ghost" className="justify-start" busy={busy === `role-${managing.member.userId}`} onClick={() => setRole(managing.member, "member")}>
                  Lives here now
                  <span className="ml-auto text-sm font-normal text-mute">Sees every place and list</span>
                </Button>
              ) : null}
              <Button variant="ghost" className="justify-start text-warn" onClick={() => setManaging({ ...managing, confirm: true })}>
                {managing.member.role === "family" ? "Remove from the family…" : "Remove from household…"}
              </Button>
              {error ? <Notice>{error}</Notice> : null}
            </div>
          )
        ) : null}
      </Sheet>
      <Sheet open={inviting} onClose={() => setInviting(false)} title="Invite someone">
        <p className="-mt-2 text-mute">How do they fit in?</p>
        <div role="radiogroup" aria-label="Who are you inviting" className="flex flex-col gap-2.5">
          {(
            [
              ["member", "They live here", "Everything: every place, list and the shopping."],
              ["family", "Family with their own home", "Presents and Christmas only. They won't see your places or anything else."],
            ] as const
          ).map(([kind, title, detail]) => (
            <button
              key={kind}
              role="radio"
              aria-checked={inviteKind === kind}
              onClick={() => setInviteKind(kind)}
              className={`flex items-center gap-3 rounded-2xl border-[1.5px] px-4 py-3 text-left transition ${inviteKind === kind ? "border-go bg-ice" : "border-line bg-card"}`}
            >
              <span className="min-w-0 flex-1">
                <b className="block font-display text-[16px]">{title}</b>
                <span className="text-[13.5px] text-mute">{detail}</span>
              </span>
              <span className={`size-[22px] shrink-0 rounded-full border-2 ${inviteKind === kind ? "border-[7px] border-go" : "border-line"}`} aria-hidden="true" />
            </button>
          ))}
        </div>
        {error ? <Notice>{error}</Notice> : null}
        <Button busy={busy === "invite"} onClick={createInvite} className="w-full">
          Make an invite link
        </Button>
      </Sheet>
      {leaveFamilySheet}
    </AppShell>
  );
}

function roleLabel(role: Role): string {
  return role === "owner" ? "Owner" : role === "family" ? "Family" : "Member";
}
