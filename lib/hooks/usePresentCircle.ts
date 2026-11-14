"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { friendlyError } from "@/lib/supabase/errors";
import { defaultPresentsCircle, loadMembers, loadMemberships, type Member, type Membership } from "@/lib/household";
import { KEYS, readLocal, writeLocal } from "@/lib/storage";

/**
 * Whose present lists to show: your own home's, or a family's you're part of (Ian's household, for
 * Molly who has her own flat). Works for people with no home of their own too.
 */
export function usePresentCircle(session: Session) {
  const [circles, setCircles] = useState<Membership[] | null>(null);
  const [circle, setCircle] = useState<Membership | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const all = await loadMemberships(session.user.id);
        if (!active) return;
        // Whether you live on your own decides if your home or a family elsewhere comes first.
        const home = readLocal(KEYS.household);
        const ownHome = all.find((m) => m.householdId === home && m.role !== "family") ?? all.find((m) => m.role !== "family");
        const justYou =
          ownHome && all.some((m) => m.role === "family")
            ? (await loadMembers(ownHome.householdId).catch(() => [])).filter((m) => m.role !== "family").length <= 1
            : false;
        if (!active) return;
        setCircles(all);
        setCircle(defaultPresentsCircle(all, readLocal(KEYS.presentsCircle), ownHome?.householdId ?? home, justYou));
      } catch (e) {
        if (active) setError(friendlyError(e));
      }
    })();
    return () => {
      active = false;
    };
  }, [session.user.id]);

  useEffect(() => {
    if (!circle) return;
    let active = true;
    loadMembers(circle.householdId)
      .then((m) => active && setMembers(m))
      .catch((e) => active && setError(friendlyError(e)));
    return () => {
      active = false;
    };
  }, [circle]);

  const choose = useCallback(
    (id: string) => {
      const found = circles?.find((c) => c.householdId === id);
      if (!found) return;
      writeLocal(KEYS.presentsCircle, id);
      setMembers([]);
      setCircle(found);
    },
    [circles],
  );

  const names = useMemo(() => new Map(members.map((m) => [m.userId, m.displayName])), [members]);
  return { circles, circle, choose, members, names, error, setError };
}
