-- Group lists: a list shared with people you invite through a link, such as friends or family
-- elsewhere. They sign in (no household needed) and see that list only: nothing of your home, your
-- places or your other lists, and you see nothing of theirs.
--   'group' the owner plus the people who joined through the link.
-- Members keep their place while the owner switches the list to 'me' or 'household' and back, but
-- see it only while it's a group list.

alter table public.lists drop constraint lists_visibility_check;
alter table public.lists add constraint lists_visibility_check check (visibility in ('me', 'household', 'group'));

create table public.list_members (
  list_id   uuid not null references public.lists on delete cascade,
  user_id   uuid not null references auth.users on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (list_id, user_id)
);
create index list_members_user_idx on public.list_members (user_id);

-- One link per list. Only its hash is kept; the link itself exists only where the owner sent it.
create table public.list_invites (
  list_id    uuid primary key references public.lists on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days'
);

create or replace function public.can_see_list(p_list uuid)
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
           or (l.visibility = 'household' and public.is_member(l.household_id))
           or (l.visibility = 'group' and exists (
                 select 1 from public.list_members m where m.list_id = l.id and m.user_id = (select auth.uid()))))
  );
$$;

drop policy lists_select on public.lists;
create policy lists_select on public.lists for select to authenticated
  using (public.can_see_list(id));

alter table public.list_members enable row level security;
alter table public.list_invites enable row level security;
revoke all on public.list_members, public.list_invites from anon, authenticated;

-- Joining is only through join_list. Anyone in the group sees who else is; the owner can remove
-- someone, and anyone can leave.
grant select, delete on public.list_members to authenticated;
create policy list_members_select on public.list_members for select to authenticated
  using (public.can_see_list(list_id));
create policy list_members_delete on public.list_members for delete to authenticated
  using (user_id = (select auth.uid())
         or exists (select 1 from public.lists l where l.id = list_id and l.owner = (select auth.uid())));
-- list_invites is never readable: links are made and checked by the functions below.

-- The names of everyone on the group lists you can see (owner and members), for "added by" and
-- "You, Tom and Sarah". Names only, nothing else from their profile.
create function public.list_people()
returns table (list_id uuid, user_id uuid, display_name text, is_owner boolean)
language sql
stable
security definer
set search_path = ''
as $$
  with mine as (
    select l.id, l.owner from public.lists l where l.visibility = 'group' and public.can_see_list(l.id)
  )
  select m.id, m.owner, coalesce(p.display_name, 'Someone'), true
  from mine m left join public.profiles p on p.user_id = m.owner
  union all
  select m.id, lm.user_id, coalesce(p.display_name, 'Someone'), false
  from mine m join public.list_members lm on lm.list_id = m.id left join public.profiles p on p.user_id = lm.user_id;
$$;

-- Makes the list a group list and gives it a new link. Any earlier link stops working.
create function public.make_list_link(p_list uuid)
returns table (token text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.require_user();
  raw text;
begin
  if not exists (select 1 from public.lists l where l.id = p_list and l.owner = uid) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  update public.lists set visibility = 'group', household_id = null where id = p_list and visibility <> 'group';
  raw := translate(encode(extensions.gen_random_bytes(24), 'base64'), '+/=', '-_');
  return query
    insert into public.list_invites as i (list_id, token_hash)
    values (p_list, encode(extensions.digest(raw, 'sha256'), 'hex'))
    on conflict (list_id) do update set token_hash = excluded.token_hash, created_at = now(), expires_at = now() + interval '7 days'
    returning raw, i.expires_at;
end;
$$;

-- Stops the link. People already in the group stay.
create function public.stop_list_link(p_list uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.require_user();
begin
  if not exists (select 1 from public.lists l where l.id = p_list and l.owner = uid) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  delete from public.list_invites where list_id = p_list;
end;
$$;

-- What the invite page shows before someone signs in: the list's name, who's asking, how many
-- things are on it and how many people are in it. Nothing else.
create function public.list_invite_preview(p_token text)
returns table (title text, owner_name text, things int, people int)
language sql
stable
security definer
set search_path = ''
as $$
  select l.title,
         coalesce(p.display_name, 'Someone'),
         (select count(*)::int from public.list_entries e where e.list_id = l.id and e.done_at is null),
         1 + (select count(*)::int from public.list_members m where m.list_id = l.id)
  from public.list_invites i
  join public.lists l on l.id = i.list_id and l.visibility = 'group'
  left join public.profiles p on p.user_id = l.owner
  where i.token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex')
    and i.expires_at > now();
$$;

-- Joins the group through its link. Returns the list.
create function public.join_list(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.require_user();
  lid uuid;
  lowner uuid;
begin
  select l.id, l.owner into lid, lowner
  from public.list_invites i join public.lists l on l.id = i.list_id and l.visibility = 'group'
  where i.token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex')
    and i.expires_at > now();
  if lid is null then
    raise exception 'invitation_invalid' using errcode = 'P0001';
  end if;
  if lowner <> uid then
    insert into public.list_members (list_id, user_id) values (lid, uid) on conflict do nothing;
  end if;
  return lid;
end;
$$;

revoke all on function public.list_people(), public.make_list_link(uuid), public.stop_list_link(uuid),
  public.list_invite_preview(text), public.join_list(text) from public, anon;
grant execute on function public.list_people(), public.make_list_link(uuid), public.stop_list_link(uuid),
  public.join_list(text) to authenticated;
grant execute on function public.list_invite_preview(text) to anon, authenticated;

-- Whether the owner has a link out, and until when, so the list page can say so. Owner only.
create function public.list_link_status(p_list uuid)
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select i.expires_at from public.list_invites i join public.lists l on l.id = i.list_id
  where i.list_id = p_list and l.owner = (select auth.uid()) and i.expires_at > now();
$$;
revoke all on function public.list_link_status(uuid) from public, anon;
grant execute on function public.list_link_status(uuid) to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.list_members;
  end if;
end;
$$;
