import { supabase } from "@/lib/supabase/client";
import type { LocationType } from "@/lib/household";

/** Postgres/PostgREST: the function isn't there (the app can ship before its database change). */
function missingFunction(error: { code?: string } | null): boolean {
  return error?.code === "PGRST202" || error?.code === "42883";
}

export type SharedPlace = {
  id: string;
  name: string;
  type: LocationType;
  imagePath: string | null;
  household: string;
  householdId: string;
  things: number;
};

/** Places in other households that you've been let into, for Home. */
export async function loadSharedWithMe(): Promise<SharedPlace[]> {
  const { data, error } = await supabase().rpc("shared_with_me");
  if (missingFunction(error)) return [];
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    id: r.id as string,
    name: r.name as string,
    type: r.type as LocationType,
    imagePath: (r.image_path as string | null) ?? null,
    household: r.household as string,
    householdId: r.household_id as string,
    things: (r.things as number) ?? 0,
  }));
}

/** True when you live in this household; false when you're only let into one of its places. */
export async function livesIn(householdId: string): Promise<boolean> {
  const { data, error } = await supabase().rpc("is_member", { hid: householdId });
  if (error) throw error;
  return data === true;
}

export type PlacePerson = { userId: string; name: string; addedAt: string };

/** People let into a place (not the people who live there). */
export async function loadPlacePeople(locationId: string): Promise<PlacePerson[]> {
  const { data, error } = await supabase().rpc("place_people", { p_location: locationId });
  if (missingFunction(error)) return [];
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    userId: r.user_id as string,
    name: r.display_name as string,
    addedAt: r.added_at as string,
  }));
}

/** Names for these people, where you're allowed to see them. */
export async function loadNames(userIds: string[]): Promise<Map<string, string>> {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (ids.length === 0) return new Map();
  const { data, error } = await supabase().from("profiles").select("user_id, display_name").in("user_id", ids);
  if (error) throw error;
  return new Map((data ?? []).map((p) => [p.user_id as string, p.display_name as string]));
}

export async function sharePlaceWith(locationId: string, userId: string): Promise<void> {
  const { error } = await supabase().rpc("share_place_with", { p_location: locationId, p_user: userId });
  if (error) throw error;
}

/** Take someone out of a place, or leave it yourself. */
export async function unsharePlace(locationId: string, userId: string): Promise<void> {
  const { error } = await supabase().rpc("unshare_place", { p_location: locationId, p_user: userId });
  if (error) throw error;
}

/** A link for one person, good for 7 days. */
export async function makePlaceLink(locationId: string): Promise<string> {
  const { data, error } = await supabase().rpc("make_place_link", { p_location: locationId });
  if (error) throw error;
  return data as string;
}

export async function stopPlaceLinks(locationId: string): Promise<void> {
  const { error } = await supabase().rpc("stop_place_links", { p_location: locationId });
  if (error) throw error;
}

/** When the last link still out for this place runs out, or null. */
export async function placeLinkExpiry(locationId: string): Promise<string | null> {
  const { data, error } = await supabase().rpc("place_link_status", { p_location: locationId });
  if (missingFunction(error)) return null;
  if (error) throw error;
  return (data as string | null) ?? null;
}

export type PlaceInvitePreview = { place: string; household: string; invitedBy: string; things: number };

/** What a place link is for, signed in or not. Null for a wrong, used, stopped or expired link. */
export async function previewPlaceInvite(token: string): Promise<PlaceInvitePreview | null> {
  const { data, error } = await supabase().rpc("place_invite_preview", { p_token: token });
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | undefined;
  return row ? { place: row.place as string, household: row.household as string, invitedBy: row.invited_by as string, things: row.things as number } : null;
}

/** Joins through a link; returns the place's id. */
export async function joinPlace(token: string): Promise<string> {
  const { data, error } = await supabase().rpc("join_place", { p_token: token });
  if (error) throw error;
  return data as string;
}
