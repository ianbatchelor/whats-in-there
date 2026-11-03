"use client";

import { useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { AuthGate } from "@/components/AuthGate";
import { AppShell } from "@/components/AppShell";
import { PageHeader, HouseholdLoading } from "@/components/common/PageHeader";
import { useHousehold } from "@/lib/hooks/useHousehold";
import { useQueryParam } from "@/lib/hooks/useQueryParam";
import { countThings } from "@/lib/domain/places";
import type { LocationType } from "@/lib/household";
import { Notice } from "@/components/ui/Notice";
import { PLACE_TYPES, countPlaces, placeType } from "@/components/home/placeTypes";
import { AddPlaceSheet } from "@/components/home/AddPlaceSheet";
import { AddPlaceTile, PlaceCard } from "@/components/home/PlaceCard";
import { PlacePhoto } from "@/components/art/PlacePhoto";

export default function PlacesPage() {
  return <AuthGate>{(session) => <Places session={session} />}</AuthGate>;
}

function Places({ session }: { session: Session }) {
  const { current, places, error, refresh } = useHousehold(session);
  const raw = useQueryParam("type");
  const [adding, setAdding] = useState(false);
  const type = (PLACE_TYPES.some((t) => t.value === raw) ? raw : "other") as LocationType;
  const info = placeType(type);
  const mine = places?.filter((p) => p.type === type) ?? null;
  const total = mine?.reduce((n, p) => n + p.itemCount, 0) ?? 0;

  return (
    <AppShell wide>
      <div className="relative -mx-4 -mt-[max(16px,env(safe-area-inset-top))] overflow-hidden sm:mx-0 sm:mt-0 sm:rounded-[var(--radius-card)]">
        <div className="aspect-[16/7] lg:aspect-[16/5]">
          <PlacePhoto type={type} variant="wide" eager />
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/5 to-transparent" aria-hidden="true" />
      </div>
      <PageHeader
        back={{ href: "/", label: "My Places" }}
        title={info.plural}
        sub={mine ? `${countPlaces(mine.length, type)} · ${countThings(total)}. ${info.blurb}` : info.blurb}
      />
      {error ? <Notice>{error}</Notice> : null}
      {!current || mine === null ? (
        <HouseholdLoading />
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
          {mine.map((p, i) => (
            <PlaceCard key={p.id} place={p} index={i} />
          ))}
          <AddPlaceTile onClick={() => setAdding(true)} />
        </ul>
      )}
      {current ? <AddPlaceSheet open={adding} onClose={() => setAdding(false)} householdId={current.householdId} onAdded={refresh} /> : null}
    </AppShell>
  );
}
