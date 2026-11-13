"use client";

import { useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { friendlyError } from "@/lib/supabase/errors";

/** A list for someone without an account here, such as a child or a grandparent. */
export function NewListSheet({
  open,
  onClose,
  onAdd,
  books = false,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (name: string) => Promise<void>;
  books?: boolean;
}) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await onAdd(name.trim());
      setName("");
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="A list for someone else">
      <form onSubmit={save} className="flex flex-col gap-4">
        <p className="text-[15px] text-mute">
          For someone who doesn&apos;t use the app, such as a child. Everyone in your household can add {books ? "books" : "ideas"} to it and share it.
          People in your household already have a list each.
        </p>
        <Field label="Who's it for?" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Ollie" autoFocus required />
        {error ? <Notice>{error}</Notice> : null}
        <Button type="submit" busy={busy} disabled={!name.trim()} className="max-sm:w-full sm:self-start">
          Start the list
        </Button>
      </form>
    </Sheet>
  );
}
