"use client";

import { useEffect, useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { IconGift, IconHouse, IconLock, IconPeople } from "@/components/ui/icons";
import { friendlyError } from "@/lib/supabase/errors";
import { KINDS, type ListKind, type ListVisibility, type OwnList } from "@/lib/domain/ownLists";
import type { ListSettings } from "@/lib/ownLists";

type Option = { value: ListVisibility; title: string; body: string; Icon: (p: { className?: string }) => React.ReactNode; group?: boolean };

/**
 * Making a list, or changing one you made: its name, what kind it is and who can see it.
 * With a list, it edits that list and offers to delete it.
 */
export function ListSettingsSheet({
  open,
  onClose,
  householdId,
  householdName,
  others,
  family = [],
  list,
  onSave,
  onDelete,
}: {
  open: boolean;
  onClose: () => void;
  /** Null for someone with no household of their own: then there's no "everyone at home" choice. */
  householdId: string | null;
  householdName: string | null;
  /** First names of the other people at home, for "You, Michele and…". */
  others: string[];
  /** First names of family with their own homes (presents only), for "…plus Molly and Carol". */
  family?: string[];
  list?: OwnList | null;
  onSave: (s: ListSettings) => Promise<void>;
  onDelete?: () => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<ListKind>("todo");
  const [visibility, setVisibility] = useState<ListVisibility>("me");
  const [busy, setBusy] = useState<"save" | "delete" | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Start from the list's own settings each time the sheet opens.
  useEffect(() => {
    if (!open) return;
    /* eslint-disable react-hooks/set-state-in-effect */
    setTitle(list?.title ?? "");
    setKind(list?.kind ?? "todo");
    setVisibility(list?.visibility ?? "me");
    setConfirming(false);
    setError(null);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [open, list]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy("save");
    setError(null);
    try {
      await onSave({ title, kind, visibility, householdId });
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    if (!onDelete) return;
    setBusy("delete");
    setError(null);
    try {
      await onDelete();
    } catch (err) {
      setError(friendlyError(err));
      setBusy(null);
    }
  }

  const home = others.length === 0 ? "You and anyone who joins your household." : `You, ${joinNames(others)}.`;
  const options: Option[] = [
    { value: "me", title: "Just me", body: householdId ? "Nobody else sees it, not even people at home." : "Nobody else sees it.", Icon: IconLock },
    ...(householdId ? [{ value: "household" as const, title: `Everyone in ${householdName ?? "your household"}`, body: home, Icon: IconHouse }] : []),
    ...(householdId
      ? [
          {
            value: "family" as const,
            title: "Everyone at home and family",
            body:
              family.length > 0
                ? `Plus ${joinNames(family)}, who have their own homes. They see this list only.`
                : "Plus family with their own homes, once you add them on the Household page. They see this list only.",
            Icon: IconGift,
          },
        ]
      : []),
    {
      value: "group",
      title: "A group I invite",
      body: "Friends or family elsewhere join with a link. They see this list only, never your home.",
      Icon: IconPeople,
      group: true,
    },
  ];

  return (
    <Sheet open={open} onClose={onClose} title={list ? "List settings" : "New list"}>
      <form onSubmit={save} className="flex flex-col gap-4">
        <Field
          label="Name"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={60}
          placeholder="Christmas ideas, Jobs before the visit…"
          autoFocus={!list}
          required
        />

        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1.5 font-display text-sm font-bold">Kind of list</legend>
          <div className="flex gap-1 rounded-xl bg-sunk p-1">
            {KINDS.map((k) => (
              <label
                key={k.kind}
                className={`flex min-h-10 flex-1 cursor-pointer items-center justify-center rounded-[9px] px-2 text-center text-[14px] font-semibold transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-leaf/50 ${kind === k.kind ? "bg-card text-fg shadow-[0_1px_2px_rgba(0,0,0,0.08)]" : "text-mute"}`}
              >
                <input type="radio" name="list-kind" value={k.kind} checked={kind === k.kind} onChange={() => setKind(k.kind)} className="sr-only" />
                {k.label}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 font-display text-sm font-bold">Who can see it?</legend>
          {options.map((o) => {
            const on = visibility === o.value;
            return (
              <label
                key={o.value}
                className={`flex cursor-pointer items-start gap-3 rounded-2xl border-[1.5px] p-3 transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-leaf/50 ${on ? "border-go bg-ok-bg/50" : "border-line bg-card"}`}
              >
                <input type="radio" name="list-visibility" value={o.value} checked={on} onChange={() => setVisibility(o.value)} className="sr-only" />
                <span
                  className={`grid size-10 shrink-0 place-items-center rounded-xl ${o.group ? "bg-plum-bg text-plum" : "bg-sunk text-leaf"}`}
                  aria-hidden="true"
                >
                  <o.Icon className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-display text-[15.5px] font-bold">{o.title}</span>
                  <span className="block text-[14px] leading-snug text-mute">{o.body}</span>
                </span>
                <span
                  aria-hidden="true"
                  className={`mt-2 size-[22px] shrink-0 rounded-full border-2 transition-all ${on ? "border-[7px] border-go" : "border-line"}`}
                />
              </label>
            );
          })}
          {list && stopping(list.visibility, visibility) ? (
            <p className="text-[13.5px] text-mute">{stopping(list.visibility, visibility)} will stop seeing it straight away, including anything they added.</p>
          ) : null}
        </fieldset>

        {error ? <Notice>{error}</Notice> : null}
        <Button type="submit" busy={busy === "save"} disabled={!title.trim() || busy !== null} className="max-sm:w-full sm:self-start">
          {list ? "Save" : "Make the list"}
        </Button>

        {list && onDelete ? (
          confirming ? (
            <div className="flex flex-col gap-2 rounded-2xl border border-warn/40 bg-warn/5 p-3">
              <p className="text-[14px]">Delete “{list.title}” and everything on it? This can&apos;t be undone.</p>
              <div className="flex gap-2">
                <Button type="button" variant="ghost" onClick={() => setConfirming(false)} className="flex-1">
                  Keep it
                </Button>
                <Button type="button" onClick={remove} busy={busy === "delete"} className="flex-1 bg-warn! text-white!">
                  Delete
                </Button>
              </div>
            </div>
          ) : (
            <Button type="button" variant="danger" onClick={() => setConfirming(true)} className="self-start px-0">
              Delete this list
            </Button>
          )
        ) : null}
      </form>
    </Sheet>
  );
}

/** Who loses sight of a list when it changes from one choice to another, or null if nobody does. */
export function stopping(from: ListVisibility, to: ListVisibility): string | null {
  if (from === to || from === "me") return null;
  if (from === "group") return "The group";
  if (from === "family") return to === "household" ? "Family" : "Everyone at home and family";
  return to === "family" ? null : "Everyone at home";
}

/** "Michele", "Michele and Carol", "Michele, Carol and Ollie". */
export function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}
