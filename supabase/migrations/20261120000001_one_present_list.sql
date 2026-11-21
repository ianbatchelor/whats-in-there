-- Sharing one person's present list.
--
-- 1. The share link page no longer gets the names of who's getting what for present lists. It still
--    learns which ideas are taken, because the page hides those from givers, but not by whom.
--
-- 2. Someone outside the household (Carol, say) can be invited into the app for one present list
--    only: Michele's. They see that list's ideas that nobody has taken yet, and can say "I'm getting
--    this". Nothing else of the household: no places, no other lists, no people. The list's own person
--    never sees claims, as before. Everything goes through the functions below; the tables have no
--    policies, so nobody reads them directly.

-- ---------- 1. Share link: no giver names on present lists ----------

create or replace function public.shared_wish_list(p_code text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'name', coalesce(l.name, p.display_name, 'Someone'),
    'kind', l.kind,
    'friend', l.friend,
    'ideas', coalesce((
      select jsonb_agg(jsonb_build_object(
          'id', i.id, 'title', i.title, 'note', i.note, 'link', i.link, 'price', i.price, 'favourite', i.favourite,
          'imagePath', i.image_path,
          'author', i.author, 'coverId', i.cover_id, 'suggestedBy', i.suggested_by,
          'taken', c.idea_id is not null,
          -- Book lists still say who's lending a book; present lists keep it to themselves.
          'takenBy', case when l.kind = 'books' then coalesce(c.claimed_name, cp.display_name) end
        ) order by i.favourite desc, i.added_at)
      from public.wish_ideas i
      left join public.wish_claims c on c.idea_id = i.id
      left join public.profiles cp on cp.user_id = c.claimed_by
      where i.list_id = l.id), '[]'::jsonb)
  )
  from public.wish_lists l
  left join public.profiles p on p.user_id = l.for_user
  where l.share_code = p_code and p_code ~ '^[0-9A-Za-z]{10}$';
$$;

-- ---------- 2. Invited into the app for one list ----------

create table public.wish_list_viewers (
  list_id  uuid not null references public.wish_lists on delete cascade,
  user_id  uuid not null references auth.users on delete cascade,
  added_by uuid references auth.users on delete set null,
  added_at timestamptz not null default now(),
  primary key (list_id, user_id)
);
create index wish_list_viewers_user_idx on public.wish_list_viewers (user_id);

