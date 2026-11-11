"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Session } from "@supabase/supabase-js";
import { AuthGate } from "@/components/AuthGate";
import { AppShell, SectionLabel } from "@/components/AppShell";
import { PageHeader, HouseholdLoading } from "@/components/common/PageHeader";
import { useHousehold } from "@/lib/hooks/useHousehold";
import { friendlyError } from "@/lib/supabase/errors";
import { loadActivity, type Activity } from "@/lib/stock";
import { activitySentence, groupByDay } from "@/lib/domain/activity";
import { Avatar } from "@/components/ui/Avatar";
import { Notice } from "@/components/ui/Notice";

export default function ActivityPage() {
  return <AuthGate>{(session) => <ActivityFeed session={session} />}</AuthGate>;
}

function ActivityFeed({ session }: { session: Session }) {
  const { current, members, names, placeById, error, setError, version } = useHousehold(session);
  const [rows, setRows] = useState<Activity[] | null>(null);

  useEffect(() => {
    if (!current) return;
    let active = true;
    (async () => {
      try {
        const data = await loadActivity(current.householdId);
        if (active) setRows(data);
      } catch (e) {
        if (active) setError(friendlyError(e));
      }
    })();
    return () => {
      active = false;
    };
  }, [current, version, setError]);

  const memberIndex = new Map(members.map((m, i) => [m.userId, i]));

  return (
    <AppShell>
      <PageHeader title="Activity" sub={current ? `What's been added and taken out in ${current.name}.` : "What's been added and taken out."} />
      {error ? <Notice>{error}</Notice> : null}
      {rows === null ? (
        <HouseholdLoading />
      ) : rows.length === 0 ? (
        <div className="rounded-[var(--radius-card)] border-2 border-dashed border-line bg-sunk/40 p-5">
          <h2 className="font-display text-xl font-bold">Nothing yet</h2>
          <p className="mt-1 text-sm text-mute">When anyone in the household adds or takes something out, it shows up here.</p>
        </div>
      ) : (
        groupByDay(rows).map(({ label, rows: day }) => (
          <section key={label} className="flex flex-col gap-2.5" aria-label={label}>
            <SectionLabel>{label}</SectionLabel>
            <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-card shadow-[var(--shadow-card)]">
              {day.map((r) => {
                const who = r.actor === session.user.id ? "You" : (r.actor && names.get(r.actor)) || "Someone";
                const placeId = r.action === "move" && r.toLocationId ? r.toLocationId : r.locationId;
                const place = placeId ? placeById.get(placeId) : undefined;
                return (
                  <li key={r.id} className="flex items-start gap-3 px-3.5 py-3">
                    <Avatar name={who === "You" ? names.get(session.user.id) ?? "You" : who} index={r.actor ? memberIndex.get(r.actor) ?? 0 : 0} size={36} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] leading-snug">
                        <span className="font-semibold">{who}</span> {activitySentence(r, r.toLocationId ? placeById.get(r.toLocationId)?.name : undefined)}
                      </p>
                      <p className="mt-0.5 text-[13px] text-mute">
                        {place ? (
                          <Link href={`/place/?id=${place.id}`} className="font-semibold text-leaf">
                            {place.name}
                          </Link>
                        ) : null}
                        {place ? " · " : ""}
                        {new Date(r.at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}
    </AppShell>
  );
}
