-- Family members. A row in household_members with role 'family' lets that person see the household's
-- present lists (add ideas, say "I'm getting this", keep their own list) and its name and people.
-- Everything else stays shut: is_member() now means "lives here", so every existing rule for places,
-- stock, shopping, lists, scans and photos keeps family out without being touched.

-- ---------- Who counts as what ----------

-- Lives here (owner or member). Every existing policy and function goes through this.
create or replace function public.is_member(hid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.household_members m
    where m.household_id = hid and m.user_id = (select auth.uid()) and m.role <> 'family'
  );
$$;

-- Lives here, or is family.
create function public.in_family(hid uuid)
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

-- Whether a wish list is a present list (book lists and the rest stay at home).
create function public.is_present_list(p_list uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.wish_lists l where l.id = p_list and l.kind = 'presents');
$$;

revoke all on function public.in_family(uuid), public.is_present_list(uuid) from public, anon;
grant execute on function public.in_family(uuid), public.is_present_list(uuid) to authenticated;

-- ---------- The household itself: family see its name and its people ----------

drop policy households_select on public.households;
create policy households_select on public.households for select to authenticated
  using (public.in_family(id));

drop policy household_members_select on public.household_members;
create policy household_members_select on public.household_members for select to authenticated
  using (public.in_family(household_id));

-- ---------- Photos: these policies read household_members directly, so shut family out here too ----------

drop policy item_photos_select on storage.objects;
drop policy item_photos_insert on storage.objects;
drop policy item_photos_delete on storage.objects;
create policy item_photos_select on storage.objects for select to authenticated
  using (bucket_id = 'item-photos' and (storage.foldername(name))[1] in (
    select m.household_id::text from public.household_members m where m.user_id = (select auth.uid()) and m.role <> 'family'));
create policy item_photos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'item-photos' and (storage.foldername(name))[1] in (
    select m.household_id::text from public.household_members m where m.user_id = (select auth.uid()) and m.role <> 'family'));
create policy item_photos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'item-photos' and (storage.foldername(name))[1] in (
    select m.household_id::text from public.household_members m where m.user_id = (select auth.uid()) and m.role <> 'family'));

-- ---------- Present lists: open to family ----------
-- Family can see every present list, add ideas to any of them, keep their own list and add lists for
-- people without an account. They can rename or remove only lists that are theirs or that they made.

drop policy wish_lists_select on public.wish_lists;
drop policy wish_lists_insert on public.wish_lists;
drop policy wish_lists_update on public.wish_lists;
drop policy wish_lists_delete on public.wish_lists;
create policy wish_lists_select on public.wish_lists for select to authenticated
  using (public.is_member(household_id) or (kind = 'presents' and public.in_family(household_id)));
create policy wish_lists_insert on public.wish_lists for insert to authenticated
  with check ((public.is_member(household_id) or (kind = 'presents' and public.in_family(household_id)))
    and (for_user is null or exists (
      select 1 from public.household_members m where m.household_id = wish_lists.household_id and m.user_id = wish_lists.for_user)));
create policy wish_lists_update on public.wish_lists for update to authenticated
  using (public.is_member(household_id)
         or (kind = 'presents' and public.in_family(household_id)
             and (for_user = (select auth.uid()) or created_by = (select auth.uid()))))
  with check (public.is_member(household_id) or (kind = 'presents' and public.in_family(household_id)));
create policy wish_lists_delete on public.wish_lists for delete to authenticated
  using (public.is_member(household_id)
         or (kind = 'presents' and public.in_family(household_id)
             and (for_user = (select auth.uid()) or created_by = (select auth.uid()))));

drop policy wish_ideas_select on public.wish_ideas;
drop policy wish_ideas_insert on public.wish_ideas;
drop policy wish_ideas_update on public.wish_ideas;
drop policy wish_ideas_delete on public.wish_ideas;
create policy wish_ideas_select on public.wish_ideas for select to authenticated
  using (public.is_member(household_id) or (public.in_family(household_id) and public.is_present_list(list_id)));
