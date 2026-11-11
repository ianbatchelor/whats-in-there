import { supabase } from "@/lib/supabase/client";
import type { StockItem } from "@/lib/domain/stock";
import { SOON_DAYS, addDays, likePattern, sortUseFirst } from "@/lib/domain/stock";
import { todayIso } from "@/lib/domain/dates";
import type { StockUnit } from "@/lib/domain/quantity";
import { loadPlaces, type LocationType } from "@/lib/household";

const COLUMNS =
  "id, location_id, product_name, brand, category, quantity, unit, weight_value, weight_unit, use_by_date, best_before_date, frozen_at, added_at, added_by, notes, image_path, version, lent_to, lent_on";

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
    imagePath: (r.image_path as string | null) ?? null,
    lentTo: (r.lent_to as string | null | undefined) ?? null,
    lentOn: (r.lent_on as string | null | undefined) ?? null,
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
  category?: string;
  weightValue?: number | null;
  weightUnit?: StockUnit | null;
  useByDate?: string | null;
  bestBeforeDate?: string | null;
  frozenAt?: string | null;
  notes?: string;
  /** Storage path of the label photo, when the item was read from one. */
  imagePath?: string | null;
};

async function latestMovementId(itemId: string, action: "add" | "remove" | "move"): Promise<string | null> {
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
    p_category: input.category || null,
    p_weight_value: input.weightValue ?? null,
    p_weight_unit: input.weightUnit ?? null,
    p_use_by_date: input.useByDate || null,
    p_best_before_date: input.bestBeforeDate || null,
    p_frozen_at: input.frozenAt || null,
    p_notes: input.notes || null,
    p_image_path: input.imagePath || null,
    p_source: input.imagePath ? "photo" : "manual",
  });
  if (error) throw error;
  const item = toItem(data as Row);
  return { item, movementId: await latestMovementId(item.id, "add") };
}

/**
 * Adds a checked list of things in one go, a few at a time, reporting progress. Each one is its own
 * add_stock call, so each is in the history like any other add. Returns the names that failed.
 */
export async function addMany(items: NewItem[], onProgress?: (done: number) => void): Promise<{ added: number; failed: NewItem[] }> {
  const failed: NewItem[] = [];
  let done = 0;
  const queue = [...items];
  const worker = async () => {
    for (let next = queue.shift(); next; next = queue.shift()) {
      const item = next;
      const { error } = await supabase().rpc("add_stock", {
        p_location: item.locationId,
        p_product_name: item.productName,
        p_quantity: item.quantity,
        p_unit: item.unit,
        p_brand: item.brand || null,
        p_category: item.category || null,
        p_source: "photo",
      });
      if (error) failed.push(item);
      onProgress?.(++done);
    }
  };
  await Promise.all(Array.from({ length: Math.min(4, items.length) }, worker));
  return { added: items.length - failed.length, failed };
}

export async function takeOut(item: StockItem, amount: number): Promise<{ item: StockItem; movementId: string | null }> {
  const { data, error } = await supabase().rpc("remove_stock", { p_item: item.id, p_amount: amount, p_expected_version: item.version });
  if (error) throw error;
  const updated = toItem(data as Row);
  return { item: updated, movementId: await latestMovementId(item.id, "remove") };
}

/** The details that can be changed after something is added. */
export type ItemEdit = {
  productName: string;
  quantity: number;
  unit: StockUnit;
  brand: string | null;
  category: string | null;
  weightValue: number | null;
  weightUnit: StockUnit | null;
  useByDate: string | null;
  bestBeforeDate: string | null;
  frozenAt: string | null;
  notes: string | null;
};

export async function updateItem(item: StockItem, edit: ItemEdit): Promise<StockItem> {
  const { data, error } = await supabase().rpc("update_stock_item", {
    p_item: item.id,
    p_expected_version: item.version,
    p_product_name: edit.productName,
    p_quantity: edit.quantity,
    p_unit: edit.unit,
    p_category: edit.category || null,
    p_brand: edit.brand || null,
    p_weight_value: edit.weightValue,
    p_weight_unit: edit.weightValue ? edit.weightUnit : null,
    p_use_by_date: edit.useByDate || null,
    p_best_before_date: edit.bestBeforeDate || null,
    p_frozen_at: edit.frozenAt || null,
    p_notes: edit.notes || null,
  });
  if (error) throw error;
  return toItem(data as Row);
}

/** Moves the whole thing to another place in the household. The move can be undone with its movement id. */
export async function moveItem(item: StockItem, locationId: string): Promise<{ item: StockItem; movementId: string | null }> {
  const { data, error } = await supabase().rpc("move_stock", { p_item: item.id, p_location: locationId, p_expected_version: item.version });
  if (error) throw error;
  const moved = toItem(data as Row);
  return { item: moved, movementId: await latestMovementId(item.id, "move") };
}

/** The household's places, for choosing where to move something. Found from the place it's in now. */
export async function loadPlacesBeside(locationId: string): Promise<{ id: string; name: string; type: LocationType; imagePath: string | null }[]> {
  const here = await supabase().from("storage_locations").select("household_id").eq("id", locationId).maybeSingle();
  if (here.error) throw here.error;
  if (!here.data) return [];
  const places = await loadPlaces(here.data.household_id as string);
  return places.map((p) => ({ id: p.id, name: p.name, type: p.type, imagePath: p.imagePath ?? null }));
}

