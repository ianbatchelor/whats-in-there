import { supabase } from "@/lib/supabase/client";

/** "Opened one. How was it?": stars and a few words, kept by wine and vintage so they outlive the bottles. */
export type WineNote = {
  id: string;
  stars: number | null;
  note: string | null;
  notedBy: string | null;
  notedAt: string;
};

/** Notes for this wine (any spelling of capitals) and vintage, newest first. */
export async function loadWineNotes(householdId: string, wineName: string, vintage: number | null | undefined): Promise<WineNote[]> {
  let q = supabase()
    .from("wine_notes")
    .select("id, stars, note, noted_by, noted_at")
    .eq("household_id", householdId)
    .ilike("wine_name", wineName.trim().replace(/[\\%_]/g, (c) => `\\${c}`));
  q = vintage ? q.eq("vintage", vintage) : q.is("vintage", null);
  const { data, error } = await q.order("noted_at", { ascending: false }).limit(20);
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id as string,
    stars: (r.stars as number | null) ?? null,
    note: (r.note as string | null) ?? null,
    notedBy: (r.noted_by as string | null) ?? null,
    notedAt: r.noted_at as string,
  }));
}

export async function addWineNote(householdId: string, wineName: string, vintage: number | null | undefined, stars: number | null, note: string): Promise<void> {
  const { data: auth } = await supabase().auth.getSession();
  const uid = auth.session?.user.id;
  if (!uid) throw new Error("not_signed_in");
  const { error } = await supabase()
    .from("wine_notes")
    .insert({
      household_id: householdId,
      wine_name: wineName.trim().slice(0, 120),
      vintage: vintage ?? null,
      stars,
      note: note.trim().slice(0, 500) || null,
      noted_by: uid,
    });
  if (error) throw error;
}

export async function removeWineNote(id: string): Promise<void> {
  const { error } = await supabase().from("wine_notes").delete().eq("id", id);
  if (error) throw error;
}
