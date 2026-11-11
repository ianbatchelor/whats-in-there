"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";
import { friendlyError } from "@/lib/supabase/errors";
import { loadMembers, loadMemberships, loadPlaces, pickCurrent, type Member, type Membership, type Place } from "@/lib/household";
import { placeLabel } from "@/lib/domain/places";

/**
 * The signed-in person's current household, its members and places, kept live.
 * Sends people with no household to /welcome/.
 */
export function useHousehold(session: Session) {
  const router = useRouter();
  const [current, setCurrent] = useState<Membership | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [places, setPlaces] = useState<Place[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  const refreshPlaces = useCallback(async (householdId: string) => {
    try {
      setPlaces(await loadPlaces(householdId));
      setVersion((v) => v + 1);
    } catch (e) {
      setError(friendlyError(e));
    }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const memberships = await loadMemberships(session.user.id);
        if (!active) return;
        const chosen = pickCurrent(memberships);
        if (!chosen) return router.replace("/welcome/");
        setCurrent(chosen);
        const [m] = await Promise.all([loadMembers(chosen.householdId), refreshPlaces(chosen.householdId)]);
        if (active) setMembers(m);
      } catch (e) {
        if (active) setError(friendlyError(e));
      }
    })();
    return () => {
      active = false;
    };
  }, [session.user.id, router, refreshPlaces]);

  // Live updates: another household member adds a place or changes stock.
  useEffect(() => {
    if (!current) return;
    const channel = supabase()
      .channel(`household:${current.householdId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "storage_locations", filter: `household_id=eq.${current.householdId}` }, () =>
        refreshPlaces(current.householdId),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "stock_items", filter: `household_id=eq.${current.householdId}` }, () =>
        refreshPlaces(current.householdId),
      )
      .subscribe();
    return () => {
      supabase().removeChannel(channel);
    };
  }, [current, refreshPlaces]);

  const names = useMemo(() => new Map(members.map((m) => [m.userId, m.displayName])), [members]);
  // Names here read "Blue box, in Garage" for boxes, since they're shown next to things from anywhere.
  const placeById = useMemo(() => {
    const raw = new Map((places ?? []).map((p) => [p.id, p]));
    return new Map((places ?? []).map((p) => [p.id, { ...p, name: placeLabel(p, raw) }]));
  }, [places]);
  const me = members.find((m) => m.userId === session.user.id);

  return {
    current,
    members,
    places,
    names,
    placeById,
    me,
    error,
    setError,
    /** Increments whenever places or stock change, so screens can reload their own lists. */
    version,
    refresh: () => (current ? refreshPlaces(current.householdId) : Promise.resolve()),
  };
}
