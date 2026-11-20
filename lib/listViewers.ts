import { supabase } from "@/lib/supabase/client";
import { publicOrigin } from "@/lib/config";
import { listInviteUrl } from "@/lib/domain/listViewers";

/** Postgres/PostgREST: the function isn't there (the app can ship before its database change). */
function missingFunction(error: { code?: string } | null): boolean {
  return error?.code === "PGRST202" || error?.code === "42883";
}

export type InviteResult = { link: string; emailed: boolean };

/**
 * Invites someone by email into the app for one present list. The invite-to-list function makes the
 * invitation and emails it; if it can't send email, the link comes back to send by hand. If the
 * function isn't there at all, the invitation is made directly and only the link comes back.
 */
export async function inviteToList(listId: string, email: string): Promise<InviteResult> {
  const { data, error } = await supabase().functions.invoke("invite-to-list", { body: { listId, email } });
  if (!error) {
    const r = data as { token?: unknown; emailed?: unknown } | null;
    if (typeof r?.token === "string") return { link: listInviteUrl(publicOrigin(), r.token), emailed: r.emailed === true };
    throw new Error("failed");
  }
  const ctx = (error as { context?: unknown }).context;
  if (ctx instanceof Response && ctx.status !== 404) {
    let code = "failed";
    try {
      code = String((await ctx.json())?.error ?? "failed");
    } catch {
      /* not JSON */
    }
    throw new Error(code);
  }
  // No email function yet: make the invitation directly; they send the link themselves.
  const { data: token, error: rpcError } = await supabase().rpc("invite_to_wish_list", { p_list: listId, p_email: email });
  if (rpcError) throw rpcError;
  return { link: listInviteUrl(publicOrigin(), token as string), emailed: false };
}

export type ListPerson = { userId: string | null; inviteId: string | null; label: string; at: string };

/** Who can see a list, and invitations still waiting. */
export async function loadListPeople(listId: string): Promise<ListPerson[]> {
  const { data, error } = await supabase().rpc("wish_list_people", { p_list: listId });
  if (missingFunction(error)) return [];
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    userId: (r.user_id as string | null) ?? null,
    inviteId: (r.invite_id as string | null) ?? null,
    label: r.label as string,
    at: r.at as string,
  }));
}

export async function removeListViewer(listId: string, userId: string): Promise<void> {
  const { error } = await supabase().rpc("remove_wish_list_viewer", { p_list: listId, p_user: userId });
  if (error) throw error;
}

export async function cancelListInvite(inviteId: string): Promise<void> {
  const { error } = await supabase().rpc("cancel_wish_list_invite", { p_invite: inviteId });
  if (error) throw error;
}

export type ListInvitePreview = { name: string; household: string; invitedBy: string; emailHint: string };

export async function previewListInvite(token: string): Promise<ListInvitePreview | null> {
  const { data, error } = await supabase().rpc("wish_list_invite_preview", { p_token: token });
  if (error) throw error;
  const r = ((data ?? []) as Record<string, unknown>[])[0];
  if (!r) return null;
  return { name: r.name as string, household: r.household as string, invitedBy: r.invited_by as string, emailHint: r.email_hint as string };
}

export async function joinList(token: string): Promise<string> {
  const { data, error } = await supabase().rpc("join_wish_list", { p_token: token });
  if (error) throw error;
  return data as string;
}

export type SharedPresentList = { id: string; name: string; household: string; sharedBy: string; free: number };

/** Present lists in other households that someone has let you into. */
export async function loadListsSharedWithMe(): Promise<SharedPresentList[]> {
  const { data, error } = await supabase().rpc("wish_lists_shared_with_me");
  if (missingFunction(error)) return [];
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    id: r.id as string,
    name: r.name as string,
    household: r.household as string,
    sharedBy: r.shared_by as string,
    free: (r.free as number) ?? 0,
  }));
}

export type ViewerIdea = {
  id: string;
  title: string;
  note: string | null;
  link: string | null;
  price: string | null;
  favourite: boolean;
  imagePath: string | null;
  /** You're getting this one. */
  mine: boolean;
};
export type ViewerList = { name: string; household: string; hidden: number; ideas: ViewerIdea[] };

/** One list as someone let into it sees it. Null when they aren't (or no longer) let in. */
export async function loadViewerList(listId: string): Promise<ViewerList | null> {
  const { data, error } = await supabase().rpc("viewer_wish_list", { p_list: listId });
  if (error) throw error;
  return (data as ViewerList | null) ?? null;
}

export async function viewerClaim(listId: string, ideaId: string): Promise<void> {
  const { error } = await supabase().rpc("viewer_claim_wish", { p_list: listId, p_idea: ideaId });
  if (error) throw error;
}

export async function viewerUnclaim(listId: string, ideaId: string): Promise<void> {
  const { error } = await supabase().rpc("viewer_unclaim_wish", { p_list: listId, p_idea: ideaId });
  if (error) throw error;
}