/** Lends the thing to someone, or marks it back home when `to` is empty. */
export async function lendItem(item: StockItem, to: string | null): Promise<StockItem> {
  const { data, error } = await supabase().rpc("lend_stock", { p_item: item.id, p_to: to?.trim() || null, p_expected_version: item.version });
  if (error) throw error;
  return toItem(data as Row);
}

/** Everything the household has lent out, longest away first. */
export async function loadLent(householdId: string): Promise<StockItem[]> {
  const { data, error } = await supabase()
    .from("stock_items")
    .select(COLUMNS)
    .eq("household_id", householdId)
    .eq("status", "in_stock")
    .not("lent_to", "is", null)
    .order("lent_on")
    .limit(50);
  if (error) throw error;
  return (data ?? []).map(toItem);
}

/** Names things have been lent to before, most recent first, to offer again. Only your households' history is visible. */
export async function loadLendNames(): Promise<string[]> {
  const { data, error } = await supabase()
    .from("stock_movements")
    .select("notes")
    .eq("action", "lend")
    .order("created_at", { ascending: false })
    .limit(40);
  if (error) return [];
  const seen = new Set<string>();
  for (const r of data ?? []) {
    const n = (r.notes as string | null)?.trim();
    if (n && ![...seen].some((s) => s.toLowerCase() === n.toLowerCase())) seen.add(n);
  }
  return [...seen].slice(0, 6);
}

export async function undo(movementId: string): Promise<void> {
  const { error } = await supabase().rpc("undo_movement", { p_movement: movementId });
  if (error) throw error;
}

export type Movement = {
  id: string;
  action: "add" | "remove" | "adjust" | "move" | "undo" | "lend" | "return";
  delta: number;
  after: number;
  actor: string | null;
  at: string;
  /** An edit of the details, rather than a change of amount. */
  edited: boolean;
  /** For moves: where it went. */
  toLocationId: string | null;
  /** For lending: who it went to, or who gave it back. */
  person: string | null;
};

/**
 * Columns added with moving things. The app can be live before that database update is run, so
 * history loads without them until then.
 */
let moveColumns = true;
const MOVE_COLS = ", notes, to_location_id";

async function selectMovements(run: (extra: string) => PromiseLike<{ data: unknown; error: { code?: string } | null }>): Promise<Row[]> {
  let res = await run(moveColumns ? MOVE_COLS : "");
  if (res.error?.code === "42703") {
    moveColumns = false;
    res = await run("");
  }
  if (res.error) throw res.error;
  return (res.data ?? []) as Row[];
}

function movementFields(r: Row) {
  return {
    edited: r.action === "adjust" && r.notes === "edited",
    toLocationId: (r.to_location_id as string | null | undefined) ?? null,
    person: r.action === "lend" || r.action === "return" ? ((r.notes as string | null | undefined) ?? null) : null,
  };
}

export async function loadHistory(itemId: string): Promise<Movement[]> {
  const data = await selectMovements((extra) =>
    supabase()
      .from("stock_movements")
      .select(("id, action, quantity_delta, quantity_after, actor_user_id, created_at" + extra) as string)
      .eq("stock_item_id", itemId)
      .order("created_at", { ascending: false })
      .limit(20),
  );
  return (data ?? []).map((r) => ({
    ...movementFields(r),
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
  const data = await selectMovements((extra) =>
    supabase()
      .from("stock_movements")
      .select(("id, action, quantity_delta, quantity_after, actor_user_id, created_at, stock_item_id, item:stock_items(product_name, unit, location_id)" + extra) as string)
      .eq("household_id", householdId)
      .order("created_at", { ascending: false })
      .limit(limit),
  );
  return (data ?? []).map((r) => {
    const raw = (r as Row).item as Row | Row[] | null;
    const item = Array.isArray(raw) ? raw[0] : raw;
    return {
      ...movementFields(r),
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

/** Things with a printed date inside the "use soon" window, for badges on place cards. */
export async function loadSoon(householdId: string): Promise<{ locationId: string; useByDate: string | null; bestBeforeDate: string | null }[]> {
  const cutoff = addDays(todayIso(), SOON_DAYS);
  const { data, error } = await supabase()
    .from("stock_items")
    .select("location_id, use_by_date, best_before_date")
    .eq("household_id", householdId)
    .eq("status", "in_stock")
    .or(`use_by_date.lte.${cutoff},best_before_date.lte.${cutoff}`)
    .limit(500);
  if (error) throw error;
  return (data ?? []).map((r) => ({
    locationId: r.location_id as string,
    useByDate: (r.use_by_date as string | null) ?? null,
    bestBeforeDate: (r.best_before_date as string | null) ?? null,
  }));
}

/** Who last added or took something from a place, and when. */
export async function loadPlaceLastActivity(locationId: string): Promise<{ actor: string | null; at: string } | null> {
  const { data, error } = await supabase()
    .from("stock_movements")
    .select("actor_user_id, created_at, stock_items!inner(location_id)")
    .eq("stock_items.location_id", locationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? { actor: (data.actor_user_id as string | null) ?? null, at: data.created_at as string } : null;
}

/** Things with a printed date inside the "use soon" window or past it, soonest first. */
export async function loadAttention(householdId: string): Promise<StockItem[]> {
  const cutoff = addDays(todayIso(), SOON_DAYS);
  const { data, error } = await supabase()
    .from("stock_items")
    .select(COLUMNS)
    .eq("household_id", householdId)
    .eq("status", "in_stock")
    .or(`use_by_date.lte.${cutoff},best_before_date.lte.${cutoff}`)
    .limit(500);
  if (error) throw error;
  return sortUseFirst((data ?? []).map(toItem));
}
