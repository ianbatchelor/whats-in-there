-- Present ideas: each person in a household keeps a wish list the rest of the household can see.
-- Others can say "I'm getting this", which the list's own person never sees, so presents stay a
-- surprise. A list can also be shared outside the household through a private link that needs no
-- account; people with the link can see the ideas and say they're getting one, giving a first name.

create table public.wish_lists (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households on delete cascade,
  -- The household member it's for. Null for someone without an account, such as a child.
  for_user     uuid references auth.users on delete cascade,
  name         text check (length(btrim(name)) between 1 and 60),
  share_code   text unique check (share_code ~ '^[0-9A-Za-z]{10}$'),
  created_by   uuid references auth.users on delete set null default auth.uid(),
  created_at   timestamptz not null default now(),
  check (for_user is not null or name is not null),
  unique (id, household_id)
);
create unique index wish_lists_one_each_idx on public.wish_lists (household_id, for_user) where for_user is not null;

create table public.wish_ideas (
  id           uuid primary key default gen_random_uuid(),
  list_id      uuid not null,
  household_id uuid not null,
  title        text not null check (length(btrim(title)) between 1 and 120),
  note         text check (length(note) <= 300),
  link         text check (length(link) <= 600 and link ~* '^https?://[^\s]+$'),
  price        text check (length(price) <= 30),
  favourite    boolean not null default false,
  added_by     uuid references auth.users on delete set null,
  added_at     timestamptz not null default now(),
  foreign key (list_id, household_id) references public.wish_lists (id, household_id) on delete cascade,
  unique (id, list_id, household_id)
);
create index wish_ideas_list_idx on public.wish_ideas (list_id, added_at);

-- One claim per idea. In the app it's a household member; through a share link it's a first name.
create table public.wish_claims (
  idea_id      uuid primary key,
  list_id      uuid not null,
  household_id uuid not null,
  claimed_by   uuid references auth.users on delete set null,
  claimed_name text check (length(btrim(claimed_name)) between 1 and 40),
  claimed_at   timestamptz not null default now(),
  foreign key (idea_id, list_id, household_id) references public.wish_ideas (id, list_id, household_id) on delete cascade
);

-- Lets the person who claimed through a share link take it back from the same browser. Never readable.
create table public.wish_claim_tokens (
  idea_id    uuid primary key references public.wish_claims on delete cascade,
  token_hash text not null
);

-- Whether a list is the signed-in person's own. Definer so the claims policy can ask without
-- the caller needing anything more than they already have.
create function public.is_my_wish_list(p_list uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.wish_lists l where l.id = p_list and l.for_user = (select auth.uid()));
$$;

create function public.stamp_wish_idea()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.added_by := auth.uid();
  new.added_at := now();
  return new;
end;
$$;
create trigger wish_ideas_stamp before insert on public.wish_ideas
  for each row execute function public.stamp_wish_idea();

create function public.stamp_wish_claim()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- In the app it's whoever is signed in. A share-link claim (made by claim_shared_wish, the only
  -- way to give a name) belongs to no account.
  new.claimed_by := case when new.claimed_name is null then auth.uid() end;
  new.claimed_at := now();
  return new;
end;
$$;
create trigger wish_claims_stamp before insert on public.wish_claims
  for each row execute function public.stamp_wish_claim();

alter table public.wish_lists enable row level security;
alter table public.wish_ideas enable row level security;
alter table public.wish_claims enable row level security;
alter table public.wish_claim_tokens enable row level security;
revoke all on public.wish_lists, public.wish_ideas, public.wish_claims, public.wish_claim_tokens from anon, authenticated;

grant select, delete on public.wish_lists to authenticated;
grant insert (household_id, for_user, name) on public.wish_lists to authenticated;
grant update (name) on public.wish_lists to authenticated;
create policy wish_lists_select on public.wish_lists for select to authenticated
  using (public.is_member(household_id));
-- A list for a member must be for someone actually in the household.
create policy wish_lists_insert on public.wish_lists for insert to authenticated
  with check (public.is_member(household_id) and (for_user is null or exists (
    select 1 from public.household_members m where m.household_id = wish_lists.household_id and m.user_id = wish_lists.for_user)));
create policy wish_lists_update on public.wish_lists for update to authenticated
  using (public.is_member(household_id)) with check (public.is_member(household_id));
create policy wish_lists_delete on public.wish_lists for delete to authenticated
  using (public.is_member(household_id));

grant select, delete on public.wish_ideas to authenticated;
grant insert (list_id, household_id, title, note, link, price, favourite) on public.wish_ideas to authenticated;
grant update (title, note, link, price, favourite) on public.wish_ideas to authenticated;
create policy wish_ideas_select on public.wish_ideas for select to authenticated
  using (public.is_member(household_id));
