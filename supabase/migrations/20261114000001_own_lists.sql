-- Your own lists: any number of lists a person makes, each with its own say over who can see it.
--   'me'        only the person who made it. Nobody else in the household, ever.
--   'household' everyone in the household it belongs to, like the shopping list.
-- Privacy is enforced here, not in the app: a 'me' list and everything on it is never returned to
-- anyone but its owner.

create table public.lists (
  id           uuid primary key default gen_random_uuid(),
  owner        uuid not null references auth.users on delete cascade,
  -- The household it's shared with; only set while it's shared. Goes with the household.
  household_id uuid references public.households on delete cascade,
  title        text not null check (length(btrim(title)) between 1 and 60),
  kind         text not null default 'todo' check (kind in ('todo', 'ideas', 'buy')),
  visibility   text not null default 'me' check (visibility in ('me', 'household')),
  created_at   timestamptz not null default now(),
  check ((visibility = 'household') = (household_id is not null))
);
create index lists_owner_idx on public.lists (owner);
create index lists_household_idx on public.lists (household_id) where household_id is not null;

create table public.list_entries (
  id        uuid primary key default gen_random_uuid(),
  list_id   uuid not null references public.lists on delete cascade,
  text      text not null check (length(btrim(text)) between 1 and 200),
  note      text check (length(note) <= 300),
  added_by  uuid references auth.users on delete set null,
  added_at  timestamptz not null default now(),
  done_at   timestamptz,
  done_by   uuid references auth.users on delete set null
);
create index list_entries_list_idx on public.list_entries (list_id, added_at);

-- Whether the signed-in person can see a list. Definer so the entries policies can ask without the
-- caller needing anything more than they already have.
create function public.can_see_list(p_list uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.lists l
    where l.id = p_list
      and (l.owner = (select auth.uid())
           or (l.visibility = 'household' and public.is_member(l.household_id)))
  );
$$;
revoke all on function public.can_see_list(uuid) from public, anon;
grant execute on function public.can_see_list(uuid) to authenticated;

-- The owner is whoever makes the list, never something the app says.
create function public.stamp_list()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.owner := auth.uid();
    new.created_at := now();
  else
    new.owner := old.owner;
    new.created_at := old.created_at;
  end if;
  return new;
end;
$$;
create trigger lists_stamp before insert or update on public.lists
  for each row execute function public.stamp_list();

create function public.stamp_list_entry()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.added_by := auth.uid();
    new.added_at := now();
  else
    new.list_id := old.list_id;
    new.added_by := old.added_by;
    new.added_at := old.added_at;
  end if;
  if new.done_at is null then
    new.done_by := null;
  elsif tg_op = 'INSERT' or old.done_at is null then
    new.done_at := now();
    new.done_by := auth.uid();
  else
    new.done_at := old.done_at;
    new.done_by := old.done_by;
  end if;
  return new;
end;
$$;
create trigger list_entries_stamp before insert or update on public.list_entries
  for each row execute function public.stamp_list_entry();

alter table public.lists enable row level security;
alter table public.list_entries enable row level security;
revoke all on public.lists, public.list_entries from anon, authenticated;

-- Only the owner changes a list's name or who can see it, or deletes it. A list can only be shared
-- with a household the owner is in.
grant select, delete on public.lists to authenticated;
grant insert (household_id, title, kind, visibility) on public.lists to authenticated;
grant update (household_id, title, kind, visibility) on public.lists to authenticated;
create policy lists_select on public.lists for select to authenticated
  using (owner = (select auth.uid()) or (visibility = 'household' and public.is_member(household_id)));
create policy lists_insert on public.lists for insert to authenticated
  with check ((select auth.uid()) is not null and (household_id is null or public.is_member(household_id)));
create policy lists_update on public.lists for update to authenticated
  using (owner = (select auth.uid()))
  with check (owner = (select auth.uid()) and (household_id is null or public.is_member(household_id)));
create policy lists_delete on public.lists for delete to authenticated
  using (owner = (select auth.uid()));

-- Anyone who can see a list can add to it, tick things off and take things off.
grant select, delete on public.list_entries to authenticated;
grant insert (list_id, text, note, done_at) on public.list_entries to authenticated;
grant update (text, note, done_at) on public.list_entries to authenticated;
create policy list_entries_select on public.list_entries for select to authenticated
  using (public.can_see_list(list_id));
create policy list_entries_insert on public.list_entries for insert to authenticated
  with check (public.can_see_list(list_id));
create policy list_entries_update on public.list_entries for update to authenticated
  using (public.can_see_list(list_id)) with check (public.can_see_list(list_id));
create policy list_entries_delete on public.list_entries for delete to authenticated
  using (public.can_see_list(list_id));

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.lists, public.list_entries;
  end if;
end;
$$;
