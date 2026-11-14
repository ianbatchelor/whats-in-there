-- Family: presents and Christmas only. Molly has her own home; she's family in Ian's.
\set ON_ERROR_STOP 1
\set ian   '''f0f0f0f0-0000-0000-0000-00000000000a'''
\set shel  '''f0f0f0f0-0000-0000-0000-00000000000b'''
\set molly '''f0f0f0f0-0000-0000-0000-00000000000c'''
\set nobody '''f0f0f0f0-0000-0000-0000-00000000000d'''

reset role;
insert into auth.users (id, email) values (:ian, 'fi@example.com'), (:shel, 'fs@example.com'), (:molly, 'fm@example.com'), (:nobody, 'fn@example.com');
update public.profiles set display_name = 'Molly' where user_id = :molly;
update public.profiles set display_name = 'Ian' where user_id = :ian;

set role authenticated;
select tests.login(:ian);
insert into tests.vars values ('fy', public.create_household('Batchelor House')::text);
insert into public.storage_locations (household_id, name, type) values ((select v::uuid from tests.vars where k = 'fy'), 'Garage freezer', 'freezer');
insert into tests.vars select 'fy_freezer', id::text from public.storage_locations where name = 'Garage freezer' and household_id = (select v::uuid from tests.vars where k = 'fy');
select public.add_stock((select v::uuid from tests.vars where k = 'fy_freezer'), 'Sausages', 2);
insert into public.shopping_items (household_id, name) values ((select v::uuid from tests.vars where k = 'fy'), 'Milk');
insert into public.lists (household_id, title, visibility) values ((select v::uuid from tests.vars where k = 'fy'), 'Jobs before Mum visits', 'household');
insert into public.wish_lists (household_id, kind, for_user) values ((select v::uuid from tests.vars where k = 'fy'), 'books', :ian);
insert into public.wish_lists (household_id, name) values ((select v::uuid from tests.vars where k = 'fy'), 'Molly');
insert into public.wish_lists (household_id, for_user) values ((select v::uuid from tests.vars where k = 'fy'), :ian);
insert into tests.vars select 'fy_code', link_code from public.storage_locations where id = (select v::uuid from tests.vars where k = 'fy_freezer');
insert into tests.vars select 'fy_mollylist', id::text from public.wish_lists where name = 'Molly' and household_id = (select v::uuid from tests.vars where k = 'fy');
insert into public.wish_ideas (list_id, household_id, title) values ((select v::uuid from tests.vars where k = 'fy_mollylist'), (select v::uuid from tests.vars where k = 'fy'), 'Hiking boots');
insert into public.wish_claims (idea_id, list_id, household_id) select id, list_id, household_id from public.wish_ideas where title = 'Hiking boots';
insert into tests.vars select 'fy_home', token from public.create_invitation((select v::uuid from tests.vars where k = 'fy'));
insert into tests.vars select 'fy_fam', token from public.create_invitation((select v::uuid from tests.vars where k = 'fy'), 'family');

-- The link says what it's for before you join.
select tests.login(:nobody);
select tests.ok((select role = 'family' and household = 'Batchelor House' and invited_by = 'Ian'
                 from public.invitation_preview((select v from tests.vars where k = 'fy_fam'))), 'a family link says so before joining');
select tests.ok((select count(*) = 0 from public.invitation_preview('nope')), 'a wrong link shows nothing');

select tests.login(:shel);
select public.accept_invitation((select v from tests.vars where k = 'fy_home'));
select tests.login(:molly);
insert into tests.vars values ('fym', public.create_household('Molly''s Flat')::text);
select public.accept_invitation((select v from tests.vars where k = 'fy_fam'));
select tests.ok((select role = 'family' from public.household_members where user_id = :molly and household_id = (select v::uuid from tests.vars where k = 'fy')), 'Molly joins as family');
select tests.ok((select count(*) = 0 from public.invitation_preview((select v from tests.vars where k = 'fy_fam'))), 'a used link shows nothing');

-- What Molly sees of Ian's home: its name and people, and present lists. Nothing else.
select tests.ok((select count(*) = 2 from public.households), 'Molly sees her own home and Ian''s name');
select tests.ok((select count(*) = 3 from public.household_members where household_id = (select v::uuid from tests.vars where k = 'fy')), 'and who''s in it');
select tests.ok(not public.is_member((select v::uuid from tests.vars where k = 'fy')), 'family don''t count as living there');
select tests.ok((select count(*) = 0 from public.storage_locations where household_id = (select v::uuid from tests.vars where k = 'fy')), 'family can''t see places');
select tests.ok((select count(*) = 0 from public.stock_items where household_id = (select v::uuid from tests.vars where k = 'fy')), 'or what''s in them');
select tests.ok((select count(*) = 0 from public.stock_movements where household_id = (select v::uuid from tests.vars where k = 'fy')), 'or the history');
select tests.ok((select count(*) = 0 from public.shopping_items where household_id = (select v::uuid from tests.vars where k = 'fy')), 'or the shopping list');
select tests.ok((select count(*) = 0 from public.lists where title = 'Jobs before Mum visits'), 'or lists for everyone at home');
select tests.ok((select count(*) = 0 from public.wish_lists where kind = 'books' and household_id = (select v::uuid from tests.vars where k = 'fy')), 'or book wish lists');
select tests.ok((select public.resolve_location_code(v) is null from tests.vars where k = 'fy_code'), 'stickers don''t open for family');
select tests.fails($$select public.add_stock((select v::uuid from tests.vars where k = 'fy_freezer'), 'Sneaky', 1)$$, 'not_found', 'family can''t add to a place');
select tests.fails($$insert into public.storage_locations (household_id, name, type) values ((select v::uuid from tests.vars where k = 'fy'), 'Mine now', 'other')$$,
                   'row-level security', 'family can''t make places');
