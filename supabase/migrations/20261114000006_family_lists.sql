-- Your own lists gain a fourth choice: 'family', everyone who lives in the household plus its family
-- members with homes of their own (a grown-up daughter, a grandparent). They see that list, can add to
-- it and tick things off, and nothing else of the household, as with present lists.
-- Only people who live in the household can make a list for it, as before.

alter table public.lists drop constraint lists_visibility_check;
alter table public.lists add constraint lists_visibility_check check (visibility in ('me', 'household', 'group', 'family'));
alter table public.lists drop constraint lists_check;
alter table public.lists add constraint lists_check check ((visibility in ('household', 'family')) = (household_id is not null));

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
           or (l.visibility = 'family' and public.in_family(l.household_id))
           or (l.visibility = 'group' and exists (
                 select 1 from public.list_members m where m.list_id = l.id and m.user_id = (select auth.uid()))))
  );
$$;
