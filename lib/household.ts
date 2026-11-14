import { supabase } from "@/lib/supabase/client";
import { KEYS, readLocal, writeLocal } from "@/lib/storage";

/** "family": has their own home, and is here for presents and Christmas only. */
export type Role = "owner" | "member" | "family";
export type Membership = { householdId: string; name: string; role: Role };
export type Member = { userId: string; role: Role; joinedAt: string; displayName: string };
export type LocationType =
  | "freezer" | "fridge" | "pantry" | "cupboard" | "wine" | "attic" | "garage" | "shed" | "wardrobe" | "garden" | "box"
  | "bookshelf" | "toybox" | "desk" | "medicine" | "car" | "other";
export type Place = {
  id: string;
  name: string;
  type: LocationType;
  itemCount: number;
  /** The household's own cover photo, if they added one. */
  imagePath?: string | null;
  /** The place it sits inside ("Blue box" in the Garage), if any. */
  parentId?: string | null;
  /** How many boxes or shelves are inside it (Home only). */
  boxCount?: number;
};

/**
 * False once the database turns out not to have the cover photo column yet (the app can be
 * deployed before the migration is run). Places then load without photos and the option is hidden.
 */
let coverPhotos = true;
export function coverPhotosAvailable(): boolean {
  return coverPhotos;
}
/** Postgres 42703 (PostgREST passes it through): the column doesn't exist. */
function missingColumn(error: { code?: string } | null): boolean {
  return error?.code === "42703";
}

/** One place by id, or null when it's gone or not yours. */
export async function loadPlace(locationId: string): Promise<(Omit<Place, "itemCount"> & { householdId: string }) | null> {
  const run = (cols: string) => supabase().from("storage_locations").select(cols).eq("id", locationId).is("archived_at", null).maybeSingle();
  let res = await run(`id, name, type, household_id, parent_id${coverPhotos ? ", image_path" : ""}`);
  if (missingColumn(res.error)) {
    coverPhotos = false;
    res = await run("id, name, type, household_id, parent_id");
  }
  if (res.error) throw res.error;
  const d = res.data as Record<string, unknown> | null;
  if (!d) return null;
  return {
    id: d.id as string,
    name: d.name as string,
    type: d.type as LocationType,
    householdId: d.household_id as string,
    imagePath: (d.image_path as string | null) ?? null,
    parentId: (d.parent_id as string | null) ?? null,
  };
}

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

/** Households you live in (not ones where you're family). */
export function homesOf(memberships: Membership[]): Membership[] {
  return memberships.filter((m) => m.role !== "family");
}

/** Households where you're family: their present lists, nothing else. */
export function familiesOf(memberships: Membership[]): Membership[] {
  return memberships.filter((m) => m.role === "family");
}

/**
 * Picks the remembered home if the user still lives there, otherwise the first one. Households
 * where they're only family are never "current": the app has nothing to show from them but presents.
 */
export function pickCurrent(memberships: Membership[]): Membership | null {
  const homes = homesOf(memberships);
  const remembered = readLocal(KEYS.household);
  const found = homes.find((m) => m.householdId === remembered) ?? homes[0] ?? null;
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
  const run = (cols: string) =>
    supabase()
      .from("storage_locations")
      .select(cols)
      .eq("household_id", householdId)
      .is("archived_at", null)
      .eq("stock_items.status", "in_stock")
      .order("sort_order")
      .order("created_at");
  const base = "id, name, type, sort_order, created_at, parent_id, stock_items(count)";
  let res = await run(coverPhotos ? `${base}, image_path` : base);
  if (missingColumn(res.error)) {
    coverPhotos = false;
    res = await run(base);
  }
  if (res.error) throw res.error;
  return ((res.data ?? []) as unknown as Record<string, unknown>[]).map((l) => ({
    id: l.id as string,
    name: l.name as string,
    type: l.type as LocationType,
    itemCount: ((l.stock_items as unknown as { count: number }[] | null)?.[0]?.count ?? 0) as number,
    imagePath: (l.image_path as string | null) ?? null,
    parentId: (l.parent_id as string | null) ?? null,
  }));
}

export type InvitePreview = { household: string; invitedBy: string; role: Role };

/** What an invitation link is for, before joining. Null when it's used, stopped or out of date. */
export async function loadInvitePreview(token: string): Promise<InvitePreview | null> {
  const { data, error } = await supabase().rpc("invitation_preview", { p_token: token });
  if (error) throw error;
  const row = (data as { household: string; invited_by: string; role: Role }[] | null)?.[0];
  return row ? { household: row.household, invitedBy: row.invited_by, role: row.role } : null;
}

/** Presents can come from your own home or from a family you're part of. */
export function defaultPresentsCircle(memberships: Membership[], remembered: string | null, home: string | null): Membership | null {
  return (
    memberships.find((m) => m.householdId === remembered) ??
    // Family elsewhere is usually the bigger present circle (a grown-up daughter's own flat is just her).
    familiesOf(memberships)[0] ??
    memberships.find((m) => m.householdId === home) ??
    memberships[0] ??
    null
  );
}
