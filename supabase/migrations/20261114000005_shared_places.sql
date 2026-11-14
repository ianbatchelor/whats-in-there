-- Sharing a single place. Molly can be let into Ian's Garage freezer (and the boxes inside it) and
-- see and use only that: what's in it, adding and taking out, its sticker and its photos. Nothing
-- else of Ian's home, and Ian sees nothing of hers. Everyone who lives in the household can always
-- see the place, as before. Anyone at home can let someone in, by ticking family or sending a link.

create table public.place_members (
  location_id uuid not null references public.storage_locations on delete cascade,
  user_id     uuid not null references auth.users on delete cascade,
  added_by    uuid references auth.users on delete set null,
  added_at    timestamptz not null default now(),
  primary key (location_id, user_id)
);
create index place_members_user_idx on public.place_members (user_id);

create table public.place_invites (
  id          uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.storage_locations on delete cascade,
  token_hash  text not null unique,
  created_by  uuid references auth.users on delete set null,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default now() + interval '7 days',
  used_at     timestamptz,
  used_by     uuid references auth.users on delete set null,
  revoked_at  timestamptz
);
create index place_invites_location_idx on public.place_invites (location_id);

-- ---------- Who can use a place ----------

-- Lives in its household, or has been let into it (or into the place it sits inside).
create function public.can_use_place(p_location uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.storage_locations l
    where l.id = p_location
      and (public.is_member(l.household_id)
           or exists (select 1 from public.place_members pm
                      where pm.user_id = (select auth.uid()) and (pm.location_id = l.id or pm.location_id = l.parent_id)))
  );
$$;

create function public.can_use_item(p_item uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.stock_items s where s.id = p_item and public.can_use_place(s.location_id));
$$;

