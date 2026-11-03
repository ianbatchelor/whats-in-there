import { supabase } from "@/lib/supabase/client";
import type { StockItem } from "@/lib/domain/stock";
import { likePattern, sortUseFirst } from "@/lib/domain/stock";
import type { StockUnit } from "@/lib/domain/quantity";

const COLUMNS =
  "id, location_id, product_name, brand, category, quantity, unit, weight_value, weight_unit, use_by_date, best_before_date, frozen_at, added_at, added_by, notes, version";

type Row = Record<string, unknown>;

function toItem(r: Row): StockItem {
  return {
    id: r.id as string,
    locationId: r.location_id as string,
    productName: r.product_name as string,
    brand: (r.brand as string | null) ?? null,
    category: (r.category as string | null) ?? null,
    quantity: Number(r.quantity),
    unit: r.unit as StockUnit,
    weightValue: r.weight_value == null ? null : Number(r.weight_value),
    weightUnit: (r.weight_unit as StockUnit | null) ?? null,
    useByDate: (r.use_by_date as string | null) ?? null,
    bestBeforeDate: (r.best_before_date as string | null) ?? null,
    frozenAt: (r.frozen_at as string | null) ?? null,
    addedAt: r.added_at as string,
    addedBy: (r.added_by as string | null) ?? null,
    notes: (r.notes as string | null) ?? null,
    version: r.version as number,
  };
}

export async function loadItems(locationId: string): Promise<StockItem[]> {
  const { data, error } = await supabase().from("stock_items").select(COLUMNS).eq("location_id", locationId).eq("status", "in_stock");
  if (error) throw error;
  return sortUseFirst((data ?? []).map(toItem));
}

/** Oldest things across every place in the household. */
export async function loadUseFirst(householdId: string, limit = 4): Promise<StockItem[]> {
  const { data, error } = await supabase()
    .from("stock_items")
    .select(COLUMNS)
    .eq("household_id", householdId)
    .eq("status", "in_stock")
    .order("added_at")
    .limit(200);
  if (error) throw error;
  return sortUseFirst((data ?? []).map(toItem)).slice(0, limit);
}

export async function searchItems(householdId: string, query: string): Promise<StockItem[]> {
  const pattern = likePattern(query);
  const { data, error } = await supabase()
    .from("stock_items")
    .select(COLUMNS)
    .eq("household_id", householdId)
    .eq("status", "in_stock")
    .or(`product_name.ilike.${pattern},brand.ilike.${pattern},category.ilike.${pattern}`)
    .limit(50);
  if (error) throw error;
  return sortUseFirst((data ?? []).map(toItem));
}

export type NewItem = {
  locationId: string;
  productName: string;
  quantity: number;
  unit: StockUnit;
  brand?: string;
  weightValue?: number | null;
  weightUnit?: StockUnit | null;
  useByDate?: string | null;
  bestBeforeDate?: string | null;
  frozenAt?: string | null;
  notes?: string;
};

async function latestMovementId(itemId: string, action: "add" | "remove"): Promise<string | null> {
  const { data } = await supabase()
    .from("stock_movements")
    .select("id")
    .eq("stock_item_id", itemId)
    .eq("action", action)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

export async function addItem(input: NewItem): Promise<{ item: StockItem; movementId: string | null }> {
  const { data, error } = await supabase().rpc("add_stock", {
    p_location: input.locationId,
    p_product_name: input.productName,
    p_quantity: input.quantity,
    p_unit: input.unit,
    p_brand: input.brand || null,
    p_weight_value: input.weightValue ?? null,
    p_weight_unit: input.weightUnit ?? null,
    p_use_by_date: input.useByDate || null,
    p_best_before_date: input.bestBeforeDate || null,
    p_frozen_at: input.frozenAt || null,
    p_notes: input.notes || null,
  });
  if (error) throw error;
  const item = toItem(data as Row);
  return { item, movementId: await latestMovementId(item.id, "add") };
}

export async function takeOut(item: StockItem, amount: number): Promise<{ item: StockItem; movementId: string | null }> {
  const { data, error } = await supabase().rpc("remove_stock", { p_item: item.id, p_amount: amount, p_expected_version: item.version });
  if (error) throw error;
  const updated = toItem(data as Row);
  return { item: updated, movementId: await latestMovementId(item.id, "remove") };
}

export async function undo(movementId: string): Promise<void> {
  const { error } = await supabase().rpc("undo_movement", { p_movement: movementId });
  if (error) throw error;
}

export type Movement = { id: string; action: "add" | "remove" | "adjust" | "move" | "undo"; delta: number; after: number; actor: string | null; at: string };

export async function loadHistory(itemId: string): Promise<Movement[]> {
  const { data, error } = await supabase()
    .from("stock_movements")
    .select("id, action, quantity_delta, quantity_after, actor_user_id, created_at")
    .eq("stock_item_id", itemId)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id as string,
    action: r.action as Movement["action"],
    delta: Number(r.quantity_delta),
    after: Number(r.quantity_after),
    actor: (r.actor_user_id as string | null) ?? null,
    at: r.created_at as string,
  }));
}

export type Activity = Movement & { itemId: string; itemName: string; unit: StockUnit; locationId: string | null };

/** What the household added and took out recently, newest first. */
export async function loadActivity(householdId: string, limit = 60): Promise<Activity[]> {
  const { data, error } = await supabase()
    .from("stock_movements")
    .select("id, action, quantity_delta, quantity_after, actor_user_id, created_at, stock_item_id, item:stock_items(product_name, unit, location_id)")
    .eq("household_id", householdId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((r) => {
    const raw = (r as Row).item as Row | Row[] | null;
    const item = Array.isArray(raw) ? raw[0] : raw;
    return {
      id: r.id as string,
      action: r.action as Movement["action"],
      delta: Number(r.quantity_delta),
      after: Number(r.quantity_after),
      actor: (r.actor_user_id as string | null) ?? null,
      at: r.created_at as string,
      itemId: r.stock_item_id as string,
      itemName: (item?.product_name as string | undefined) ?? "Something",
      unit: ((item?.unit as StockUnit | undefined) ?? "item") as StockUnit,
      locationId: (item?.location_id as string | undefined) ?? null,
    };
  });
}
