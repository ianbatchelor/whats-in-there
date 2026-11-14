"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { IconBasket, IconBook, IconBulb, IconCheck, IconChevronRight, IconGift, IconList } from "@/components/ui/icons";
import { addToList } from "@/lib/shopping";
import { addIdea, ensureList, loadPresents } from "@/lib/presents";
import { addEntry, loadLists } from "@/lib/ownLists";
import { loadStockLines } from "@/lib/stock";
import { haveAlready, haveLine, type StockLine } from "@/lib/domain/haveAlready";
import type { OwnList } from "@/lib/domain/ownLists";
import { friendlyError } from "@/lib/supabase/errors";
import { KEYS, readLocal, writeLocal } from "@/lib/storage";

/** Where the words typed go: the shopping list, your present ideas, or one of your own lists. */
type Target = { key: string; label: string; Icon: (p: { className?: string }) => React.ReactNode };

const KIND_ICON = { todo: IconList, ideas: IconBulb, buy: IconBasket } as const;
const looksLikeLink = (t: string) => /^https?:\/\//i.test(t.trim());

/**
 * Adding to a list from the Add button: type it, pick the list, done. The sheet stays open after
 * each one so a few can go on in a row.
 */
export function AddToListSheet({
  open,
  onClose,
  householdId,
  me,
  placeName,
  onAdded,
}: {
  open: boolean;
  onClose: () => void;
  householdId: string;
  me: string;
  placeName: (id: string) => string | undefined;
  onAdded: (message: string) => void;
}) {
  const [text, setText] = useState("");
  const [own, setOwn] = useState<OwnList[]>([]);
  const [stock, setStock] = useState<StockLine[]>([]);
  const [target, setTarget] = useState<string>(() => readLocal(KEYS.lastList) ?? "shopping");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    Promise.all([loadLists().catch(() => []), loadStockLines().catch(() => [])]).then(([lists, lines]) => {
      if (!active) return;
      setOwn(lists);
      setStock(lines);
    });
    return () => {
      active = false;
    };
  }, [open]);

  const targets: Target[] = useMemo(
    () => [
      { key: "shopping", label: "Shopping list", Icon: IconBasket },
      { key: "presents", label: "My present ideas", Icon: IconGift },
      ...own.map((l) => ({ key: `list:${l.id}`, label: l.title, Icon: KIND_ICON[l.kind] })),
    ],
    [own],
  );
  const chosen = targets.find((t) => t.key === target) ?? targets[0]!;
  const t = text.trim();
  // Before it goes on the shopping list: is there some at home already?
  const have = chosen.key === "shopping" && t.length >= 3 ? haveAlready(t, stock, placeName) : null;
  const link = chosen.key === "presents" && looksLikeLink(t);

  function close() {
    setText("");
    setAdded([]);
    setError(null);
    onClose();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!t || busy || link) return;
    setBusy(true);
    setError(null);
    try {
      if (chosen.key === "shopping") {
        const fresh = await addToList(householdId, { name: t });
        if (!fresh) {
          setError(`${t} is already on the shopping list.`);
          return;
        }
      } else if (chosen.key === "presents") {
        // Your own list is made the first time you add to it.
        const { lists } = await loadPresents(householdId);
        const list = lists.find((l) => l.forUser === me) ?? (await ensureList(householdId, me));
        await addIdea(householdId, list.id, { title: t, note: null, link: null, price: null, favourite: false });
      } else {
        await addEntry(chosen.key.slice("list:".length), t);
      }
      writeLocal(KEYS.lastList, chosen.key);
      setAdded((a) => [t, ...a].slice(0, 5));
      setText("");
      onAdded(`Added ${t} to ${chosen.key === "presents" ? "your present ideas" : chosen.label}`);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  const href = chosen.key === "shopping" ? "/list/" : chosen.key === "presents" ? `/presents/?for=${me}` : `/my-list/?id=${chosen.key.slice(5)}`;

  return (
    <Sheet open={open} onClose={close} title="Add to a list">
      <form onSubmit={submit} className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="add-list-text" className="font-display text-sm font-bold">
            What is it?
          </label>
          <input
            id="add-list-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={chosen.key === "shopping" ? "Milk, bin bags, birthday card…" : chosen.key === "presents" ? "Something you'd love" : "Something to add"}
            autoComplete="off"
            enterKeyHint="done"
            className="min-h-12 w-full rounded-2xl border border-line bg-card px-4 text-base placeholder:text-mute/80 focus:border-leaf focus:ring-4 focus:ring-leaf/15 focus:outline-none"
          />
          {have ? <p className="text-sm font-medium text-soon">{haveLine(have)}. Still add it?</p> : null}
          {link ? (
            <p className="text-sm text-mute">
              Shop links fill in the picture and price on{" "}
              <Link href={`/presents/?for=${me}`} className="font-semibold text-leaf">
                Present ideas
              </Link>
              . Paste it there.
            </p>
          ) : null}
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 font-display text-sm font-bold">Put it on</legend>
          <div className="flex flex-wrap gap-1.5">
            {targets.map(({ key, label, Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => setTarget(key)}
                aria-pressed={chosen.key === key}
                className={`flex min-h-10 max-w-full items-center gap-2 rounded-full border px-3.5 text-[14px] font-semibold transition ${
                  chosen.key === key ? "border-go bg-go text-on-go" : "border-line bg-card text-fg hover:bg-sunk"
                }`}
              >
                <Icon className="size-4 shrink-0" />
                <span className="truncate">{label}</span>
              </button>
            ))}
          </div>
          <Link href="/books/" className="flex min-h-10 items-center gap-2 self-start text-[14px] font-semibold text-leaf">
            <IconBook className="size-4" /> A book to read? Use Book wish lists
            <IconChevronRight className="size-3.5" />
          </Link>
        </fieldset>

        {error ? <Notice>{error}</Notice> : null}

        {added.length > 0 ? (
          <div className="flex items-start justify-between gap-3 rounded-2xl bg-ok-bg px-4 py-3 text-[14px] text-ok">
            <span className="flex min-w-0 items-start gap-2">
              <IconCheck className="mt-0.5 size-4 shrink-0" />
              <span className="min-w-0">Added {added.join(", ")}. Add another, or close.</span>
            </span>
            <Link href={href} className="shrink-0 font-semibold underline underline-offset-2">
              See list
            </Link>
          </div>
        ) : null}

        <Button type="submit" busy={busy} disabled={!t || link}>
          Add to {chosen.key === "presents" ? "my present ideas" : chosen.label}
        </Button>
      </form>
    </Sheet>
  );
}
