-- A shopping list the whole household shares. Each thing can say which place it goes in, so once
-- it's bought it can be put away there in one tap.

create table public.shopping_items (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households on delete cascade,
  name         text not null check (length(btrim(name)) between 1 and 120),
  brand        text check (length(brand) <= 80),
  category     text check (length(category) <= 40),
  quantity     numeric(10,3) not null default 1 check (quantity > 0),
  unit         public.stock_unit not null default 'item',
  location_id  uuid,
  added_by     uuid references auth.users on delete set null,
  added_at     timestamptz not null default now(),
  bought_at    timestamptz,
  bought_by    uuid references auth.users on delete set null,
  foreign key (location_id, household_id) references public.storage_locations (id, household_id) on delete set null (location_id)
);
create index shopping_items_household_idx on public.shopping_items (household_id, added_at);
-- The same thing can't be on the list twice while it's still to buy.
create unique index shopping_items_once_idx on public.shopping_items (household_id, lower(btrim(name))) where bought_at is null;

-- Who added it and who bought it come from the signed-in person, never from the app.
create function public.stamp_shopping_item()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.added_by := auth.uid();
    new.added_at := now();
  end if;
  if new.bought_at is null then
    new.bought_by := null;
  elsif tg_op = 'INSERT' or old.bought_at is null then
    new.bought_at := now();
    new.bought_by := auth.uid();
  else
    new.bought_at := old.bought_at;
    new.bought_by := old.bought_by;
  end if;
  return new;
end;
$$;

create trigger shopping_items_stamp before insert or update on public.shopping_items
  for each row execute function public.stamp_shopping_item();

alter table public.shopping_items enable row level security;
revoke all on public.shopping_items from anon, authenticated;
grant select, delete on public.shopping_items to authenticated;
grant insert (household_id, name, brand, category, quantity, unit, location_id) on public.shopping_items to authenticated;
grant update (name, brand, category, quantity, unit, location_id, bought_at) on public.shopping_items to authenticated;
create policy shopping_items_select on public.shopping_items for select to authenticated
  using (public.is_member(household_id));
create policy shopping_items_insert on public.shopping_items for insert to authenticated
  with check (public.is_member(household_id));
create policy shopping_items_update on public.shopping_items for update to authenticated
  using (public.is_member(household_id)) with check (public.is_member(household_id));
create policy shopping_items_delete on public.shopping_items for delete to authenticated
  using (public.is_member(household_id));

-- Bought: add it to the place it goes in and take it off the list, together.
create function public.put_away_shopping(p_item uuid)
returns public.stock_items
language plpgsql
security invoker
set search_path = ''
as $$
declare
  s public.shopping_items;
  added public.stock_items;
begin
  select * into s from public.shopping_items where id = p_item for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if s.location_id is null then
    raise exception 'no_place' using errcode = '22023';
  end if;
  added := public.add_stock(s.location_id, s.name, s.quantity, s.unit, s.category, s.brand);
  delete from public.shopping_items where id = p_item;
  return added;
end;
$$;

revoke all on function public.put_away_shopping(uuid) from public, anon;
grant execute on function public.put_away_shopping(uuid) to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.shopping_items;
  end if;
end;
$$;
