import { supabase } from "@/lib/supabase/client";
import type { Role } from "@/lib/household";

/** The sticker code for one of your places. */
export async function loadStickerCode(locationId: string): Promise<string | null> {
  const { data, error } = await supabase().from("storage_locations").select("link_code").eq("id", locationId).maybeSingle();
  if (error) throw error;
  return (data?.link_code as string | undefined) ?? null;
}

/** Your role in a household, or null when you're not in it. */
export async function loadMyRole(householdId: string): Promise<Role | null> {
  const sb = supabase();
  const { data: auth } = await sb.auth.getSession();
  const uid = auth.session?.user.id;
  if (!uid) return null;
  const { data, error } = await sb.from("household_members").select("role").eq("household_id", householdId).eq("user_id", uid).maybeSingle();
  if (error) throw error;
  return (data?.role as Role | undefined) ?? null;
}

/** The place a sticker opens, or null for an unknown code or a place in someone else's household. */
export async function resolveSticker(code: string): Promise<string | null> {
  const { data, error } = await supabase().rpc("resolve_location_code", { p_code: code });
  if (error) throw error;
  return (data as string | null) ?? null;
}

/** Owners only: give a place a new code, so old stickers and printed labels stop working. */
export async function rotateSticker(locationId: string): Promise<string> {
  const { data, error } = await supabase().rpc("rotate_location_code", { p_location: locationId });
  if (error) throw error;
  return data as string;
}

/** Sticker codes for every place in a household, by place id. */
export async function loadStickerCodes(householdId: string): Promise<Map<string, string>> {
  const { data, error } = await supabase().from("storage_locations").select("id, link_code").eq("household_id", householdId).is("archived_at", null);
  if (error) throw error;
  return new Map((data ?? []).map((r) => [r.id as string, r.link_code as string]));
}
