"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Session } from "@supabase/supabase-js";
import { AuthGate } from "@/components/AuthGate";
import { AppShell, SectionLabel } from "@/components/AppShell";
import { PageHeader } from "@/components/common/PageHeader";
import { useHousehold } from "@/lib/hooks/useHousehold";
import { friendlyError } from "@/lib/supabase/errors";
import { searchItems } from "@/lib/stock";
import { countThings } from "@/lib/domain/places";
import type { StockItem } from "@/lib/domain/stock";
import { formatQuantity } from "@/lib/domain/quantity";
import { Notice } from "@/components/ui/Notice";
import { Toast } from "@/components/ui/Toast";
import { IconChevronRight, IconScan, IconSearch, IconX } from "@/components/ui/icons";
import { KEYS, readLocal, writeLocal } from "@/lib/storage";
import { useQuickTake } from "@/components/stock/useQuickTake";
import { placeType } from "@/components/home/placeTypes";
import { PlacePhoto } from "@/components/art/PlacePhoto";
import { ItemList, ItemListSkeleton, ItemRow } from "@/components/stock/ItemRow";
import { TakeOutSheet } from "@/components/stock/TakeOutSheet";
import { useUndoToast } from "@/components/stock/useUndoToast";

function readSearches(): string[] {
  try {
    const raw = JSON.parse(readLocal(KEYS.searches) ?? "[]");
    return Array.isArray(raw) ? raw.filter((r): r is string => typeof r === "string").slice(0, 6) : [];
  } catch {
    return [];
  }
}

export default function SearchPage() {
  return <AuthGate>{(session) => <Search session={session} />}</AuthGate>;
}

