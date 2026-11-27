"use client";

import { useEffect, useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { friendlyError } from "@/lib/supabase/errors";
import type { ListEntry } from "@/lib/domain/ownLists";

/**
 * Changing one thing on a list: its words (how many, too: "6 bottles of prosecco") and a note,
 * such as which shop or who it's for. Anyone who can see the list can change it, as with ticking.
 */
export function EntrySheet({
  entry,
  hint,
  onClose,
  onSave,
}: {
  entry: ListEntry | null;
  /** A word on what to write, for the kind of list (a Drinks list says how many). */
  hint?: string;
  onClose: () => void;
  onSave: (text: string, note: string | null) => Promise<void>;
}) {
  const [text, setText] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!entry) return;
    /* eslint-disable react-hooks/set-state-in-effect */
    setText(entry.text);
    setNote(entry.note ?? "");
    setError(null);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [entry]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await onSave(text.trim(), note.trim() || null);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={!!entry} onClose={onClose} title="Change it">
      <form onSubmit={save} className="flex flex-col gap-4">
        <Field label="What" value={text} onChange={(e) => setText(e.target.value)} maxLength={200} hint={hint} required />
        <Field label="Note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="Which shop, who it's for, anything" />
        {error ? <Notice>{error}</Notice> : null}
        <Button type="submit" busy={busy} disabled={!text.trim() || busy} className="max-sm:w-full sm:self-start">
          Save
        </Button>
      </form>
    </Sheet>
  );
}
