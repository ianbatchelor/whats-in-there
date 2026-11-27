"use client";

import { useEffect, useMemo, useState } from "react";
import { HELP_TOPICS, nodeText } from "./topics";
import { matches } from "@/lib/domain/search";
import { IconChevronRight, IconSearch, IconX } from "@/components/ui/icons";

/**
 * Help as a search box and short topics. A topic opens in place; a link such as /help/#lists opens
 * that one straight away.
 */
export function HelpTopics() {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const q = query.trim();

  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (!id || !HELP_TOPICS.some((t) => t.id === id)) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpen(id);
    requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ block: "start" }));
  }, []);

  const words = useMemo(() => new Map(HELP_TOPICS.map((t) => [t.id, `${t.title} ${t.group} ${nodeText(t.body)}`])), []);
  const shown = q.length >= 2 ? HELP_TOPICS.filter((t) => matches(q, words.get(t.id))) : HELP_TOPICS;
  const groups = [...new Set(shown.map((t) => t.group))];

  return (
    <div className="not-doc flex flex-col gap-6">
      <label className="flex min-h-12 items-center gap-3 rounded-xl border border-line bg-card px-4 focus-within:border-leaf">
        <IconSearch className="size-5 shrink-0 text-mute" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search help, e.g. sticker or share"
          aria-label="Search help"
          className="min-w-0 flex-1 bg-transparent text-base placeholder:text-mute focus:outline-none [&::-webkit-search-cancel-button]:hidden"
        />
        {query ? (
          <button type="button" onClick={() => setQuery("")} aria-label="Clear search" className="-mr-2 grid size-9 place-items-center rounded-full text-mute hover:bg-sunk">
            <IconX className="size-4" />
          </button>
        ) : null}
      </label>

      {shown.length === 0 ? <p className="text-mute">Nothing in help matches &ldquo;{q}&rdquo;. Email us below and we&apos;ll answer.</p> : null}

      {groups.map((g) => (
        <section key={g} className="flex flex-col gap-2.5">
          <h2 className="mt-0! font-serif text-[1.3rem]! font-semibold tracking-[-0.01em] text-forest">{g}</h2>
          <ul className="mt-0! list-none! divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-card pl-0! shadow-[var(--shadow-card)]">
            {shown
              .filter((t) => t.group === g)
              .map((t) => {
                const isOpen = open === t.id || q.length >= 2;
                return (
                  <li key={t.id} id={t.id} className="mt-0! scroll-mt-4">
                    <button
                      onClick={() => setOpen(open === t.id ? null : t.id)}
                      aria-expanded={isOpen}
                      className="flex min-h-13 w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-sunk/50"
                    >
                      <span className="min-w-0 flex-1 text-[15.5px] font-semibold">{t.title}</span>
                      <IconChevronRight className={`size-4 shrink-0 text-mute transition ${isOpen ? "rotate-90" : ""}`} />
                    </button>
                    {isOpen ? (
                      <div className="flex flex-col gap-3 px-4 pb-4 text-[15px] leading-relaxed text-fg/90 [&_a]:font-semibold [&_a]:underline [&_a]:underline-offset-4 [&_li]:mt-1 [&_ul]:list-disc [&_ul]:pl-5">
                        {t.body}
                      </div>
                    ) : null}
                  </li>
                );
              })}
          </ul>
        </section>
      ))}
    </div>
  );
}