-- Let into at least one place in this household (for photo uploads and label scans there).
create function public.uses_a_place_in(hid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_member(hid) or exists (
    select 1 from public.place_members pm join public.storage_locations l on l.id = pm.location_id
    where pm.user_id = (select auth.uid()) and l.household_id = hid and l.archived_at is null
  );
$$;

revoke all on function public.can_use_place(uuid), public.can_use_item(uuid), public.uses_a_place_in(uuid) from public, anon;
grant execute on function public.can_use_place(uuid), public.can_use_item(uuid), public.uses_a_place_in(uuid) to authenticated;

-- Names: people who share a place see each other's names, as people at home do.
create or replace function public.shares_household_with(other uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.household_members mine
    join public.household_members theirs on theirs.household_id = mine.household_id
    where mine.user_id = (select auth.uid()) and theirs.user_id = other
  ) or exists (
    -- Someone let into a place, and the people who live there or were let in too.
    select 1
    from public.place_members pm
    join public.storage_locations l on l.id = pm.location_id
    where (pm.user_id = (select auth.uid())
           and (exists (select 1 from public.household_members h where h.household_id = l.household_id and h.user_id = other and h.role <> 'family')
                or exists (select 1 from public.place_members o where o.location_id = pm.location_id and o.user_id = other)))
       or (pm.user_id = other and public.is_member(l.household_id))
  );
$$;

-- ---------- What they can see ----------

alter policy storage_locations_select on public.storage_locations
  using (public.is_member(household_id) or public.can_use_place(id));
alter policy stock_items_select on public.stock_items
  using (public.is_member(household_id) or public.can_use_place(location_id));
alter policy stock_movements_select on public.stock_movements
  using (public.is_member(household_id) or public.can_use_item(stock_item_id));

alter table public.place_members enable row level security;
alter table public.place_invites enable row level security;
revoke all on public.place_members, public.place_invites from anon, authenticated;
grant select on public.place_members to authenticated;
create policy place_members_select on public.place_members for select to authenticated
  using (user_id = (select auth.uid()) or public.can_use_place(location_id));

-- Photos of things in a shared place, its cover photo, and photos you took yourself.
create policy item_photos_select_shared on storage.objects for select to authenticated
  using (bucket_id = 'item-photos' and (
    owner = (select auth.uid())
    or exists (select 1 from public.stock_items s
               where s.image_path is not null and split_part(name, '/', 1) = s.household_id::text
                 and name in (s.image_path, regexp_replace(s.image_path, '(\.[^./]+)$', '.thumb\1'))
                 and public.can_use_place(s.location_id))
    or exists (select 1 from public.storage_locations l
               where l.image_path is not null and split_part(name, '/', 1) = l.household_id::text
                 and name in (l.image_path, regexp_replace(l.image_path, '(\.[^./]+)$', '.thumb\1'))
                 and public.can_use_place(l.id))));
create policy item_photos_insert_shared on storage.objects for insert to authenticated
  with check (bucket_id = 'item-photos' and (storage.foldername(name))[1] in (
    select l.household_id::text from public.place_members pm join public.storage_locations l on l.id = pm.location_id
    where pm.user_id = (select auth.uid())));

-- ---------- Letting people in ----------

-- Tick someone from your family to let them into this place.
create function public.share_place_with(p_location uuid, p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.require_user();
  hid uuid;
begin
  select household_id into hid from public.storage_locations where id = p_location and archived_at is null;
  if hid is null or not public.is_member(hid) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if not exists (select 1 from public.household_members where household_id = hid and user_id = p_user and role = 'family') then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  insert into public.place_members (location_id, user_id, added_by) values (p_location, p_user, uid)
  on conflict do nothing;
end;
$$;

-- Take someone out of a place. Anyone at home can; anyone let in can take themselves out.
create function public.unshare_place(p_location uuid, p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  hid uuid;
begin
  perform public.require_user();
  select household_id into hid from public.storage_locations where id = p_location;
  if hid is null or not (public.is_member(hid) or p_user = (select auth.uid())) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  delete from public.place_members where location_id = p_location and user_id = p_user;
end;
$$;

-- An invite link for one person. Works once and for 7 days.
create function public.make_place_link(p_location uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.require_user();
  hid uuid;
  raw text;
begin
  select household_id into hid from public.storage_locations where id = p_location and archived_at is null and parent_id is null;
  if hid is null or not public.is_member(hid) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  raw := translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/=', '-_');
  insert into public.place_invites (location_id, token_hash, created_by)
  values (p_location, encode(extensions.digest(raw, 'sha256'), 'hex'), uid);
  return raw;
end;
$$;

-- Stops every link still out for this place.
create function public.stop_place_links(p_location uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  hid uuid;
begin
  perform public.require_user();
  select household_id into hid from public.storage_locations where id = p_location;
  if hid is null or not public.is_member(hid) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  update public.place_invites set revoked_at = now() where location_id = p_location and used_at is null and revoked_at is null;
end;
$$;

-- What a link is for, before joining: the place, its household and who sent it.
create function public.place_invite_preview(p_token text)
returns table (place text, household text, invited_by text, things int)
language sql
stable
security definer
set search_path = ''
as $$
  select l.name, h.name, coalesce(p.display_name, 'Someone'),
         (select count(*)::int from public.stock_items s where s.location_id = l.id and s.status = 'in_stock')
  from public.place_invites i
  join public.storage_locations l on l.id = i.location_id and l.archived_at is null
  join public.households h on h.id = l.household_id
  left join public.profiles p on p.user_id = i.created_by
  where i.token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex')
    and i.used_at is null and i.revoked_at is null and i.expires_at > now();
$$;

-- Joins through a link. Returns the place.
create function public.join_place(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.require_user();
  inv public.place_invites%rowtype;
  hid uuid;
begin
  select * into inv from public.place_invites
  where token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex')
  for update;
  if not found or inv.revoked_at is not null then
    raise exception 'invitation_invalid' using errcode = 'P0001';
  end if;
  select household_id into hid from public.storage_locations where id = inv.location_id and archived_at is null;
  if hid is null then
    raise exception 'invitation_invalid' using errcode = 'P0001';
  end if;
  if public.is_member(hid) or exists (select 1 from public.place_members where location_id = inv.location_id and user_id = uid) then
    return inv.location_id;   -- already in; don't burn the link
  end if;
  if inv.used_at is not null then
    raise exception 'invitation_used' using errcode = 'P0001';
  end if;
  if inv.expires_at <= now() then
    raise exception 'invitation_expired' using errcode = 'P0001';
  end if;
  insert into public.place_members (location_id, user_id, added_by) values (inv.location_id, uid, inv.created_by);
  update public.place_invites set used_at = now(), used_by = uid where id = inv.id;
  return inv.location_id;
end;
$$;

-- Places other households have let you into, for Home.
create function public.shared_with_me()
returns table (id uuid, name text, type public.location_type, image_path text, household text, household_id uuid, things int)
language sql
stable
security definer
set search_path = ''
as $$
  select l.id, l.name, l.type, l.image_path, h.name, h.id,
         (select count(*)::int from public.stock_items s
          where s.status = 'in_stock' and s.location_id in (
            select c.id from public.storage_locations c where (c.id = l.id or c.parent_id = l.id) and c.archived_at is null))
  from public.place_members pm
  join public.storage_locations l on l.id = pm.location_id and l.archived_at is null
  join public.households h on h.id = l.household_id
  where pm.user_id = (select auth.uid()) and not public.is_member(l.household_id)
  order by pm.added_at;
$$;

-- Who's been let into a place, for its "Who uses this?" sheet.
create function public.place_people(p_location uuid)
returns table (user_id uuid, display_name text, added_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select pm.user_id, coalesce(p.display_name, 'Someone'), pm.added_at
  from public.place_members pm
  left join public.profiles p on p.user_id = pm.user_id
  where pm.location_id = p_location and public.can_use_place(p_location)
  order by pm.added_at;
$$;

-- Whether a link is out for this place, and until when. Home members only.
create function public.place_link_status(p_location uuid)
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select max(i.expires_at) from public.place_invites i
  join public.storage_locations l on l.id = i.location_id
  where i.location_id = p_location and public.is_member(l.household_id)
    and i.used_at is null and i.revoked_at is null and i.expires_at > now();
$$;

revoke all on function public.share_place_with(uuid, uuid), public.unshare_place(uuid, uuid), public.make_place_link(uuid),
  public.stop_place_links(uuid), public.place_invite_preview(text), public.join_place(text), public.shared_with_me(),
  public.place_people(uuid), public.place_link_status(uuid) from public, anon;
grant execute on function public.share_place_with(uuid, uuid), public.unshare_place(uuid, uuid), public.make_place_link(uuid),
  public.stop_place_links(uuid), public.join_place(text), public.shared_with_me(), public.place_people(uuid),
  public.place_link_status(uuid) to authenticated;
grant execute on function public.place_invite_preview(text) to anon, authenticated;

-- ---------- Using it: the same actions as at home, checked against the place ----------

create or replace function public.add_stock(
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
  if not found or not public.can_use_place(loc.id) or loc.archived_at is not null then
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

create or replace function public.remove_stock(p_item uuid, p_amount numeric, p_expected_version int default null)
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
  if not found or not public.can_use_place(item.location_id) or item.status <> 'in_stock' then
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

create or replace function public.update_stock_item(
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
  if not found or not public.can_use_place(item.location_id) or item.status <> 'in_stock' then
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

create or replace function public.lend_stock(p_item uuid, p_to text, p_expected_version int default null)
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
  if not found or not public.can_use_place(item.location_id) or item.status <> 'in_stock' then
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

create or replace function public.set_wine_details(
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
  if not found or not public.can_use_place(item.location_id) or item.status <> 'in_stock' then
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

create or replace function public.move_stock(p_item uuid, p_location uuid, p_expected_version int default null)
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
  if not found or not public.can_use_place(item.location_id) or item.status <> 'in_stock' then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if p_expected_version is not null and p_expected_version <> item.version then
    raise exception 'version_conflict' using errcode = '40001';
  end if;
  select * into loc from public.storage_locations where id = p_location;
  if not found or loc.household_id <> item.household_id or loc.archived_at is not null or not public.can_use_place(loc.id) then
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
  if not found or not public.can_use_item(mv.stock_item_id) then
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
                      where id = mv.from_location_id and household_id = item.household_id and archived_at is null)
       or not public.can_use_place(mv.from_location_id) then
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

create or replace function public.resolve_location_code(p_code text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  -- Same answer (null) for an unknown code and for someone else's location.
  select l.id from public.storage_locations l
  where l.link_code = p_code and l.archived_at is null and public.can_use_place(l.id);
$$;
