-- Edit a thing after it's been added, and move it to another place in the same household.
-- Like adding and taking out, both go through security-definer functions that check membership and
-- write a history row, so the household can see who changed what. Moves can be undone.

alter table public.stock_movements
  add column from_location_id uuid references public.storage_locations (id) on delete set null,
  add column to_location_id   uuid references public.storage_locations (id) on delete set null;

-- Replaces every editable detail of a thing that's still in stock. A change of amount is kept in the
-- history as an 'adjust' with the difference; a change of other details is an 'adjust' of zero, marked edited.
create function public.update_stock_item(
  p_item             uuid,
  p_expected_version int,
  p_product_name     text,
  p_quantity         numeric,
  p_unit             public.stock_unit,
  p_category         text default null,
  p_brand            text default null,
  p_weight_value     numeric default null,
  p_weight_unit      public.stock_unit default null,
  p_use_by_date      date default null,
  p_best_before_date date default null,
  p_frozen_at        date default null,
  p_notes            text default null
)
returns public.stock_items
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.require_user();
  item public.stock_items%rowtype;
  before_qty numeric;
begin
  select * into item from public.stock_items where id = p_item for update;
  if not found or not public.is_member(item.household_id) or item.status <> 'in_stock' then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if p_expected_version is not null and p_expected_version <> item.version then
    raise exception 'version_conflict' using errcode = '40001';
  end if;
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;
  if coalesce(btrim(p_product_name), '') = '' then
    raise exception 'invalid_name' using errcode = '22023';
  end if;
  before_qty := item.quantity;

  update public.stock_items set
    product_name     = btrim(p_product_name),
    category         = nullif(btrim(p_category), ''),
    brand            = nullif(btrim(p_brand), ''),
    quantity         = p_quantity,
    unit             = p_unit,
    weight_value     = case when p_weight_unit is null then null else p_weight_value end,
    weight_unit      = case when p_weight_value is null then null else p_weight_unit end,
    use_by_date      = p_use_by_date,
    best_before_date = p_best_before_date,
    frozen_at        = p_frozen_at,
    notes            = nullif(btrim(p_notes), ''),
    version          = item.version + 1
  where id = p_item
  returning * into item;

  insert into public.stock_movements (household_id, stock_item_id, actor_user_id, action, quantity_delta, quantity_after, notes)
  values (item.household_id, item.id, uid, 'adjust', item.quantity - before_qty, item.quantity, 'edited');

  return item;
end;
$$;

-- Moves a whole thing to another place in the same household. Going into a freezer starts the
-- "frozen on" date if it didn't have one; the date is otherwise left as it was.
create function public.move_stock(p_item uuid, p_location uuid, p_expected_version int default null)
returns public.stock_items
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.require_user();
  item public.stock_items%rowtype;
  loc public.storage_locations%rowtype;
  from_loc uuid;
begin
  select * into item from public.stock_items where id = p_item for update;
  if not found or not public.is_member(item.household_id) or item.status <> 'in_stock' then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if p_expected_version is not null and p_expected_version <> item.version then
    raise exception 'version_conflict' using errcode = '40001';
  end if;
  select * into loc from public.storage_locations where id = p_location;
  if not found or loc.household_id <> item.household_id or loc.archived_at is not null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if loc.id = item.location_id then
    return item;
  end if;
  from_loc := item.location_id;

  update public.stock_items set
    location_id = loc.id,
    frozen_at   = case when loc.type = 'freezer' then coalesce(item.frozen_at, current_date) else item.frozen_at end,
    version     = item.version + 1
  where id = p_item
  returning * into item;

  insert into public.stock_movements (household_id, stock_item_id, actor_user_id, action, quantity_delta, quantity_after, from_location_id, to_location_id)
  values (item.household_id, item.id, uid, 'move', 0, item.quantity, from_loc, loc.id);

  return item;
end;
$$;

-- Same as before, plus: a move can be undone by moving the thing back, if it's still where it was moved to.
create or replace function public.undo_movement(p_movement uuid)
returns public.stock_items
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.require_user();
  mv public.stock_movements%rowtype;
  item public.stock_items%rowtype;
  new_qty numeric;
begin
  select * into mv from public.stock_movements where id = p_movement for update;
  if not found or not public.is_member(mv.household_id) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  -- An edit replaces details that aren't kept in the history, so it can't be reversed from here.
  if mv.action not in ('add', 'remove', 'adjust', 'move') or (mv.action = 'adjust' and mv.notes = 'edited') then
    raise exception 'cannot_undo' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.stock_movements where reverses_movement_id = mv.id) then
    raise exception 'already_undone' using errcode = 'P0001';
  end if;

  select * into item from public.stock_items where id = mv.stock_item_id for update;

  if mv.action = 'move' then
    if item.status <> 'in_stock' or item.location_id is distinct from mv.to_location_id
       or not exists (select 1 from public.storage_locations
                      where id = mv.from_location_id and household_id = item.household_id and archived_at is null) then
      raise exception 'cannot_undo' using errcode = 'P0001';
    end if;
    update public.stock_items set location_id = mv.from_location_id, version = item.version + 1
    where id = item.id
    returning * into item;
    insert into public.stock_movements (household_id, stock_item_id, actor_user_id, action, quantity_delta, quantity_after,
                                        reverses_movement_id, from_location_id, to_location_id)
    values (item.household_id, item.id, uid, 'undo', 0, item.quantity, mv.id, mv.to_location_id, mv.from_location_id);
    return item;
  end if;

  new_qty := item.quantity - mv.quantity_delta;
  if new_qty < 0 then
    raise exception 'cannot_undo' using errcode = 'P0001';
  end if;

  update public.stock_items set
    quantity = new_qty,
    status   = case when new_qty > 0 then 'in_stock'::public.stock_status
                    when mv.action = 'add' then 'discarded'::public.stock_status
                    else 'used_up'::public.stock_status end,
    version  = item.version + 1
  where id = item.id
  returning * into item;

  insert into public.stock_movements (household_id, stock_item_id, actor_user_id, action, quantity_delta, quantity_after, reverses_movement_id)
  values (item.household_id, item.id, uid, 'undo', -mv.quantity_delta, item.quantity, mv.id);

  return item;
end;
$$;

revoke all on function
  public.update_stock_item(uuid, int, text, numeric, public.stock_unit, text, text, numeric, public.stock_unit, date, date, date, text),
  public.move_stock(uuid, uuid, int)
from public, anon;

grant execute on function
  public.update_stock_item(uuid, int, text, numeric, public.stock_unit, text, text, numeric, public.stock_unit, date, date, date, text),
  public.move_stock(uuid, uuid, int)
to authenticated;