select tests.fails($$insert into public.shopping_items (household_id, name) values ((select v::uuid from tests.vars where k = 'fy'), 'Wine')$$,
                   'row-level security', 'family can''t add to the shopping list');
select tests.fails($$select public.create_invitation((select v::uuid from tests.vars where k = 'fy'))$$, 'not_owner', 'family can''t invite');
select tests.ok((select count(*) = 2 from public.wish_lists where household_id = (select v::uuid from tests.vars where k = 'fy')), 'family see the present lists');
select tests.ok((select count(*) = 1 from public.wish_claims), 'and what others are getting, on lists not their own');

-- Her own list: make it, add to it, add to Ian's.
insert into public.wish_lists (household_id, for_user) values ((select v::uuid from tests.vars where k = 'fy'), :molly);
insert into public.wish_ideas (list_id, household_id, title)
  select id, household_id, 'Whisky stones' from public.wish_lists where for_user = :ian and kind = 'presents';
insert into public.wish_claims (idea_id, list_id, household_id) select id, list_id, household_id from public.wish_ideas where title = 'Whisky stones';
select tests.ok((select claimed_by = :molly from public.wish_claims where idea_id = (select id from public.wish_ideas where title = 'Whisky stones')), 'family can say they''re getting something');
select tests.ok((select public.share_wish_list(id) is not null from public.wish_lists where for_user = :molly), 'family can share their own list');
delete from public.wish_lists where for_user = :ian;
select tests.ok((select count(*) = 1 from public.wish_lists where for_user = :ian), 'family can''t remove someone else''s list');

-- "This is me": the list Dad kept becomes hers, with its ideas; the empty one she made goes.
select public.claim_wish_list((select v::uuid from tests.vars where k = 'fy_mollylist'));
select tests.ok((select for_user = :molly and name is null from public.wish_lists where id = (select v::uuid from tests.vars where k = 'fy_mollylist')), 'the kept list becomes hers');
select tests.ok((select count(*) = 1 from public.wish_lists where for_user = :molly), 'her empty list made way');
select tests.ok((select count(*) = 1 from public.wish_ideas where title = 'Hiking boots'), 'the ideas came with it');
select tests.ok((select count(*) = 0 from public.wish_claims where list_id = (select v::uuid from tests.vars where k = 'fy_mollylist')), 'and what Dad''s getting her is now hidden');
select tests.fails($$select public.claim_wish_list((select v::uuid from tests.vars where k = 'fy_mollylist'))$$, 'not_found', 'a list that''s someone''s can''t be claimed');

-- Ian's household can't see Molly's home.
select tests.login(:ian);
select tests.ok((select count(*) = 1 from public.households), 'Ian doesn''t see Molly''s home');
select tests.ok((select count(*) = 1 from public.wish_claims where list_id = (select v::uuid from tests.vars where k = 'fy_mollylist')), 'Ian still sees his claim');

-- Roles: family can't be made the fallback owner; moving in through a home link.
select tests.fails($$select public.set_member_role((select v::uuid from tests.vars where k = 'fy'), 'f0f0f0f0-0000-0000-0000-00000000000a', 'family')$$,
                   'last_owner', 'the last owner can''t become family');
insert into tests.vars select 'fy_home2', token from public.create_invitation((select v::uuid from tests.vars where k = 'fy'));

-- Leaving: family can always leave.
select tests.login(:molly);
select public.leave_household((select v::uuid from tests.vars where k = 'fy'));
select tests.ok((select count(*) = 0 from public.wish_lists where household_id = (select v::uuid from tests.vars where k = 'fy')), 'after leaving, the present lists are gone');
select tests.ok((select count(*) = 1 from public.households), 'and her own home is untouched');

-- Back as family, then moving in with a home link.
select tests.login(:ian);
insert into tests.vars select 'fy_fam2', token from public.create_invitation((select v::uuid from tests.vars where k = 'fy'), 'family');
select tests.login(:molly);
select public.accept_invitation((select v from tests.vars where k = 'fy_fam2'));
select public.accept_invitation((select v from tests.vars where k = 'fy_home2'));
select tests.ok((select role = 'member' from public.household_members where user_id = :molly and household_id = (select v::uuid from tests.vars where k = 'fy')), 'a home link moves family in');
select tests.ok((select count(*) = 1 from public.storage_locations where household_id = (select v::uuid from tests.vars where k = 'fy')), 'and then they see the places');
select tests.login(:ian);
select public.set_member_role((select v::uuid from tests.vars where k = 'fy'), :molly, 'family');
select tests.login(:molly);
select tests.ok((select count(*) = 0 from public.storage_locations where household_id = (select v::uuid from tests.vars where k = 'fy')), 'an owner can make someone family again');

-- Deleting an account: ownership never passes to family; with only family left the household goes.
reset role;
delete from public.household_members where user_id = :shel and household_id = (select v::uuid from tests.vars where k = 'fy');
select tests.ok((select (select v::uuid from tests.vars where k = 'fy') = any(public.delete_account_data(:ian))), 'with only family left, the household is deleted');
select tests.ok((select count(*) = 0 from public.households where name = 'Batchelor House'), 'and gone');
select tests.ok((select count(*) = 1 from public.households where name = 'Molly''s Flat'), 'Molly''s own home stays');
