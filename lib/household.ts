import { supabase } from "@/lib/supabase/client";
import { KEYS, readLocal, writeLocal } from "@/lib/storage";

export type Role = "owner" | "member";
export type Membership = { householdId: string; name: string; role: Role };
export type Member = { userId: string; role: Role; joinedAt: string; displayName: string };
export type LocationType = "freezer" | "fridge" | "pantry" | "cupboard" | "wine" | "other";
export type Place = { id: string; name: string; type: LocationType; itemCount: number };

export async function loadMemberships(userId: string): Promise<Membership[]> {
  const { data, error } = await supabase()
    .from("household_members")
    .select("role, joined_at, household:households(id, name)")
    .eq("user_id", userId)
    .order("joined_at");
  if (error) throw error;
  return (data ?? []).flatMap((row) => {
    const h = row.household as unknown as { id: string; name: string } | null;
    return h ? [{ householdId: h.id, name: h.name, role: row.role as Role }] : [];
  });
}

/** Picks the remembered household if the user still belongs to it, otherwise the first one. */
export function pickCurrent(memberships: Membership[]): Membership | null {
  const remembered = readLocal(KEYS.household);
  const found = memberships.find((m) => m.householdId === remembered) ?? memberships[0] ?? null;
  if (found) writeLocal(KEYS.household, found.householdId);
  return found;
}

export function rememberHousehold(id: string) {
  writeLocal(KEYS.household, id);
}

export async function loadMembers(householdId: string): Promise<Member[]> {
  const sb = supabase();
  const { data: rows, error } = await sb
    .from("household_members")
    .select("user_id, role, joined_at")
    .eq("household_id", householdId)
    .order("joined_at");
  if (error) throw error;
  const ids = (rows ?? []).map((r) => r.user_id as string);
  const { data: profiles, error: pErr } = await sb.from("profiles").select("user_id, display_name").in("user_id", ids);
  if (pErr) throw pErr;
  const names = new Map((profiles ?? []).map((p) => [p.user_id as string, p.display_name as string]));
  return (rows ?? []).map((r) => ({
    userId: r.user_id as string,
    role: r.role as Role,
    joinedAt: r.joined_at as string,
    displayName: names.get(r.user_id as string) ?? "Someone",
  }));
}

export async function loadPlaces(householdId: string): Promise<Place[]> {
  const sb = supabase();
  const { data, error } = await sb
    .from("storage_locations")
    .select("id, name, type, sort_order, created_at, stock_items(count)")
    .eq("household_id", householdId)
    .is("archived_at", null)
    .eq("stock_items.status", "in_stock")
    .order("sort_order")
    .order("created_at");
  if (error) throw error;
  return (data ?? []).map((l) => ({
    id: l.id as string,
    name: l.name as string,
    type: l.type as LocationType,
    itemCount: ((l.stock_items as unknown as { count: number }[] | null)?.[0]?.count ?? 0) as number,
  }));
}
