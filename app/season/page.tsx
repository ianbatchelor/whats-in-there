"use client";

import { useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { AuthGate } from "@/components/AuthGate";
import { AppShell } from "@/components/AppShell";
import { HouseholdLoading, PageHeader } from "@/components/common/PageHeader";
import { SeasonalList, useSeasonal } from "@/components/home/SeasonalReminders";
import { useHousehold } from "@/lib/hooks/useHousehold";
import { Notice } from "@/components/ui/Notice";
import { Toast, type ToastData } from "@/components/ui/Toast";
import { IconCheck } from "@/components/ui/icons";
import { SectionLabel } from "@/components/AppShell";
import { ListArt } from "@/components/lists/ListArt";
import { SEASONS, seasonArt } from "@/lib/domain/listArt";

export default function SeasonPage() {
  return <AuthGate>{(session) => <Season session={session} />}</AuthGate>;
}

function Season({ session }: { session: Session }) {
  const { current, places, error } = useHousehold(session);
  const [toast, setToast] = useState<ToastData | null>(null);
  const seasonal = useSeasonal(current?.householdId, places, setToast);

  return (
    <AppShell>
      <PageHeader
        title={`${seasonal.season} jobs`}
        back={{ href: "/lists/", label: "Lists" }}
        art={seasonArt(seasonal.season).art}
        sub="Jobs that come round each year, for the places you have. Tick one off and it's gone for everyone at home until next time."
      />
      {error ? <Notice>{error}</Notice> : null}
      {!current || !places || !seasonal.shown ? (
        <HouseholdLoading />
      ) : seasonal.shown.length > 0 ? (
        <SeasonalList seasonal={seasonal} places={places} />
      ) : (
        <p className="flex items-center gap-2.5 rounded-2xl border border-line bg-card px-4 py-3 text-[14.5px] text-mute">
          <span className="grid size-6 shrink-0 place-items-center rounded-full bg-ok-bg text-ok" aria-hidden="true">
            <IconCheck className="size-3.5" />
          </span>
          All done for now. The next ones will appear here when their time comes.
        </p>
      )}
      {current && places ? (
        <section aria-labelledby="year-h" className="flex flex-col gap-2.5">
          <SectionLabel id="year-h">Through the year</SectionLabel>
          {/* Every season's jobs stay here to look at, whatever the time of year. */}
          <ul className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,15rem),1fr))] gap-2.5">
            {SEASONS.map((s) => {
              const jobs = seasonal.year[s];
              const now = s === seasonal.season;
              return (
                <li key={s} className={`relative flex min-h-[92px] flex-col gap-1 rounded-[var(--radius-card)] p-3.5 pr-16 ${seasonArt(s).tint}`}>
                  <ListArt src={seasonArt(s).art} className="absolute top-2.5 right-2.5 size-12" />
                  <h3 className="font-display text-[15px] leading-snug font-bold text-fg">
                    {s}
                    {now ? <span className="ml-2 rounded-full bg-card/70 px-2 py-0.5 align-[1px] text-[11.5px] font-bold text-forest">Now</span> : null}
                  </h3>
                  <p className="text-[13.5px] leading-snug text-fg/75">
                    {jobs.length === 0 ? "Nothing for your places" : jobs.map((j) => j.title).join(" · ")}
                  </p>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
      <Toast toast={toast} onDone={() => setToast(null)} />
    </AppShell>
  );
}
