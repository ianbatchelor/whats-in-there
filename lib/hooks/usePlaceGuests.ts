"use client";

import { useEffect, useState } from "react";
import { loadPlaceGuests } from "@/lib/access";
import type { Member, Membership, Place } from "@/lib/household";

/** Who outside the home uses each place (by top-level place id), for marking shared places. */
export function usePlaceGuests(me: string, current: Membership | null, members: Member[], places: Place[] | null): Map<string, string[]> {
  const [guests, setGuests] = useState<Map<string, string[]>>(new Map());
  useEffect(() => {
    if (!current || !places || members.length === 0) return;
    let live = true;
    loadPlaceGuests(me, current.householdId, members, places)
      .then((g) => live && setGuests(g))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [me, current, members, places]);
  return guests;
}
