-- Functions the app calls through supabase.rpc(). Each one checks membership itself,
-- runs in one transaction, and raises a short machine-readable code the app turns into plain English:
--   not_signed_in, not_found, not_owner, invalid_amount, insufficient_quantity, version_conflict,
--   already_undone, cannot_undo, invitation_invalid, invitation_expired, invitation_used, last_owner

create function public.require_user()
returns uuid
language plpgsql
stable
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null then
    raise exception 'not_signed_in' using errcode = '28000';
  end if;
  return uid;
end;
$$;

-- ---------- Households ----------

create function public.create_household(p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.require_user();
  hid uuid;
begin
  insert into public.households (name, created_by) values (btrim(p_name), uid) returning id into hid;
  insert into public.household_members (household_id, user_id, role) values (hid, uid, 'owner');
  return hid;
end;
$$;

create function public.create_invitation(p_household uuid, p_role public.member_role default 'member')
returns table (invitation_id uuid, token text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.require_user();
  raw text;
begin
  if not public.is_owner(p_household) then
    raise exception 'not_owner' using errcode = '42501';
  end if;
  raw := translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/=', '-_');
  return query
    insert into public.household_invitations as i (household_id, role, token_hash, created_by)
    values (p_household, p_role, encode(extensions.digest(raw, 'sha256'), 'hex'), uid)
    returning i.id, raw, i.expires_at;
end;
$$;

create function public.accept_invitation(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.require_user();
  inv public.household_invitations%rowtype;
begin
  select * into inv from public.household_invitations
  where token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex')
  for update;

  if not found or inv.revoked_at is not null then
    raise exception 'invitation_invalid' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.household_members where household_id = inv.household_id and user_id = uid) then
    return inv.household_id;   -- already in; don't burn the link
  end if;
  if inv.used_at is not null then
    raise exception 'invitation_used' using errcode = 'P0001';
  end if;
  if inv.expires_at <= now() then
    raise exception 'invitation_expired' using errcode = 'P0001';
  end if;

  insert into public.household_members (household_id, user_id, role) values (inv.household_id, uid, inv.role);
  update public.household_invitations set used_at = now(), used_by = uid where id = inv.id;
  return inv.household_id;
end;
$$;

create function public.revoke_invitation(p_invitation uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  hid uuid;
begin
  perform public.require_user();
  select household_id into hid from public.household_invitations where id = p_invitation;
  if hid is null or not public.is_owner(hid) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  update public.household_invitations set revoked_at = now() where id = p_invitation and revoked_at is null;
end;
$$;

create function public.remove_member(p_household uuid, p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.require_user();
begin
  if p_user = uid then
    perform public.leave_household(p_household);
    return;
  end if;
  if not public.is_owner(p_household) then
    raise exception 'not_owner' using errcode = '42501';
  end if;
  delete from public.household_members where household_id = p_household and user_id = p_user;
end;
$$;

create function public.leave_household(p_household uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.require_user();
  me public.household_members%rowtype;
  members int;
  owners int;
begin
  select * into me from public.household_members where household_id = p_household and user_id = uid for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  select count(*), count(*) filter (where role = 'owner') into members, owners
  from public.household_members where household_id = p_household;

  if members = 1 then
    delete from public.households where id = p_household;       -- last one out: household goes too
  elsif me.role = 'owner' and owners = 1 then
    raise exception 'last_owner' using errcode = 'P0001';       -- hand over ownership first
  else
    delete from public.household_members where household_id = p_household and user_id = uid;
  end if;
end;
$$;

create function public.set_member_role(p_household uuid, p_user uuid, p_role public.member_role)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_user();
  if not public.is_owner(p_household) then
    raise exception 'not_owner' using errcode = '42501';
  end if;
  if p_role = 'member' and (select count(*) from public.household_members
       where household_id = p_household and role = 'owner' and user_id <> p_user) = 0 then
    raise exception 'last_owner' using errcode = 'P0001';
  end if;
  update public.household_members set role = p_role where household_id = p_household and user_id = p_user;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
end;
$$;

-- ---------- Locations and sticker links ----------

create function public.resolve_location_code(p_code text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  -- Same answer (null) for an unknown code and for someone else's location.
  select l.id from public.storage_locations l
  where l.link_code = p_code and l.archived_at is null and public.is_member(l.household_id);
$$;

create function public.rotate_location_code(p_location uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  hid uuid;
  code text;
begin
  perform public.require_user();
  select household_id into hid from public.storage_locations where id = p_location for update;
  if hid is null or not public.is_member(hid) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if not public.is_owner(hid) then
    raise exception 'not_owner' using errcode = '42501';
  end if;
  update public.storage_locations set link_code = public.generate_link_code()
  where id = p_location returning link_code into code;
  return code;
end;
$$;

-- ---------- Inventory ----------

create function public.add_stock(
  p_location         uuid,
  p_product_name     text,
  p_quantity         numeric,
  p_unit             public.stock_unit default 'item',
  p_category         text default null,
  p_brand            text default null,
  p_weight_value     numeric default null,
  p_weight_unit      public.stock_unit default null,
  p_use_by_date      date default null,
  p_best_before_date date default null,
  p_frozen_at        date default null,
  p_notes            text default null,
  p_image_path       text default null,
  p_source           text default 'manual'
)
returns public.stock_items
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.require_user();
  loc public.storage_locations%rowtype;
  item public.stock_items%rowtype;
begin
  select * into loc from public.storage_locations where id = p_location;
  if not found or not public.is_member(loc.household_id) or loc.archived_at is not null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;

  insert into public.stock_items (
    household_id, location_id, product_name, category, brand, quantity, unit,
    weight_value, weight_unit, use_by_date, best_before_date, frozen_at,
    added_by, notes, image_path, source
  ) values (
    loc.household_id, loc.id, btrim(p_product_name), nullif(btrim(p_category), ''), nullif(btrim(p_brand), ''),
    p_quantity, p_unit, p_weight_value, p_weight_unit, p_use_by_date, p_best_before_date,
    coalesce(p_frozen_at, case when loc.type = 'freezer' then current_date end),
    uid, nullif(btrim(p_notes), ''), p_image_path, coalesce(p_source, 'manual')
  ) returning * into item;

  insert into public.stock_movements (household_id, stock_item_id, actor_user_id, action, quantity_delta, quantity_after)
  values (item.household_id, item.id, uid, 'add', item.quantity, item.quantity);

  return item;
end;
$$;

create function public.remove_stock(p_item uuid, p_amount numeric, p_expected_version int default null)
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
  if p_amount is null or p_amount <= 0 then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;
  if p_amount > item.quantity then
    raise exception 'insufficient_quantity' using errcode = '22023';
  end if;

  update public.stock_items set
    quantity = item.quantity - p_amount,
    status   = case when item.quantity - p_amount = 0 then 'used_up'::public.stock_status else 'in_stock'::public.stock_status end,
    version  = item.version + 1
  where id = p_item
  returning * into item;

  insert into public.stock_movements (household_id, stock_item_id, actor_user_id, action, quantity_delta, quantity_after)
  values (item.household_id, item.id, uid, 'remove', -p_amount, item.quantity);

  return item;
end;
$$;

create function public.undo_movement(p_movement uuid)
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
  if mv.action not in ('add', 'remove', 'adjust') then
    raise exception 'cannot_undo' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.stock_movements where reverses_movement_id = mv.id) then
    raise exception 'already_undone' using errcode = 'P0001';
  end if;

  select * into item from public.stock_items where id = mv.stock_item_id for update;
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

-- Only signed-in users may call these; anon gets nothing.
revoke all on function
  public.require_user(),
  public.create_household(text),
  public.create_invitation(uuid, public.member_role),
  public.accept_invitation(text),
  public.revoke_invitation(uuid),
  public.remove_member(uuid, uuid),
  public.leave_household(uuid),
  public.set_member_role(uuid, uuid, public.member_role),
  public.resolve_location_code(text),
  public.rotate_location_code(uuid),
  public.add_stock(uuid, text, numeric, public.stock_unit, text, text, numeric, public.stock_unit, date, date, date, text, text, text),
  public.remove_stock(uuid, numeric, int),
  public.undo_movement(uuid)
from public, anon;

grant execute on function
  public.require_user(),
  public.create_household(text),
  public.create_invitation(uuid, public.member_role),
  public.accept_invitation(text),
  public.revoke_invitation(uuid),
  public.remove_member(uuid, uuid),
  public.leave_household(uuid),
  public.set_member_role(uuid, uuid, public.member_role),
  public.resolve_location_code(text),
  public.rotate_location_code(uuid),
  public.add_stock(uuid, text, numeric, public.stock_unit, text, text, numeric, public.stock_unit, date, date, date, text, text, text),
  public.remove_stock(uuid, numeric, int),
  public.undo_movement(uuid)
to authenticated;
