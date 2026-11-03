-- What's in There? core schema.
-- Every household-scoped table carries household_id so each RLS policy is one membership check.

create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_trgm with schema extensions;

create type public.member_role     as enum ('owner', 'member');
create type public.location_type   as enum ('freezer', 'fridge', 'pantry', 'cupboard', 'wine', 'other');
create type public.stock_unit      as enum ('item', 'portion', 'pack', 'g', 'kg', 'ml', 'l');
create type public.stock_status    as enum ('in_stock', 'used_up', 'discarded');
create type public.movement_action as enum ('add', 'remove', 'adjust', 'move', 'undo');

-- 10 random base62 characters (~59 bits). Used in sticker URLs: https://APP_DOMAIN/l/<code>
create function public.generate_link_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alphabet constant text := '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  bytes bytea := extensions.gen_random_bytes(10);
  result text := '';
begin
  for i in 0..9 loop
    result := result || substr(alphabet, (get_byte(bytes, i) % 62) + 1, 1);
  end loop;
  return result;
end;
$$;

create function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create table public.profiles (
  user_id      uuid primary key references auth.users on delete cascade,
  display_name text not null check (length(display_name) between 1 and 60),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

create table public.households (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(btrim(name)) between 1 and 80),
  created_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger households_touch before update on public.households
  for each row execute function public.touch_updated_at();

create table public.household_members (
  household_id uuid not null references public.households on delete cascade,
  user_id      uuid not null references auth.users on delete cascade,
  role         public.member_role not null default 'member',
  joined_at    timestamptz not null default now(),
  primary key (household_id, user_id)
);
create index household_members_user_idx on public.household_members (user_id);

create table public.storage_locations (
  id           uuid primary key default gen_random_uuid(),   -- permanent
  household_id uuid not null references public.households on delete cascade,
  name         text not null check (length(btrim(name)) between 1 and 60),
  type         public.location_type not null,
  link_code    text not null unique default public.generate_link_code(),  -- rotatable
  sort_order   int not null default 0,
  created_by   uuid references auth.users on delete set null default auth.uid(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  archived_at  timestamptz,
  unique (id, household_id)
);
create index storage_locations_household_idx on public.storage_locations (household_id) where archived_at is null;
create trigger storage_locations_touch before update on public.storage_locations
  for each row execute function public.touch_updated_at();

create table public.nfc_tags (
  id               uuid primary key default gen_random_uuid(),
  household_id     uuid not null,
  location_id      uuid not null,
  label            text check (length(label) <= 40),
  tag_uid          text check (length(tag_uid) <= 64),
  link_code        text not null,          -- code written to the tag; stale once the location rotates
  written_by       uuid references auth.users on delete set null,
  written_at       timestamptz not null default now(),
  last_verified_at timestamptz,
  retired_at       timestamptz,
  foreign key (location_id, household_id) references public.storage_locations (id, household_id) on delete cascade
);
create index nfc_tags_location_idx on public.nfc_tags (location_id);

create table public.stock_items (
  id               uuid primary key default gen_random_uuid(),
  household_id     uuid not null,
  location_id      uuid not null,
  product_name     text not null check (length(btrim(product_name)) between 1 and 120),
  category         text check (length(category) <= 40),
  brand            text check (length(brand) <= 80),
  quantity         numeric(10,3) not null check (quantity >= 0),
  unit             public.stock_unit not null default 'item',
  weight_value     numeric(10,3) check (weight_value > 0),
  weight_unit      public.stock_unit check (weight_unit in ('g', 'kg', 'ml', 'l')),
  use_by_date      date,                   -- as printed; never derived
  best_before_date date,                   -- as printed; never derived
  frozen_at        date,
  added_at         timestamptz not null default now(),
  added_by         uuid references auth.users on delete set null,
  notes            text check (length(notes) <= 1000),
  image_path       text,
  source           text not null default 'manual' check (source in ('manual', 'photo')),
  status           public.stock_status not null default 'in_stock',
  version          int not null default 1,
  updated_at       timestamptz not null default now(),
  unique (id, household_id),
  check ((weight_value is null) = (weight_unit is null)),
  check (status <> 'in_stock' or quantity > 0),
  foreign key (location_id, household_id) references public.storage_locations (id, household_id)
);
create index stock_items_location_idx on public.stock_items (household_id, location_id) where status = 'in_stock';
create index stock_items_age_idx on public.stock_items (household_id, frozen_at, added_at) where status = 'in_stock';
create index stock_items_name_trgm_idx on public.stock_items using gin (product_name extensions.gin_trgm_ops);
create trigger stock_items_touch before update on public.stock_items
  for each row execute function public.touch_updated_at();

create table public.stock_movements (
  id                   uuid primary key default gen_random_uuid(),
  household_id         uuid not null,
  stock_item_id        uuid not null,
  actor_user_id        uuid references auth.users on delete set null,
  action               public.movement_action not null,
  quantity_delta       numeric(10,3) not null,
  quantity_after       numeric(10,3) not null check (quantity_after >= 0),
  reverses_movement_id uuid unique references public.stock_movements,
  notes                text check (length(notes) <= 500),
  created_at           timestamptz not null default now(),
  foreign key (stock_item_id, household_id) references public.stock_items (id, household_id) on delete cascade
);
create index stock_movements_household_idx on public.stock_movements (household_id, created_at desc);
create index stock_movements_item_idx on public.stock_movements (stock_item_id, created_at desc);

create table public.household_invitations (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households on delete cascade,
  role         public.member_role not null default 'member',
  token_hash   text not null unique,       -- sha256 hex; the raw token exists only in the link
  created_by   uuid references auth.users on delete set null,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null default now() + interval '7 days',
  used_at      timestamptz,
  used_by      uuid references auth.users on delete set null,
  revoked_at   timestamptz
);
create index household_invitations_household_idx on public.household_invitations (household_id);

create table public.ai_extraction_attempts (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households on delete cascade,
  actor_user_id uuid references auth.users on delete set null,
  image_path    text,
  model         text,
  parsed_json   jsonb,
  input_tokens  int,
  output_tokens int,
  latency_ms    int,
  error_code    text,
  created_at    timestamptz not null default now()
);
create index ai_extraction_attempts_household_idx on public.ai_extraction_attempts (household_id, created_at desc);

-- New sign-ups get a profile named after their email until they choose a name.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id, display_name)
  values (
    new.id,
    left(coalesce(nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(new.email, '@', 1), 'Me'), 60)
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Realtime: household members see each other's changes live.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.stock_items, public.storage_locations, public.household_members;
  end if;
end;
$$;