create policy wish_ideas_insert on public.wish_ideas for insert to authenticated
  with check (public.is_member(household_id));
create policy wish_ideas_update on public.wish_ideas for update to authenticated
  using (public.is_member(household_id)) with check (public.is_member(household_id));
create policy wish_ideas_delete on public.wish_ideas for delete to authenticated
  using (public.is_member(household_id));

-- Nobody sees, makes or takes back claims on their own list.
grant select, delete on public.wish_claims to authenticated;
grant insert (idea_id, list_id, household_id) on public.wish_claims to authenticated;
create policy wish_claims_select on public.wish_claims for select to authenticated
  using (public.is_member(household_id) and not public.is_my_wish_list(list_id));
create policy wish_claims_insert on public.wish_claims for insert to authenticated
  with check (public.is_member(household_id) and not public.is_my_wish_list(list_id));
-- Take back your own, or clear one made through a share link.
create policy wish_claims_delete on public.wish_claims for delete to authenticated
  using (public.is_member(household_id) and not public.is_my_wish_list(list_id)
         and (claimed_by = (select auth.uid()) or claimed_by is null));

-- Share a list outside the household: makes its private link code, or returns the existing one.
create function public.share_wish_list(p_list uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  l public.wish_lists;
begin
  perform public.require_user();
  select * into l from public.wish_lists where id = p_list for update;
  if not found or not public.is_member(l.household_id) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if l.share_code is null then
    update public.wish_lists set share_code = public.generate_link_code() where id = p_list returning * into l;
  end if;
  return l.share_code;
end;
$$;

-- Stop sharing: the old link stops working.
create function public.unshare_wish_list(p_list uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  hid uuid;
begin
  perform public.require_user();
  select household_id into hid from public.wish_lists where id = p_list for update;
  if hid is null or not public.is_member(hid) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  update public.wish_lists set share_code = null where id = p_list;
end;
$$;

-- What someone with the link sees: whose list it is, and the ideas with whether they're taken.
-- Returns null for a code that doesn't exist or has stopped being shared.
create function public.shared_wish_list(p_code text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'name', coalesce(l.name, p.display_name, 'Someone'),
    'ideas', coalesce((
      select jsonb_agg(jsonb_build_object(
          'id', i.id, 'title', i.title, 'note', i.note, 'link', i.link, 'price', i.price, 'favourite', i.favourite,
          'taken', c.idea_id is not null,
          'takenBy', coalesce(c.claimed_name, cp.display_name)
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

-- "I'm getting this" from a share link. Returns a secret the browser keeps to take it back later.
create function public.claim_shared_wish(p_code text, p_idea uuid, p_name text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  i public.wish_ideas;
  raw text;
begin
  select i2.* into i from public.wish_ideas i2 join public.wish_lists l on l.id = i2.list_id
  where i2.id = p_idea and l.share_code = p_code and p_code ~ '^[0-9A-Za-z]{10}$';
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if length(btrim(coalesce(p_name, ''))) not between 1 and 40 then
    raise exception 'name_needed' using errcode = '22023';
  end if;
  if exists (select 1 from public.wish_claims where idea_id = p_idea) then
    raise exception 'already_taken' using errcode = 'P0001';
  end if;
  insert into public.wish_claims (idea_id, list_id, household_id, claimed_name)
    values (i.id, i.list_id, i.household_id, btrim(p_name));
  raw := translate(encode(extensions.gen_random_bytes(24), 'base64'), '+/=', '-_');
  insert into public.wish_claim_tokens (idea_id, token_hash) values (p_idea, encode(extensions.digest(raw, 'sha256'), 'hex'));
  return raw;
end;
$$;

create function public.unclaim_shared_wish(p_code text, p_idea uuid, p_token text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.wish_claims c
  using public.wish_lists l, public.wish_claim_tokens t
  where c.idea_id = p_idea and l.id = c.list_id and l.share_code = p_code
    and t.idea_id = c.idea_id and t.token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex');
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.is_my_wish_list(uuid), public.stamp_wish_idea(), public.stamp_wish_claim(),
  public.share_wish_list(uuid), public.unshare_wish_list(uuid),
  public.shared_wish_list(text), public.claim_shared_wish(text, uuid, text), public.unclaim_shared_wish(text, uuid, text)
  from public, anon, authenticated;
grant execute on function public.is_my_wish_list(uuid), public.share_wish_list(uuid), public.unshare_wish_list(uuid) to authenticated;
grant execute on function public.shared_wish_list(text), public.claim_shared_wish(text, uuid, text), public.unclaim_shared_wish(text, uuid, text) to anon, authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.wish_lists, public.wish_ideas, public.wish_claims;
  end if;
end;
$$;