create policy wish_ideas_insert on public.wish_ideas for insert to authenticated
  with check (public.is_member(household_id) or (public.in_family(household_id) and public.is_present_list(list_id)));
create policy wish_ideas_update on public.wish_ideas for update to authenticated
  using (public.is_member(household_id) or (public.in_family(household_id) and public.is_present_list(list_id)))
  with check (public.is_member(household_id) or (public.in_family(household_id) and public.is_present_list(list_id)));
create policy wish_ideas_delete on public.wish_ideas for delete to authenticated
  using (public.is_member(household_id) or (public.in_family(household_id) and public.is_present_list(list_id)));

-- Nobody sees, makes or takes back claims on their own list, family included.
drop policy wish_claims_select on public.wish_claims;
drop policy wish_claims_insert on public.wish_claims;
drop policy wish_claims_delete on public.wish_claims;
create policy wish_claims_select on public.wish_claims for select to authenticated
  using ((public.is_member(household_id) or (public.in_family(household_id) and public.is_present_list(list_id)))
         and not public.is_my_wish_list(list_id));
create policy wish_claims_insert on public.wish_claims for insert to authenticated
  with check ((public.is_member(household_id) or (public.in_family(household_id) and public.is_present_list(list_id)))
              and not public.is_my_wish_list(list_id));
create policy wish_claims_delete on public.wish_claims for delete to authenticated
  using ((public.is_member(household_id) or (public.in_family(household_id) and public.is_present_list(list_id)))
         and not public.is_my_wish_list(list_id)
         and (claimed_by = (select auth.uid()) or claimed_by is null));

-- Family can share a present list by link, and stop sharing it, like anyone at home.
create or replace function public.share_wish_list(p_list uuid)
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
  if not found or not (public.is_member(l.household_id) or (l.kind = 'presents' and public.in_family(l.household_id))) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if l.share_code is null then
    update public.wish_lists set share_code = public.generate_link_code() where id = p_list returning * into l;
  end if;
  return l.share_code;
end;
$$;

