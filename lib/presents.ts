import { supabase } from "@/lib/supabase/client";
import { config } from "@/lib/config";
import type { WishClaim, WishIdea, WishKind, WishList } from "@/lib/domain/presents";

const LIST_COLUMNS = "id, kind, friend, for_user, name, share_code, created_at";
const IDEA_COLUMNS = "id, list_id, title, note, link, price, favourite, image_path, author, isbn, cover_id, suggested_by, added_by, added_at";

function toList(r: Record<string, unknown>): WishList {
  return {
    id: r.id as string,
    kind: r.kind === "books" ? "books" : "presents",
    friend: r.friend === true,
    forUser: (r.for_user as string | null) ?? null,
    name: (r.name as string | null) ?? null,
    shareCode: (r.share_code as string | null) ?? null,
    createdAt: r.created_at as string,
  };
}

function toIdea(r: Record<string, unknown>): WishIdea {
  return {
    id: r.id as string,
    listId: r.list_id as string,
    title: r.title as string,
    note: (r.note as string | null) ?? null,
    link: (r.link as string | null) ?? null,
    price: (r.price as string | null) ?? null,
    favourite: Boolean(r.favourite),
    imagePath: (r.image_path as string | null) ?? null,
    author: (r.author as string | null) ?? null,
    isbn: (r.isbn as string | null) ?? null,
    coverId: typeof r.cover_id === "number" ? r.cover_id : null,
    suggestedBy: (r.suggested_by as string | null) ?? null,
    addedBy: (r.added_by as string | null) ?? null,
    addedAt: r.added_at as string,
  };
}

export type Presents = { lists: WishList[]; ideas: WishIdea[]; claims: WishClaim[] };

/**
 * Everything for the household of one kind: present lists or book wish lists. Claims on your own
 * list never come back: the database hides them.
 */
export async function loadPresents(householdId: string, kind: WishKind = "presents"): Promise<Presents> {
  const db = supabase();
  const [l, i, c] = await Promise.all([
    db.from("wish_lists").select(LIST_COLUMNS).eq("household_id", householdId).eq("kind", kind),
    db.from("wish_ideas").select(IDEA_COLUMNS).eq("household_id", householdId).order("added_at"),
    db.from("wish_claims").select("idea_id, list_id, claimed_by, claimed_name").eq("household_id", householdId),
  ]);
  if (l.error) throw l.error;
  if (i.error) throw i.error;
  if (c.error) throw c.error;
  const lists = (l.data ?? []).map(toList);
  const ids = new Set(lists.map((x) => x.id));
  return {
    lists,
    ideas: (i.data ?? []).map(toIdea).filter((x) => ids.has(x.listId)),
    claims: (c.data ?? [])
      .filter((r) => ids.has(r.list_id as string))
      .map((r) => ({ ideaId: r.idea_id as string, claimedBy: (r.claimed_by as string | null) ?? null, claimedName: (r.claimed_name as string | null) ?? null })),
  };
}

/** How many ideas (or books) there are, for the Home card. */
export async function countIdeas(householdId: string, kind: WishKind = "presents"): Promise<number> {
  const db = supabase();
  const l = await db.from("wish_lists").select("id").eq("household_id", householdId).eq("kind", kind);
  if (l.error) throw l.error;
  const ids = (l.data ?? []).map((r) => r.id as string);
  if (ids.length === 0) return 0;
  const { count, error } = await db.from("wish_ideas").select("id", { count: "exact", head: true }).eq("household_id", householdId).in("list_id", ids);
  if (error) throw error;
  return count ?? 0;
}

/** A household member's list, made the first time something goes on it. */
export async function ensureList(householdId: string, forUser: string, kind: WishKind = "presents"): Promise<WishList> {
  const db = supabase();
  const found = await db.from("wish_lists").select(LIST_COLUMNS).eq("household_id", householdId).eq("kind", kind).eq("for_user", forUser).maybeSingle();
  if (found.error) throw found.error;
  if (found.data) return toList(found.data);
  const { data, error } = await db.from("wish_lists").insert({ household_id: householdId, for_user: forUser, kind }).select(LIST_COLUMNS).single();
  if (error) {
    // Someone else made it a moment ago.
    if ((error as { code?: string }).code === "23505") return ensureList(householdId, forUser, kind);
    throw error;
  }
  return toList(data);
}

