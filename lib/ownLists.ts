import { supabase } from "@/lib/supabase/client";
import type { ListEntry, ListKind, ListPerson, ListVisibility, OwnList } from "@/lib/domain/ownLists";

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
  householdId: string | null;
};

const settingsRow = (s: ListSettings) => ({
  title: s.title.trim(),
  kind: s.kind,
  visibility: s.visibility,
  // Only a shared list belongs to a household, so a private one goes with you everywhere.
  household_id: s.visibility === "household" || s.visibility === "family" ? s.householdId : null,
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

/** Names of everyone on the group lists you can see, owner included. */
export async function loadPeople(): Promise<ListPerson[]> {
  const { data, error } = await supabase().rpc("list_people");
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    listId: r.list_id as string,
    userId: r.user_id as string,
    name: r.display_name as string,
    isOwner: r.is_owner as boolean,
  }));
}

/** Makes it a group list with a fresh invitation link. Any earlier link stops working. */
export async function makeLink(listId: string): Promise<{ token: string; expiresAt: string }> {
  const { data, error } = await supabase().rpc("make_list_link", { p_list: listId });
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as { token: string; expires_at: string };
  return { token: row.token, expiresAt: row.expires_at };
}

export async function stopLink(listId: string): Promise<void> {
  const { error } = await supabase().rpc("stop_list_link", { p_list: listId });
  if (error) throw error;
}

/** When the list's link runs out, or null if there isn't one. Owner only. */
export async function linkExpiry(listId: string): Promise<string | null> {
  const { data, error } = await supabase().rpc("list_link_status", { p_list: listId });
  if (error) throw error;
  return (data as string | null) ?? null;
}

export type InvitePreview = { title: string; ownerName: string; things: number; people: number };

/** What the invite page shows, signed in or not. Null for a wrong, stopped or expired link. */
export async function previewInvite(token: string): Promise<InvitePreview | null> {
  const { data, error } = await supabase().rpc("list_invite_preview", { p_token: token });
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | undefined;
  return row ? { title: row.title as string, ownerName: row.owner_name as string, things: row.things as number, people: row.people as number } : null;
}

export async function joinList(token: string): Promise<string> {
  const { data, error } = await supabase().rpc("join_list", { p_token: token });
  if (error) throw error;
  return data as string;
}

/** Leave a group list, or (as its owner) take someone out of it. */
export async function removeMember(listId: string, userId: string): Promise<void> {
  const { error } = await supabase().from("list_members").delete().eq("list_id", listId).eq("user_id", userId);
  if (error) throw error;
}
