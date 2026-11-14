import { supabase } from "@/lib/supabase/client";
import type { ListEntry, ListKind, ListVisibility, OwnList } from "@/lib/domain/ownLists";

const LIST_COLUMNS = "id, owner, household_id, title, kind, visibility, created_at";
const ENTRY_COLUMNS = "id, list_id, text, note, added_by, added_at, done_at, done_by";

function toList(r: Record<string, unknown>): OwnList {
  return {
    id: r.id as string,
    owner: r.owner as string,
    householdId: (r.household_id as string | null) ?? null,
    title: r.title as string,
    kind: r.kind as ListKind,
    visibility: r.visibility as ListVisibility,
    createdAt: r.created_at as string,
  };
}

function toEntry(r: Record<string, unknown>): ListEntry {
  return {
    id: r.id as string,
    listId: r.list_id as string,
    text: r.text as string,
    note: (r.note as string | null) ?? null,
    addedBy: (r.added_by as string | null) ?? null,
    addedAt: r.added_at as string,
    doneAt: (r.done_at as string | null) ?? null,
    doneBy: (r.done_by as string | null) ?? null,
  };
}

/** Every list the signed-in person can see. The database only ever returns those. */
export async function loadLists(): Promise<OwnList[]> {
  const { data, error } = await supabase().from("lists").select(LIST_COLUMNS).order("created_at");
  if (error) throw error;
  return (data ?? []).map(toList);
}

export async function loadList(id: string): Promise<OwnList | null> {
  const { data, error } = await supabase().from("lists").select(LIST_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? toList(data) : null;
}

/** Entries on several lists at once, for the Lists tab. */
export async function loadEntries(listIds: string[]): Promise<ListEntry[]> {
  if (listIds.length === 0) return [];
  const { data, error } = await supabase().from("list_entries").select(ENTRY_COLUMNS).in("list_id", listIds).order("added_at");
  if (error) throw error;
  return (data ?? []).map(toEntry);
}

export type ListSettings = {
  title: string;
  kind: ListKind;
  visibility: ListVisibility;
  householdId: string;
};

const settingsRow = (s: ListSettings) => ({
  title: s.title.trim(),
  kind: s.kind,
  visibility: s.visibility,
  // Only a shared list belongs to a household, so a private one goes with you everywhere.
  household_id: s.visibility === "household" ? s.householdId : null,
});

export async function createList(s: ListSettings): Promise<string> {
  const { data, error } = await supabase().from("lists").insert(settingsRow(s)).select("id").single();
  if (error) throw error;
  return data.id as string;
}

export async function updateList(id: string, s: ListSettings): Promise<void> {
  const { error } = await supabase().from("lists").update(settingsRow(s)).eq("id", id);
  if (error) throw error;
}

export async function deleteList(id: string): Promise<void> {
  const { error } = await supabase().from("lists").delete().eq("id", id);
  if (error) throw error;
}

export async function addEntry(listId: string, text: string, note: string | null = null, doneAt: string | null = null): Promise<void> {
  const { error } = await supabase().from("list_entries").insert({ list_id: listId, text: text.trim(), note, done_at: doneAt });
  if (error) throw error;
}

export async function setDone(id: string, done: boolean): Promise<void> {
  const { error } = await supabase()
    .from("list_entries")
    .update({ done_at: done ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) throw error;
}

export async function updateEntry(id: string, text: string, note: string | null): Promise<void> {
  const { error } = await supabase().from("list_entries").update({ text: text.trim(), note }).eq("id", id);
  if (error) throw error;
}

export async function removeEntries(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await supabase().from("list_entries").delete().in("id", ids);
  if (error) throw error;
}