create table public.wish_list_invites (
  id         uuid primary key default gen_random_uuid(),
  list_id    uuid not null references public.wish_lists on delete cascade,
  email      text not null check (length(email) <= 254 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  token_hash text not null unique,
  created_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  used_at    timestamptz,
  used_by    uuid references auth.users on delete set null,
  revoked_at timestamptz
);
create index wish_list_invites_list_idx on public.wish_list_invites (list_id);
create index wish_list_invites_maker_idx on public.wish_list_invites (created_by, created_at);

alter table public.wish_list_viewers enable row level security;
alter table public.wish_list_invites enable row level security;
revoke all on public.wish_list_viewers, public.wish_list_invites from anon, authenticated;

-- A present list that someone who lives in its household may let people into.
create function public.can_share_present_list(p_list uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.wish_lists l
    where l.id = p_list and l.kind = 'presents' and not l.friend and public.is_member(l.household_id)
  );
$$;

-- Whether the signed-in person was let into this list.
create function public.views_wish_list(p_list uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.wish_list_viewers v join public.wish_lists l on l.id = v.list_id
    where v.list_id = p_list and v.user_id = (select auth.uid()) and l.kind = 'presents'
      and l.for_user is distinct from (select auth.uid())
  );
$$;

-- Makes an invitation for one email address. Returns the secret for the link (only its hash is kept).
create function public.invite_to_wish_list(p_list uuid, p_email text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.require_user();
  addr text := lower(btrim(coalesce(p_email, '')));
  l public.wish_lists;
  raw text;
begin
  if not public.can_share_present_list(p_list) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if addr !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(addr) > 254 then
    raise exception 'bad_email' using errcode = '22023';
  end if;
  select * into l from public.wish_lists where id = p_list;
  -- Michele can't be let into her own list: she'd see what's being got.
  if l.for_user is not null and exists (select 1 from auth.users u where u.id = l.for_user and lower(u.email) = addr) then
    raise exception 'own_list' using errcode = 'P0001';
  end if;
  if (select count(*) from public.wish_list_invites where created_by = uid and created_at > now() - interval '1 day') >= 20 then
    raise exception 'too_many_invites' using errcode = 'P0001';
  end if;
  -- A fresh invitation replaces any still waiting for the same person.
  update public.wish_list_invites set revoked_at = now()
  where list_id = p_list and email = addr and used_at is null and revoked_at is null;
  raw := translate(encode(extensions.gen_random_bytes(24), 'base64'), '+/=', '-_');
  insert into public.wish_list_invites (list_id, email, token_hash, created_by)
    values (p_list, addr, encode(extensions.digest(raw, 'sha256'), 'hex'), uid);
  return raw;
end;
$$;

-- What an invitation link is for, before signing in. The email is only hinted at.
create function public.wish_list_invite_preview(p_token text)
returns table (name text, household text, invited_by text, email_hint text)
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(l.name, p.display_name, 'Someone'), h.name, coalesce(ip.display_name, 'Someone'),
         left(i.email, 1) || '…' || substr(i.email, position('@' in i.email))
  from public.wish_list_invites i
  join public.wish_lists l on l.id = i.list_id and l.kind = 'presents'
  join public.households h on h.id = l.household_id
  left join public.profiles p on p.user_id = l.for_user
  left join public.profiles ip on ip.user_id = i.created_by
  where i.token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex')
    and i.used_at is null and i.revoked_at is null and i.expires_at > now();
$$;

-- Accepts an invitation. Only works for the email it was sent to. Returns the list.
create function public.join_wish_list(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.require_user();
  inv public.wish_list_invites%rowtype;
  l public.wish_lists;
begin
  select * into inv from public.wish_list_invites
  where token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex')
  for update;
  if not found or inv.revoked_at is not null then
    raise exception 'invitation_invalid' using errcode = 'P0001';
  end if;
  select * into l from public.wish_lists where id = inv.list_id and kind = 'presents';
  if not found then
    raise exception 'invitation_invalid' using errcode = 'P0001';
  end if;
  if not exists (select 1 from auth.users u where u.id = uid and lower(u.email) = inv.email) then
    raise exception 'wrong_email' using errcode = 'P0001';
  end if;
  if l.for_user = uid then
    raise exception 'own_list' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.wish_list_viewers where list_id = inv.list_id and user_id = uid) then
    return inv.list_id;   -- already in; don't burn the link
  end if;
  if inv.used_at is not null then
    raise exception 'invitation_used' using errcode = 'P0001';
  end if;
  if inv.expires_at <= now() then
    raise exception 'invitation_expired' using errcode = 'P0001';
  end if;
  insert into public.wish_list_viewers (list_id, user_id, added_by) values (inv.list_id, uid, inv.created_by);
  update public.wish_list_invites set used_at = now(), used_by = uid where id = inv.id;
  return inv.list_id;
end;
$$;

-- Present lists you've been let into, for Home and the Presents page.
create function public.wish_lists_shared_with_me()
returns table (id uuid, name text, household text, shared_by text, free int)
language sql
stable
security definer
set search_path = ''
as $$
  select l.id, coalesce(l.name, p.display_name, 'Someone'), h.name, coalesce(bp.display_name, 'Someone'),
         (select count(*)::int from public.wish_ideas i
          where i.list_id = l.id and not exists (select 1 from public.wish_claims c where c.idea_id = i.id))
  from public.wish_list_viewers v
  join public.wish_lists l on l.id = v.list_id and l.kind = 'presents'
  join public.households h on h.id = l.household_id
  left join public.profiles p on p.user_id = l.for_user
  left join public.profiles bp on bp.user_id = v.added_by
  where v.user_id = (select auth.uid()) and l.for_user is distinct from (select auth.uid())
  order by v.added_at;
$$;

-- One list as someone let into it sees it: ideas nobody has taken yet, plus the ones you're getting.
create function public.viewer_wish_list(p_list uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'name', coalesce(l.name, p.display_name, 'Someone'),
    'household', h.name,
    'hidden', (select count(*) from public.wish_claims c
               where c.list_id = l.id and c.claimed_by is distinct from (select auth.uid())),
    'ideas', coalesce((
      select jsonb_agg(jsonb_build_object(
          'id', i.id, 'title', i.title, 'note', i.note, 'link', i.link, 'price', i.price, 'favourite', i.favourite,
          'imagePath', i.image_path,
          'mine', c.idea_id is not null
        ) order by i.favourite desc, i.added_at)
      from public.wish_ideas i
      left join public.wish_claims c on c.idea_id = i.id
      where i.list_id = l.id and (c.idea_id is null or c.claimed_by = (select auth.uid()))), '[]'::jsonb)
  )
  from public.wish_lists l
  join public.households h on h.id = l.household_id
  left join public.profiles p on p.user_id = l.for_user
  where l.id = p_list and public.views_wish_list(p_list);
$$;

create function public.viewer_claim_wish(p_list uuid, p_idea uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  i public.wish_ideas;
begin
  perform public.require_user();
  if not public.views_wish_list(p_list) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  select * into i from public.wish_ideas where id = p_idea and list_id = p_list;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.wish_claims where idea_id = p_idea) then
    raise exception 'already_taken' using errcode = 'P0001';
  end if;
  -- The claim trigger records the signed-in person as the one getting it.
  insert into public.wish_claims (idea_id, list_id, household_id) values (i.id, i.list_id, i.household_id);
end;
$$;

create function public.viewer_unclaim_wish(p_list uuid, p_idea uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_user();
  if not public.views_wish_list(p_list) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  delete from public.wish_claims where idea_id = p_idea and list_id = p_list and claimed_by = (select auth.uid());
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
end;
$$;

-- Who can see a list, and invitations still waiting, for the Share sheet. Home members only.
create function public.wish_list_people(p_list uuid)
returns table (user_id uuid, invite_id uuid, label text, at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select v.user_id, null::uuid, coalesce(p.display_name, 'Someone'), v.added_at
  from public.wish_list_viewers v
  left join public.profiles p on p.user_id = v.user_id
  where v.list_id = p_list and public.can_share_present_list(p_list)
  union all
  select null::uuid, i.id, i.email, i.created_at
  from public.wish_list_invites i
  where i.list_id = p_list and public.can_share_present_list(p_list)
    and i.used_at is null and i.revoked_at is null and i.expires_at > now()
  order by 4;
$$;

-- Takes someone off a list. Home members can take anyone off; a viewer can take themselves off.
create function public.remove_wish_list_viewer(p_list uuid, p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.require_user();
begin
  if not (public.can_share_present_list(p_list) or p_user = uid) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  delete from public.wish_list_viewers where list_id = p_list and user_id = p_user;
end;
$$;

create function public.cancel_wish_list_invite(p_invite uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_user();
  update public.wish_list_invites i set revoked_at = now()
  where i.id = p_invite and i.revoked_at is null and public.can_share_present_list(i.list_id);
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
end;
$$;

-- The household sees the name of someone let into one of its lists ("Carol is getting this"), and
-- that person sees the names of the household. Nothing more than names.
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
  ) or exists (
    -- Someone let into a present list, and the people in its household.
    select 1
    from public.wish_list_viewers v
    join public.wish_lists l on l.id = v.list_id
    where (v.user_id = other and public.in_family(l.household_id))
       or (v.user_id = (select auth.uid())
           and exists (select 1 from public.household_members h where h.household_id = l.household_id and h.user_id = other))
  );
$$;

revoke all on function public.can_share_present_list(uuid), public.views_wish_list(uuid), public.invite_to_wish_list(uuid, text),
  public.wish_list_invite_preview(text), public.join_wish_list(text), public.wish_lists_shared_with_me(),
  public.viewer_wish_list(uuid), public.viewer_claim_wish(uuid, uuid), public.viewer_unclaim_wish(uuid, uuid),
  public.wish_list_people(uuid), public.remove_wish_list_viewer(uuid, uuid), public.cancel_wish_list_invite(uuid)
  from public, anon, authenticated;
grant execute on function public.invite_to_wish_list(uuid, text), public.join_wish_list(text), public.wish_lists_shared_with_me(),
  public.viewer_wish_list(uuid), public.viewer_claim_wish(uuid, uuid), public.viewer_unclaim_wish(uuid, uuid),
  public.wish_list_people(uuid), public.remove_wish_list_viewer(uuid, uuid), public.cancel_wish_list_invite(uuid)
  to authenticated;
grant execute on function public.wish_list_invite_preview(text) to anon, authenticated;
