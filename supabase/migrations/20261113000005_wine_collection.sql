-- Wine collection: wine details on each bottle, and tasting notes that stay after the last bottle goes.
-- Safe to run once. Adds new things only; nothing existing changes.

-- 1. Wine details on things in a wine rack (all optional).
alter table public.stock_items
  add column vintage     smallint check (vintage is null or vintage between 1900 and 2100),
  add column wine_colour text check (wine_colour is null or wine_colour in ('red', 'white', 'rose', 'sparkling', 'sweet', 'fortified')),
  add column grape       text check (grape is null or char_length(grape) <= 80),
  add column region      text check (region is null or char_length(region) <= 80),
  add column drink_from  smallint check (drink_from is null or drink_from between 1900 and 2200),
  add column drink_until smallint check (drink_until is null or drink_until between 1900 and 2200),
  add column saved_for   text check (saved_for is null or char_length(saved_for) between 1 and 60),
  add constraint stock_items_drink_window check (drink_from is null or drink_until is null or drink_from <= drink_until);

-- Sets a bottle's wine details. Blank text clears a field.
create function public.set_wine_details(
  p_item uuid, p_vintage int, p_colour text, p_grape text, p_region text,
  p_drink_from int, p_drink_until int, p_saved_for text, p_expected_version int default null)
returns public.stock_items
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.require_user();
  item public.stock_items%rowtype;
begin
  select * into item from public.stock_items where id = p_item for update;
  if not found or not public.is_member(item.household_id) or item.status <> 'in_stock' then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if p_expected_version is not null and p_expected_version <> item.version then
    raise exception 'version_conflict' using errcode = '40001';
  end if;

  update public.stock_items set
    vintage     = p_vintage,
    wine_colour = nullif(btrim(coalesce(p_colour, '')), ''),
    grape       = nullif(btrim(coalesce(p_grape, '')), ''),
    region      = nullif(btrim(coalesce(p_region, '')), ''),
    drink_from  = p_drink_from,
    drink_until = p_drink_until,
    saved_for   = nullif(btrim(coalesce(p_saved_for, '')), ''),
    version     = item.version + 1
  where id = p_item
  returning * into item;

  return item;
end;
$$;

revoke all on function public.set_wine_details(uuid, int, text, text, text, int, int, text, int) from public, anon;
grant execute on function public.set_wine_details(uuid, int, text, text, text, int, int, text, int) to authenticated;

-- 2. Tasting notes: "Opened one. How was it?" Kept by wine name and vintage, so they outlive the bottles.
create table public.wine_notes (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households on delete cascade,
  wine_name    text not null check (char_length(btrim(wine_name)) between 1 and 120),
  vintage      smallint check (vintage is null or vintage between 1900 and 2100),
  stars        smallint check (stars is null or stars between 1 and 5),
  note         text check (note is null or char_length(note) <= 500),
  noted_by     uuid references auth.users on delete set null,
  noted_at     timestamptz not null default now(),
  check (stars is not null or note is not null)
);
create index wine_notes_wine_idx on public.wine_notes (household_id, lower(wine_name), vintage);

alter table public.wine_notes enable row level security;
grant select, insert, delete on public.wine_notes to authenticated;
create policy wine_notes_select on public.wine_notes for select to authenticated
  using (public.is_member(household_id));
create policy wine_notes_insert on public.wine_notes for insert to authenticated
  with check (public.is_member(household_id) and noted_by = (select auth.uid()));
create policy wine_notes_delete on public.wine_notes for delete to authenticated
  using (public.is_member(household_id) and noted_by = (select auth.uid()));
