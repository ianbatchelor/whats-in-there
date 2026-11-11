"use client";

import { useEffect, useState } from "react";
import type { StockItem } from "@/lib/domain/stock";
import { lendItem, loadLendNames } from "@/lib/stock";
import { friendlyError } from "@/lib/supabase/errors";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";

/** "Who's borrowing it?" A name, with the people things went to before offered as one tap. */
export function LendForm({ item, onLent, onCancel }: { item: StockItem; onLent: (after: StockItem, to: string) => void; onCancel: () => void }) {
  const [name, setName] = useState("");
  const [recent, setRecent] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    loadLendNames().then((n) => active && setRecent(n));
    return () => {
      active = false;
    };
  }, []);

  async function lend(to: string) {
    const who = to.trim().replace(/\s+/g, " ");
    if (!who) return setError("Add who's borrowing it.");
    setError(null);
    setBusy(true);
    try {
      onLent(await lendItem(item, who), who);
    } catch (e) {
      setError(friendlyError(e));
      setBusy(false);
    }
  }

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        lend(name);
      }}
    >
      <Field label="Who's borrowing it?" placeholder="Mum, Sam next door…" value={name} maxLength={60} autoFocus onChange={(e) => setName(e.target.value)} autoComplete="off" />
      {recent.length > 0 ? (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Lent to before">
          {recent.map((n) => (
            <button
              key={n}
              type="button"
              disabled={busy}
              onClick={() => lend(n)}
              className="min-h-9 rounded-full bg-sunk px-3.5 text-[13px] font-semibold text-fg/85 transition hover:text-fg disabled:opacity-50"
            >
              {n}
            </button>
          ))}
        </div>
      ) : null}
      {error ? <Notice>{error}</Notice> : null}
      <div className="flex gap-2">
        <Button type="submit" className="flex-1" busy={busy}>
          Lend it
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
      </div>
      <p className="text-xs text-mute">It stays on the list here, marked as with them, until you say it&apos;s back.</p>
    </form>
  );
}
