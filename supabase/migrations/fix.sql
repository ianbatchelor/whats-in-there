-- Making any new list failed with "new row violates row-level security policy".
-- The app inserts and asks for the new id back (insert ... returning id), so Postgres also
-- checks the select policy against the new row. That policy only called can_see_list(id),
-- which looks the list up in the table, and inside the same statement it cannot see the row
-- being inserted yet, so it said no. The owner can always see their own list, so check that
-- directly on the row first, as the policy did before group lists (20261114000002). Nobody gains access they did not already have.

alter policy lists_select on public.lists
  using (owner = (select auth.uid()) or public.can_see_list(id));