create or replace function public.unshare_wish_list(p_list uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  l public.wish_lists;
begin
  perform public.require_user();
  select * into l from public.wish_lists where id = p_list for update;
  if not found or not (public.is_member(l.household_id) or (l.kind = 'presents' and public.in_family(l.household_id))) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  update public.wish_lists set share_code = null where id = p_list;
end;
$$;

-- "This is me": someone who just joined takes over the list kept for them (for_user is null), with
-- its ideas. An empty list of their own is removed first; one with ideas in it means no.
-- Claims on it disappear from their view from now on, as on any list of your own.
create function public.claim_wish_list(p_list uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.require_user();
  l public.wish_lists;
  own uuid;
begin
  select * into l from public.wish_lists where id = p_list for update;
  if not found or l.for_user is not null or l.friend or not public.in_family(l.household_id)
     or (l.kind <> 'presents' and not public.is_member(l.household_id)) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  select id into own from public.wish_lists where household_id = l.household_id and kind = l.kind and for_user = uid for update;
  if own is not null then
    if exists (select 1 from public.wish_ideas where list_id = own) then
      raise exception 'list_not_empty' using errcode = 'P0001';
    end if;
    delete from public.wish_lists where id = own;
  end if;
  -- Anything you'd said you were getting from it is yours now, so it would only spoil the surprise.
  delete from public.wish_claims where list_id = p_list and claimed_by = uid;
  update public.wish_lists set for_user = uid, name = null where id = p_list;
end;
$$;
revoke all on function public.claim_wish_list(uuid) from public, anon;
grant execute on function public.claim_wish_list(uuid) to authenticated;

-- ---------- Joining, leaving and roles ----------

-- What an invitation link is for, before you join: the household's name, who sent it and whether
-- it's for family. Nothing comes back for a link that's used, stopped or out of date.
create function public.invitation_preview(p_token text)
returns table (household text, invited_by text, role public.member_role)
language sql
stable
security definer
set search_path = ''
as $$
  select h.name, coalesce(p.display_name, 'Someone'), i.role
  from public.household_invitations i
  join public.households h on h.id = i.household_id
  left join public.profiles p on p.user_id = i.created_by
  where i.token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex')
    and i.used_at is null and i.revoked_at is null and i.expires_at > now();
$$;
revoke all on function public.invitation_preview(text) from public;
grant execute on function public.invitation_preview(text) to anon, authenticated;

-- As before, plus: family who are invited to live here move in. Someone who already lives here
-- keeps everything when they open a family link.
create or replace function public.accept_invitation(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.require_user();
  inv public.household_invitations%rowtype;
  mine public.member_role;
begin
  select * into inv from public.household_invitations
  where token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex')
  for update;

  if not found or inv.revoked_at is not null then
    raise exception 'invitation_invalid' using errcode = 'P0001';
  end if;
  select role into mine from public.household_members where household_id = inv.household_id and user_id = uid;
  if found and (mine <> 'family' or inv.role = 'family') then
    return inv.household_id;   -- already in; don't burn the link
  end if;
  if inv.used_at is not null then
    raise exception 'invitation_used' using errcode = 'P0001';
  end if;
  if inv.expires_at <= now() then
    raise exception 'invitation_expired' using errcode = 'P0001';
  end if;

  if mine is not null then
    update public.household_members set role = inv.role where household_id = inv.household_id and user_id = uid;
  else
    insert into public.household_members (household_id, user_id, role) values (inv.household_id, uid, inv.role);
  end if;
  update public.household_invitations set used_at = now(), used_by = uid where id = inv.id;
  return inv.household_id;
end;
$$;

-- As before, but the last person living here can't stop being an owner by becoming family either.
create or replace function public.set_member_role(p_household uuid, p_user uuid, p_role public.member_role)
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
  if p_role <> 'owner' and (select count(*) from public.household_members
       where household_id = p_household and role = 'owner' and user_id <> p_user) = 0 then
    raise exception 'last_owner' using errcode = 'P0001';
  end if;
  update public.household_members set role = p_role where household_id = p_household and user_id = p_user;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
end;
$$;

-- Family can always leave. When the last person who lives here leaves, the household goes, family or not.
create or replace function public.leave_household(p_household uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.require_user();
  me public.household_members%rowtype;
  at_home int;
  owners int;
begin
  select * into me from public.household_members where household_id = p_household and user_id = uid for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  select count(*) filter (where role <> 'family'), count(*) filter (where role = 'owner') into at_home, owners
  from public.household_members where household_id = p_household;

  if me.role <> 'family' and at_home = 1 then
    -- Stock doesn't cascade with its place, so it goes first (this used to stop the household going).
    delete from public.stock_items where household_id = p_household;
    delete from public.households where id = p_household;       -- last one out: household goes too
  elsif me.role = 'owner' and owners = 1 then
    raise exception 'last_owner' using errcode = 'P0001';       -- hand over ownership first
  else
    delete from public.household_members where household_id = p_household and user_id = uid;
  end if;
end;
$$;

-- Deleting an account: ownership passes to the longest-standing person who lives there, never to
-- family. With nobody else living there, the household is deleted.
create or replace function public.delete_account_data(p_user uuid)
returns uuid[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  m record;
  at_home int;
  owners int;
  deleted uuid[] := '{}';
begin
  if p_user is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  for m in
    select household_id, role from public.household_members where user_id = p_user order by household_id for update
  loop
    select count(*) filter (where role <> 'family'), count(*) filter (where role = 'owner') into at_home, owners
    from public.household_members where household_id = m.household_id;

    if m.role <> 'family' and at_home = 1 then
      delete from public.stock_items where household_id = m.household_id;
      delete from public.households where id = m.household_id;
      deleted := deleted || m.household_id;
    else
      if m.role = 'owner' and owners = 1 then
        update public.household_members set role = 'owner'
        where household_id = m.household_id and user_id = (
          select user_id from public.household_members
          where household_id = m.household_id and user_id <> p_user and role <> 'family'
          order by joined_at, user_id
          limit 1);
      end if;
      delete from public.household_members where household_id = m.household_id and user_id = p_user;
    end if;
  end loop;
  return deleted;
end;
$$;
