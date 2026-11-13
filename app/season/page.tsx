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
      <Toast toast={toast} onDone={() => setToast(null)} />
    </AppShell>
  );
}
