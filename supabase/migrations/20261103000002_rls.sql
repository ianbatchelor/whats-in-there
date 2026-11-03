-- Row Level Security. One rule underneath everything: you see a household's rows only if you are its member.
-- Inventory changes go through SQL functions (next migration), never direct table writes.

create function public.is_member(hid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.household_members m
    where m.household_id = hid and m.user_id = (select auth.uid())
  );
$$;

create function public.is_owner(hid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.household_members m
    where m.household_id = hid and m.user_id = (select auth.uid()) and m.role = 'owner'
  );
$$;

create function public.shares_household_with(other uuid)
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
  );
$$;

revoke all on function public.is_member(uuid), public.is_owner(uuid), public.shares_household_with(uuid) from public, anon;
grant execute on function public.is_member(uuid), public.is_owner(uuid), public.shares_household_with(uuid) to authenticated;
revoke all on function public.generate_link_code(), public.handle_new_user(), public.touch_updated_at() from public, anon, authenticated;
-- Column defaults run as the caller, so members need this to create a location.
grant execute on function public.generate_link_code() to authenticated;

alter table public.profiles               enable row level security;
alter table public.households             enable row level security;
alter table public.household_members      enable row level security;
alter table public.storage_locations      enable row level security;
alter table public.nfc_tags               enable row level security;
alter table public.stock_items            enable row level security;
alter table public.stock_movements        enable row level security;
alter table public.household_invitations  enable row level security;
alter table public.ai_extraction_attempts enable row level security;

-- Start from nothing; Supabase grants broad table privileges to anon and authenticated by default.
revoke all on all tables in schema public from anon, authenticated;

-- profiles: yourself and people you share a household with
grant select on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;
create policy profiles_select on public.profiles for select to authenticated
  using (user_id = (select auth.uid()) or public.shares_household_with(user_id));
create policy profiles_update on public.profiles for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- households: members read, owners rename. Created and deleted through functions.
grant select on public.households to authenticated;
grant update (name) on public.households to authenticated;
create policy households_select on public.households for select to authenticated
  using (public.is_member(id));
create policy households_update on public.households for update to authenticated
  using (public.is_owner(id)) with check (public.is_owner(id));

-- household_members: members read the list. Joining and leaving go through functions.
grant select on public.household_members to authenticated;
create policy household_members_select on public.household_members for select to authenticated
  using (public.is_member(household_id));

-- storage_locations: any member can create, rename, reorder and archive. link_code is never client-writable.
grant select on public.storage_locations to authenticated;
grant insert (household_id, name, type, sort_order) on public.storage_locations to authenticated;
grant update (name, type, sort_order, archived_at) on public.storage_locations to authenticated;
create policy storage_locations_select on public.storage_locations for select to authenticated
  using (public.is_member(household_id));
create policy storage_locations_insert on public.storage_locations for insert to authenticated
  with check (public.is_member(household_id));
create policy storage_locations_update on public.storage_locations for update to authenticated
  using (public.is_member(household_id)) with check (public.is_member(household_id));

-- nfc_tags: read here, written through functions in Milestone 4
grant select on public.nfc_tags to authenticated;
create policy nfc_tags_select on public.nfc_tags for select to authenticated
  using (public.is_member(household_id));

-- stock_items and stock_movements: read only. Writes happen in add_stock / remove_stock / undo_movement.
grant select on public.stock_items to authenticated;
create policy stock_items_select on public.stock_items for select to authenticated
  using (public.is_member(household_id));
grant select on public.stock_movements to authenticated;
create policy stock_movements_select on public.stock_movements for select to authenticated
  using (public.is_member(household_id));

-- invitations: owners see their household's invitations, never the token hash
grant select (id, household_id, role, created_by, created_at, expires_at, used_at, used_by, revoked_at)
  on public.household_invitations to authenticated;
create policy household_invitations_select on public.household_invitations for select to authenticated
  using (public.is_owner(household_id));

-- AI attempts: members can read their household's log; written by the Edge Function with the service role
grant select on public.ai_extraction_attempts to authenticated;
create policy ai_extraction_attempts_select on public.ai_extraction_attempts for select to authenticated
  using (public.is_member(household_id));
