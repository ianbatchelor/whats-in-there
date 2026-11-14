import { loadList } from "@/lib/shopping";
import { loadPresents } from "@/lib/presents";
import { loadEntries, loadLists } from "@/lib/ownLists";
import type { ListSources } from "@/lib/domain/search";

/**
 * Everything on the household's lists, loaded once when a search starts. Each part is optional:
 * a list that fails to load is left out rather than stopping the search.
 */
export async function loadListSources(householdId: string | null, me: string, names: Map<string, string>): Promise<ListSources> {
  const none = { lists: [], ideas: [] };
  const [shopping, presents, books, lists] = await Promise.all([
    householdId ? loadList(householdId).catch(() => []) : [],
    householdId ? loadPresents(householdId).catch(() => none) : none,
    householdId ? loadPresents(householdId, "books").catch(() => none) : none,
    loadLists().catch(() => []),
  ]);
  const entries = lists.length > 0 ? await loadEntries(lists.map((l) => l.id)).catch(() => []) : [];
  return { shopping, presents, books, own: { lists, entries }, names, me };
}
