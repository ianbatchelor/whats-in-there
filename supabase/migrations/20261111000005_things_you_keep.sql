-- Things you keep: more kinds of place, and lending things out.
--
-- Five more kinds of place for things that are kept rather than used up. Which places are "keep"
-- places is decided by the app from the kind, so no column is needed for it.
alter type public.location_type add value if not exists 'bookshelf';
alter type public.location_type add value if not exists 'toybox';
alter type public.location_type add value if not exists 'desk';
alter type public.location_type add value if not exists 'medicine';
alter type public.location_type add value if not exists 'car';

-- Lending: who has it and since when. Each lend and each return is a row in the history.
alter type public.movement_action add value if not exists 'lend';
alter type public.movement_action add value if not exists 'return';

alter table public.stock_items
  add column lent_to text check (lent_to is null or char_length(lent_to) between 1 and 60),
  add column lent_on date,
  add constraint stock_items_lent_pair check ((lent_to is null) = (lent_on is null));

-- Marks a thing as lent to someone (p_to), or back home when p_to is null or blank.
-- Lending something that's already lent just changes who has it, from today. The history row keeps
-- the person's name: who it went to, or who gave it back.
create function public.lend_stock(p_item uuid, p_to text, p_expected_version int default null)
returns public.stock_items
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.require_user();
  item public.stock_items%rowtype;
  who text := nullif(btrim(regexp_replace(coalesce(p_to, ''), '\s+', ' ', 'g')), '');
  had text;
begin
  select * into item from public.stock_items where id = p_item for update;
  if not found or not public.is_member(item.household_id) or item.status <> 'in_stock' then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if p_expected_version is not null and p_expected_version <> item.version then
    raise exception 'version_conflict' using errcode = '40001';
  end if;
  if char_length(who) > 60 then
    raise exception 'invalid_name' using errcode = '22023';
  end if;
  if who is null and item.lent_to is null then
    return item;
  end if;
  had := item.lent_to;

  update public.stock_items set
    lent_to = who,
    lent_on = case when who is null then null else current_date end,
    version = item.version + 1
  where id = p_item
  returning * into item;

  insert into public.stock_movements (household_id, stock_item_id, actor_user_id, action, quantity_delta, quantity_after, notes)
  values (item.household_id, item.id, uid, (case when who is null then 'return' else 'lend' end)::public.movement_action, 0, item.quantity, coalesce(who, had));

  return item;
end;
$$;

revoke all on function public.lend_stock(uuid, text, int) from public, anon;
grant execute on function public.lend_stock(uuid, text, int) to authenticated;
