import { supabase } from "@/lib/supabase/client";
import { gatherAccess, type Access, type AccessMember, type AccessPlace, type LinkedWishList, type PlaceGuest } from "@/lib/domain/access";
import { loadLists, loadPeople } from "@/lib/ownLists";
import { loadNames } from "@/lib/sharedPlaces";
import type { ListPerson, OwnList } from "@/lib/domain/ownLists";

/** Who's been let into any of these places. Empty if sharing places isn't set up in the database yet. */
async function loadGuests(placeIds: string[]): Promise<PlaceGuest[]> {
  if (placeIds.length === 0) return [];
  const { data, error } = await supabase().from("place_members").select("location_id, user_id").in("location_id", placeIds);
  if (error) return [];
  return (data ?? []).map((r) => ({ locationId: r.location_id as string, userId: r.user_id as string }));
}

/** The household's wish lists that anyone with the link can open. */
async function loadLinked(householdId: string): Promise<LinkedWishList[]> {
  const { data, error } = await supabase().from("wish_lists").select("kind, for_user, name, share_code").eq("household_id", householdId).not("share_code", "is", null);
  if (error) return [];
  return (data ?? []).map((r) => ({ kind: r.kind === "books" ? "books" : "presents", forUser: (r.for_user as string | null) ?? null, name: (r.name as string | null) ?? null }));
}

/** Everything the People page, Home and Lists need to say who sees what. */
export async function loadAccess(me: string, householdId: string, members: AccessMember[], places: AccessPlace[]): Promise<Access> {
  const [guests, lists, listPeople, linked] = await Promise.all([
    loadGuests(places.map((p) => p.id)),
    loadLists().catch(() => [] as OwnList[]),
    loadPeople().catch(() => [] as ListPerson[]),
    loadLinked(householdId),
  ]);
  const memberIds = new Set(members.map((m) => m.userId));
  const names = await loadNames(guests.map((g) => g.userId).filter((id) => !memberIds.has(id))).catch(() => new Map<string, string>());
  return gatherAccess({ me, householdId, members, places, guests, names, lists, listPeople, linked });
}

/** Just who else uses each place, for marking shared places on Home. */
export async function loadPlaceGuests(me: string, householdId: string, members: AccessMember[], places: AccessPlace[]): Promise<Map<string, string[]>> {
  const guests = await loadGuests(places.map((p) => p.id));
  if (guests.length === 0) return new Map();
  const memberIds = new Set(members.map((m) => m.userId));
  const names = await loadNames(guests.map((g) => g.userId).filter((id) => !memberIds.has(id))).catch(() => new Map<string, string>());
  return gatherAccess({ me, householdId, members, places, guests, names, lists: [], listPeople: [], linked: [] }).placeGuests;
}
