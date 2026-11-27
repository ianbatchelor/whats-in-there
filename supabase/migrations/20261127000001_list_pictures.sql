-- A picture for your own lists: Drinks, Meal plan, Garden jobs and so on.
-- One optional word on the list itself; the app knows which picture each word means, so adding
-- pictures later needs no change here. Nothing else changes: who can see a list, its entries and
-- sharing all work exactly as before. Lists made before this have no picture (null).

alter table public.lists
  add column if not exists category text
  constraint lists_category_word check (category is null or category ~ '^[a-z-]{1,24}$');

-- People set it when they make or change a list, like the other settings.
grant insert (category), update (category) on public.lists to authenticated;
