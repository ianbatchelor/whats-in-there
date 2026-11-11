-- Delete my account (App Store guideline 5.1.1(v)).
-- Called only by the delete-account Edge Function, with the service role, after it has checked that the
-- person signed in again in the last few minutes. The function then removes the photos of every household
-- this returns and deletes the auth.users row, which cascades to profiles and memberships and sets
-- added_by, actor_user_id, created_by and similar columns to null.
--
-- For each household the person belongs to:
--   - the only member: the household and everything in it is deleted;
--   - the last owner with others left: the longest-standing other member becomes owner, then they leave;
--   - otherwise: they leave.
create function public.delete_account_data(p_user uuid)
returns uuid[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  m record;
  members int;
  owners int;
  deleted uuid[] := '{}';
begin
  if p_user is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  for m in
    select household_id, role from public.household_members where user_id = p_user order by household_id for update
  loop
    select count(*), count(*) filter (where role = 'owner') into members, owners
    from public.household_members where household_id = m.household_id;

    if members = 1 then
      delete from public.households where id = m.household_id;
      deleted := deleted || m.household_id;
    else
      if m.role = 'owner' and owners = 1 then
        update public.household_members set role = 'owner'
        where household_id = m.household_id and user_id = (
          select user_id from public.household_members
          where household_id = m.household_id and user_id <> p_user
          order by joined_at, user_id
          limit 1);
      end if;
      delete from public.household_members where household_id = m.household_id and user_id = p_user;
    end if;
  end loop;
  return deleted;
end;
$$;

revoke all on function public.delete_account_data(uuid) from public, anon, authenticated;
grant execute on function public.delete_account_data(uuid) to service_role;