function Search({ session }: { session: Session }) {
  const {
    current,
    places,
    placeById,
    names,
    error,
    setError,
    version,
    refresh,
  } = useHousehold(session);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<StockItem[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<StockItem | null>(null);
  const q = query.trim();

  useEffect(() => {
    if (!current || q.length < 2) return;
    let active = true;
    const t = setTimeout(async () => {
      setBusy(true);
      try {
        const found = await searchItems(current.householdId, q);
        if (active) setResults(found);
      } catch (e) {
        if (active) setError(friendlyError(e));
      } finally {
        if (active) setBusy(false);
      }
    }, 220);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [current, q, version, setError]);

  const matchingPlaces = useMemo(() => {
    if (q.length < 2 || !places) return [];
    const lower = q.toLowerCase();
    return places.filter(
      (p) =>
        p.name.toLowerCase().includes(lower) ||
        placeType(p.type).label.toLowerCase().includes(lower),
    );
  }, [places, q]);

  const { toast, clear, announce } = useUndoToast(() => {
    refresh();
  });

  const shown = q.length >= 2 ? results : null;
  const { taking, takeOne } = useQuickTake(announce, refresh);
  const [recent, setRecent] = useState<string[]>([]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRecent(readSearches());
  }, []);
  /** A search is worth remembering once it led somewhere. */
  const remember = () => {
    if (q.length < 2) return;
    const next = [q, ...recent.filter((r) => r.toLowerCase() !== q.toLowerCase())].slice(0, 6);
    setRecent(next);
    writeLocal(KEYS.searches, JSON.stringify(next));
  };

  return (
    <AppShell>
      <PageHeader title="Search" sub="Everything you have, in every place." />
      <label className="sticky top-[max(8px,env(safe-area-inset-top))] z-20 flex min-h-13 items-center gap-3 rounded-xl border border-line bg-card px-4 shadow-[var(--shadow-lift)] focus-within:border-leaf">
        <IconSearch className="size-5 shrink-0 text-mute" />
        <input
          type="search"
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Try passport or curry"
          aria-label="Search everything"
          className="min-w-0 flex-1 bg-transparent text-[17px] placeholder:text-mute focus:outline-none focus-visible:outline-none [&::-webkit-search-cancel-button]:hidden"
        />
        {query && !busy ? (
          <button type="button" onClick={() => setQuery("")} aria-label="Clear search" className="-mr-2 grid size-9 shrink-0 place-items-center rounded-full text-mute hover:bg-sunk hover:text-fg">
            <IconX className="size-4" />
          </button>
        ) : null}
        {!query ? (
          <Link href="/add/" aria-label="Scan a label" title="Scan a label" className="-mr-2 grid size-10 shrink-0 place-items-center rounded-lg text-leaf hover:bg-sunk">
            <IconScan className="size-5" />
          </Link>
        ) : null}
        {busy ? (
          <span
            className="size-4 animate-spin rounded-full border-2 border-leaf border-r-transparent"
            role="status"
            aria-label="Searching"
          />
        ) : null}
      </label>

      {error ? <Notice>{error}</Notice> : null}

      {q.length < 2 ? (
        <div className="flex flex-col gap-6">
          {recent.length > 0 ? (
            <section className="flex flex-col gap-2.5" aria-labelledby="recent-h">
              <SectionLabel id="recent-h">Recent searches</SectionLabel>
              <div className="flex flex-wrap gap-1.5">
                {recent.map((r) => (
                  <button key={r} onClick={() => setQuery(r)} className="min-h-9 rounded-full border border-line bg-card px-3.5 text-[14px] font-medium hover:bg-sunk">
                    {r}
                  </button>
                ))}
              </div>
            </section>
          ) : (
            <p className="text-mute">Type a name, a brand or a place. Each result shows where the thing is.</p>
          )}
          {places && places.length > 0 ? (
            <section className="flex flex-col gap-2.5" aria-labelledby="browse-h">
              <SectionLabel id="browse-h">Or look in a place</SectionLabel>
              <div className="flex flex-wrap gap-1.5">
                {places.map((p) => (
                  <Link key={p.id} href={`/place/?id=${p.id}`} className="flex min-h-9 items-center gap-2 rounded-full border border-line bg-card py-1 pr-3.5 pl-1 text-[14px] font-medium hover:bg-sunk">
                    <span className="size-7 overflow-hidden rounded-full">
                      <PlacePhoto type={p.type} imagePath={p.imagePath} />
                    </span>
                    {p.name}
                  </Link>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-col gap-6" aria-live="polite">
          {matchingPlaces.length > 0 ? (
            <section className="flex flex-col gap-2.5" aria-labelledby="sp-h">
              <SectionLabel id="sp-h">Places</SectionLabel>
              <ul className="flex flex-col gap-2">
                {matchingPlaces.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/place/?id=${p.id}`}
                      onClick={remember}
                      className="lift flex items-center gap-3 overflow-hidden rounded-2xl border border-line bg-card pr-3 shadow-[var(--shadow-card)]"
                    >
                      <span className="h-14 w-20 shrink-0 overflow-hidden">
                        <PlacePhoto type={p.type} imagePath={p.imagePath} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-display font-bold">
                          {p.name}
                        </span>
                        <span className="block text-[13px] text-mute">
                          {countThings(p.itemCount)}
                        </span>
                      </span>
                      <IconChevronRight className="size-4 text-mute/60" />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {shown && shown.length === 0 && matchingPlaces.length > 0 ? null : (
            <section className="flex flex-col gap-2.5" aria-labelledby="si-h">
              <SectionLabel id="si-h">
                {shown ? countThings(shown.length) : "Things"}
              </SectionLabel>
              {shown === null ? (
                <ItemListSkeleton rows={3} />
              ) : shown.length === 0 ? (
                <p className="text-mute">
                  Nothing called &ldquo;{q}&rdquo; yet. Check the spelling, or
                  add it to a place.
                </p>
              ) : (
                <ItemList>
                  {shown.map((item, i) => (
                    <ItemRow
                      key={item.id}
                      index={i}
                      item={item}
                      place={placeById.get(item.locationId)?.name}
                      highlight={q}
                      addedBy={(item.addedBy && names.get(item.addedBy)) || ""}
                      onOpen={(it) => {
                        remember();
                        setOpen(it);
                      }}
                      onTakeOne={takeOne}
                      taking={taking === item.id}
                    />
                  ))}
                </ItemList>
              )}
            </section>
          )}
        </div>
      )}

      <TakeOutSheet
        item={open}
        placeName={open ? placeById.get(open.locationId)?.name : undefined}
        names={names}
        onClose={() => setOpen(null)}
        onTaken={(before, after, amount, movementId) => {
          refresh();
          const left =
            after.quantity > 0
              ? `, ${formatQuantity(after.quantity, after.unit)} left`
              : ", all gone";
          announce(
            `Took out ${formatQuantity(amount, before.unit)} of ${before.productName}${left}`,
            movementId,
          );
        }}
        onChanged={(message, movementId) => {
          refresh();
          announce(message, movementId);
        }}
      />
      <Toast toast={toast} onDone={clear} />
    </AppShell>
  );
}
