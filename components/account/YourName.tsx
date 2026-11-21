"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";
import { friendlyError } from "@/lib/supabase/errors";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { Sheet } from "@/components/ui/Sheet";
import { looksLikeEmailName } from "@/lib/domain/names";

/**
 * The name other people see for you ("You, Michele and Carol"). People who signed in with an email
 * code before choosing a name get the start of their email address, so this lets them change it,
 * and nudges them when it still looks like one.
 */
export function YourName({ session, onSaved }: { session: Session; onSaved?: () => void }) {
  const [name, setName] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase()
      .from("profiles")
      .select("display_name")
      .eq("user_id", session.user.id)
      .maybeSingle()
      .then(({ data }) => setName((data?.display_name as string | undefined) ?? null));
  }, [session.user.id]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const next = draft.trim().slice(0, 60);
    if (!next) return;
    setBusy(true);
    setError(null);
    const { error: err } = await supabase().from("profiles").update({ display_name: next }).eq("user_id", session.user.id);
    setBusy(false);
    if (err) return setError(friendlyError(err));
    setName(next);
    setEditing(false);
    onSaved?.();
  }

  if (name === null) return null;
  const nudge = looksLikeEmailName(name, session.user.email);

  return (
    <>
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate font-display font-bold">{name}</p>
          <p className="text-xs text-mute">{nudge ? "This came from your email. Others see it, so add your real name." : "The name others see"}</p>
        </div>
        <Button variant="ghost" className="min-h-10! shrink-0 px-4!" onClick={() => { setDraft(nudge ? "" : name); setError(null); setEditing(true); }}>
          {nudge ? "Add name" : "Change"}
        </Button>
      </div>
      <Sheet open={editing} onClose={() => setEditing(false)} title="Your name">
        <form onSubmit={save} className="flex flex-col gap-4">
          <Field label="Your first name" hint="People at home and family see this." value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={60} autoComplete="given-name" required />
          {error ? <Notice>{error}</Notice> : null}
          <Button type="submit" busy={busy} disabled={!draft.trim()} className="w-full">Save</Button>
        </form>
      </Sheet>
    </>
  );
}