/** A list for someone without an account, such as a child. */
export async function addNamedList(householdId: string, name: string, kind: WishKind = "presents"): Promise<WishList> {
  const { data, error } = await supabase()
    .from("wish_lists")
    .insert({ household_id: householdId, name: name.trim().slice(0, 60), kind })
    .select(LIST_COLUMNS)
    .single();
  if (error) throw error;
  return toList(data);
}

export async function renameList(id: string, name: string): Promise<void> {
  const { error } = await supabase().from("wish_lists").update({ name: name.trim().slice(0, 60) }).eq("id", id);
  if (error) throw error;
}

export async function removeList(id: string): Promise<void> {
  const { error } = await supabase().from("wish_lists").delete().eq("id", id);
  if (error) throw error;
}

export type IdeaInput = {
  title: string;
  note: string | null;
  link: string | null;
  price: string | null;
  favourite: boolean;
  imagePath?: string | null;
  /** Books only. */
  author?: string | null;
  isbn?: string | null;
  coverId?: number | null;
};

function ideaRow(input: Partial<IdeaInput>) {
  const { imagePath, author, isbn, coverId, ...rest } = input;
  return {
    ...rest,
    ...(imagePath === undefined ? {} : { image_path: imagePath }),
    ...(author === undefined ? {} : { author: author?.trim().slice(0, 120) || null }),
    ...(isbn === undefined ? {} : { isbn }),
    ...(coverId === undefined ? {} : { cover_id: coverId }),
  };
}

export async function addIdea(householdId: string, listId: string, input: IdeaInput): Promise<void> {
  const { error } = await supabase()
    .from("wish_ideas")
    .insert({ household_id: householdId, list_id: listId, ...ideaRow(input), title: input.title.trim() });
  if (error) throw error;
}

export async function updateIdea(id: string, input: Partial<IdeaInput>): Promise<void> {
  const { error } = await supabase().from("wish_ideas").update(ideaRow(input)).eq("id", id);
  if (error) throw error;
}

/** The web address of an idea's picture. The bucket is public: these are shops' own product pictures. */
export function wishPictureUrl(path: string): string {
  return `${config.supabaseUrl.replace(/\/+$/, "")}/storage/v1/object/public/wish-pictures/${path}`;
}

export type LinkReading = { shop: string; title: string | null; titleFromLink: boolean; price: string | null; imagePath: string | null; partial: boolean };
export type LinkResult = { ok: true; reading: LinkReading } | { ok: false; code: string; shop?: string };

/** Asks the read-link function for a shop page's name, price and picture. Nothing is saved here. */
export async function readLink(householdId: string, url: string): Promise<LinkResult> {
  const { data, error } = await supabase().functions.invoke("read-link", { body: { householdId, url } });
  if (error) {
    const ctx = (error as { context?: unknown }).context;
    if (ctx instanceof Response) {
      if (ctx.status === 404) return { ok: false, code: "not_configured" };
      try {
        const body = await ctx.json();
        return { ok: false, code: String(body?.error ?? "failed"), shop: typeof body?.shop === "string" ? body.shop : undefined };
      } catch {
        return { ok: false, code: "failed" };
      }
    }
    return { ok: false, code: "failed" };
  }
  const r = data as Record<string, unknown> | null;
  if (!r || typeof r.shop !== "string") return { ok: false, code: "failed" };
  const path = typeof r.imagePath === "string" && /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp|gif)$/.test(r.imagePath) ? r.imagePath : null;
  return {
    ok: true,
    reading: {
      shop: r.shop,
      title: typeof r.title === "string" && r.title.trim() ? r.title.trim().slice(0, 120) : null,
      titleFromLink: r.titleFromLink === true,
      price: typeof r.price === "string" ? r.price.slice(0, 30) : null,
      imagePath: path,
      partial: r.partial === true,
    },
  };
}

