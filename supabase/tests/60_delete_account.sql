-- Deleting an account: households alone are removed, shared ones keep going with a new owner.
\set ON_ERROR_STOP 1
\set dina '''dddddddd-0000-0000-0000-000000000004'''
\set eve  '''eeeeeeee-0000-0000-0000-000000000005'''
\set fred '''ffffffff-0000-0000-0000-000000000006'''

reset role;
insert into auth.users (id, email) values (:dina, 'dina@example.com'), (:eve, 'eve@example.com'), (:fred, 'fred@example.com');

set role authenticated;
select tests.login(:dina);
insert into tests.vars values ('solo', public.create_household('Dina Alone')::text);
insert into tests.vars values ('shared', public.create_household('Dina and friends')::text);
insert into public.storage_locations (household_id, name, type)
  values ((select v::uuid from tests.vars where k = 'shared'), 'Shared Pantry', 'pantry');
select public.add_stock((select id from public.storage_locations where name = 'Shared Pantry'), 'Rice', 2);

reset role;
-- Eve joined before Fred, so Eve should become owner.
insert into public.household_members (household_id, user_id, role, joined_at) values
  ((select v::uuid from tests.vars where k = 'shared'), :eve, 'member', now() - interval '2 days'),
  ((select v::uuid from tests.vars where k = 'shared'), :fred, 'member', now() - interval '1 day');

set role authenticated;
select tests.login(:dina);
select tests.fails($$select public.delete_account_data(auth.uid())$$, 'permission denied', 'people cannot call the deletion function directly');

reset role;
set role service_role;
select public.delete_account_data(:dina)::text as deleted \gset
reset role;
insert into tests.vars values ('deleted', :'deleted');
select tests.ok((select v from tests.vars where k = 'deleted') = '{' || (select v from tests.vars where k = 'solo') || '}', 'returns only the household that was deleted');
select tests.ok(not exists (select 1 from public.households where id = (select v::uuid from tests.vars where k = 'solo')), 'a household with no one else in it is deleted');
select tests.ok(exists (select 1 from public.households where id = (select v::uuid from tests.vars where k = 'shared')), 'a shared household carries on');
select tests.ok((select role from public.household_members where user_id = :eve) = 'owner', 'the longest-standing member becomes owner');
select tests.ok((select role from public.household_members where user_id = :fred) = 'member', 'others keep their role');
select tests.ok(not exists (select 1 from public.household_members where user_id = :dina), 'the person is no longer a member anywhere');

delete from auth.users where id = :dina;
select tests.ok((select added_by from public.stock_items where product_name = 'Rice') is null, 'things they added stay, without their name');
select tests.ok(not exists (select 1 from public.profiles where user_id = :dina), 'their profile is gone');
