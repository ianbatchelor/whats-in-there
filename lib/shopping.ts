import { supabase } from "@/lib/supabase/client";
import type { StockUnit } from "@/lib/domain/quantity";
import { isAlreadyOnList, type ShoppingItem } from "@/lib/domain/shopping";

const COLUMNS = "id, name, brand, category, quantity, unit, location_id, added_by, added_at, bought_at, bought_by";

function toShopping(r: Record<string, unknown>): ShoppingItem {
  return {
    id: r.id as string,
    name: r.name as string,
    brand: (r.brand as string | null) ?? null,
    category: (r.category as string | null) ?? null,
    quantity: Number(r.quantity),
    unit: r.unit as StockUnit,
    locationId: (r.location_id as string | null) ?? null,
    addedBy: (r.added_by as string | null) ?? null,
    addedAt: r.added_at as string,
    boughtAt: (r.bought_at as string | null) ?? null,
    boughtBy: (r.bought_by as string | null) ?? null,
  };
}

export async function loadList(householdId: string): Promise<ShoppingItem[]> {
  const { data, error } = await supabase().from("shopping_items").select(COLUMNS).eq("household_id", householdId).order("added_at");
  if (error) throw error;
  return (data ?? []).map(toShopping);
}

export type NewShopping = { name: string; brand?: string | null; category?: string | null; quantity?: number; unit?: StockUnit; locationId?: string | null };

/** Adds it to the list. Returns false if it was already there, which isn't an error. */
export async function addToList(householdId: string, input: NewShopping): Promise<boolean> {
  const { error } = await supabase()
    .from("shopping_items")
    .insert({
      household_id: householdId,
      name: input.name.trim(),
      brand: input.brand ?? null,
      category: input.category ?? null,
      quantity: input.quantity ?? 1,
      unit: input.unit ?? "item",
      location_id: input.locationId ?? null,
    });
  if (error) {
    if (isAlreadyOnList(error)) return false;
    throw error;
  }
  return true;
}

export async function setBought(id: string, bought: boolean): Promise<void> {
  const { error } = await supabase()
    .from("shopping_items")
    .update({ bought_at: bought ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) throw isAlreadyOnList(error) ? new Error("already_on_list") : error;
}

export async function setPlace(id: string, locationId: string | null): Promise<void> {
  const { error } = await supabase().from("shopping_items").update({ location_id: locationId }).eq("id", id);
  if (error) throw error;
}

export async function removeFromList(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await supabase().from("shopping_items").delete().in("id", ids);
  if (error) throw error;
}

/** Adds a bought thing to the place it goes in and takes it off the list. */
export async function putAway(id: string): Promise<void> {
  const { error } = await supabase().rpc("put_away_shopping", { p_item: id });
  if (error) throw error;
}

/** How many things are still to buy, and their names, for the Home card. */
export async function loadToBuy(householdId: string): Promise<string[]> {
  const { data, error } = await supabase()
    .from("shopping_items")
    .select("name")
    .eq("household_id", householdId)
    .is("bought_at", null)
    .order("added_at")
    .limit(100);
  if (error) throw error;
  return (data ?? []).map((r) => r.name as string);
}