export async function removeIdea(id: string): Promise<void> {
  const { error } = await supabase().from("wish_ideas").delete().eq("id", id);
  if (error) throw error;
}

/** "I'm getting this", from inside the household. */
export async function claimIdea(idea: { id: string; listId: string }, householdId: string): Promise<void> {
  const { error } = await supabase().from("wish_claims").insert({ idea_id: idea.id, list_id: idea.listId, household_id: householdId });
  if (error) throw (error as { code?: string }).code === "23505" ? new Error("already_taken") : error;
}

export async function unclaimIdea(ideaId: string): Promise<void> {
  const { error } = await supabase().from("wish_claims").delete().eq("idea_id", ideaId);
  if (error) throw error;
}

/** The private link code for sharing a list with family outside the household. */
export async function shareList(listId: string): Promise<string> {
  const { data, error } = await supabase().rpc("share_wish_list", { p_list: listId });
  if (error) throw error;
  return data as string;
}

export async function unshareList(listId: string): Promise<void> {
  const { error } = await supabase().rpc("unshare_wish_list", { p_list: listId });
  if (error) throw error;
}

// ---------- The shared page, for people without an account ----------

export type SharedIdea = {
  id: string;
  title: string;
  note: string | null;
  link: string | null;
  price: string | null;
  favourite: boolean;
  imagePath?: string | null;
  author?: string | null;
  coverId?: number | null;
  suggestedBy?: string | null;
  taken: boolean;
  takenBy: string | null;
};
export type SharedList = { name: string; kind?: WishKind; friend?: boolean; ideas: SharedIdea[] };

export async function loadShared(code: string): Promise<SharedList | null> {
  const { data, error } = await supabase().rpc("shared_wish_list", { p_code: code });
  if (error) throw error;
  return (data as SharedList | null) ?? null;
}

/** Returns a secret this browser keeps, so the same person can take it back later. */
export async function claimShared(code: string, ideaId: string, name: string): Promise<string> {
  const { data, error } = await supabase().rpc("claim_shared_wish", { p_code: code, p_idea: ideaId, p_name: name.trim() });
  if (error) throw error;
  return data as string;
}

export async function unclaimShared(code: string, ideaId: string, token: string): Promise<void> {
  const { error } = await supabase().rpc("unclaim_shared_wish", { p_code: code, p_idea: ideaId, p_token: token });
  if (error) throw error;
}

// ---------- Friends' own book lists, from a share link, with no account ----------

export type NewBook = { title: string; author: string | null; isbn: string | null; coverId: number | null };

/** Starts a friend's own list beside the one they were sent. Returns its link code and the key this browser keeps. */
export async function startFriendList(code: string, name: string): Promise<{ code: string; key: string }> {
  const { data, error } = await supabase().rpc("start_friend_book_list", { p_code: code, p_name: name.trim() });
  if (error) throw error;
  const r = data as { code?: unknown; key?: unknown } | null;
  if (typeof r?.code !== "string" || typeof r?.key !== "string") throw new Error("failed");
  return { code: r.code, key: r.key };
}

export async function addFriendBook(code: string, key: string, b: NewBook): Promise<void> {
  const { error } = await supabase().rpc("add_friend_book", { p_code: code, p_key: key, p_title: b.title, p_author: b.author, p_isbn: b.isbn, p_cover: b.coverId });
  if (error) throw error;
}

export async function removeFriendBook(code: string, key: string, ideaId: string): Promise<void> {
  const { error } = await supabase().rpc("remove_friend_book", { p_code: code, p_key: key, p_idea: ideaId });
  if (error) throw error;
}

export async function removeFriendList(code: string, key: string): Promise<void> {
  const { error } = await supabase().rpc("remove_friend_book_list", { p_code: code, p_key: key });
  if (error) throw error;
}

/** "Suggest a book" for the list someone was sent, with their first name. */
export async function suggestBook(code: string, name: string, b: NewBook): Promise<void> {
  const { error } = await supabase().rpc("suggest_shared_book", { p_code: code, p_name: name.trim(), p_title: b.title, p_author: b.author, p_isbn: b.isbn, p_cover: b.coverId });
  if (error) throw error;
}
