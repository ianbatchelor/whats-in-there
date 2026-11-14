-- Group lists: friends join through a link and see that list only.
\set ON_ERROR_STOP 1
\set ray '''bbbbbbbb-0000-0000-0000-0000000000f1'''
\set sue '''bbbbbbbb-0000-0000-0000-0000000000f2'''
\set tom '''bbbbbbbb-0000-0000-0000-0000000000f3'''
\set una '''bbbbbbbb-0000-0000-0000-0000000000f4'''

reset role;
insert into auth.users (id, email) values (:ray, 'ray@example.com'), (:sue, 'sue@example.com'), (:tom, 'tom@example.com'), (:una, 'una@example.com');
update public.profiles set display_name = 'Ray' where user_id = :ray;
update public.profiles set display_name = 'Tom' where user_id = :tom;

set role authenticated;
select tests.login(:ray);
insert into tests.vars values ('gl_rh', public.create_household('Ray House')::text);
reset role;
-- Sue lives with Ray. Tom and Una are friends elsewhere, with no household at all.
insert into public.household_members (household_id, user_id, role) values ((select v::uuid from tests.vars where k = 'gl_rh'), :sue, 'member');
set role authenticated;
select tests.login(:ray);
insert into public.lists (title) values ('Camping trip');
insert into tests.vars select 'gl_camp', id::text from public.lists where title = 'Camping trip';
insert into public.list_entries (list_id, text) values ((select v::uuid from tests.vars where k = 'gl_camp'), 'Tent');
insert into public.lists (title) values ('Ray secret');
insert into public.list_entries (list_id, text) values ((select id from public.lists where title = 'Ray secret'), 'Secret thing');

-- Only the owner makes a link.
select tests.login(:sue);
select tests.fails($$select public.make_list_link((select v::uuid from tests.vars where k = 'gl_camp'))$$, 'not_found', 'only the owner can make a link');
select tests.login(:ray);
insert into tests.vars select 'gl_tok', token from public.make_list_link((select v::uuid from tests.vars where k = 'gl_camp'));
select tests.ok((select visibility = 'group' and household_id is null from public.lists where title = 'Camping trip'), 'making a link makes it a group list');
select tests.ok((select public.list_link_status((select v::uuid from tests.vars where k = 'gl_camp')) > now()), 'the owner can see the link is out');

-- The preview works signed out, and says only a little.
reset role;
set role anon;
select tests.login(null);
select tests.ok((select title = 'Camping trip' and owner_name = 'Ray' and things = 1 and people = 1
                 from public.list_invite_preview((select v from tests.vars where k = 'gl_tok'))), 'the invite page shows the name, who asked and how many');
select tests.ok((select count(*) = 0 from public.list_invite_preview('wrong')), 'a wrong link shows nothing');
select tests.fails($$select public.join_list((select v from tests.vars where k = 'gl_tok'))$$, 'permission denied', 'joining needs signing in');
reset role;
set role authenticated;

-- Tom joins. He sees the list and its people, and nothing else of Ray's.
select tests.login(:tom);
select tests.ok((select count(*) = 0 from public.lists), 'before joining Tom sees nothing');
select tests.ok((select public.join_list((select v from tests.vars where k = 'gl_tok')) = (select v::uuid from tests.vars where k = 'gl_camp')), 'Tom joins through the link');
select tests.ok((select public.join_list((select v from tests.vars where k = 'gl_tok')) is not null), 'joining twice is fine');
select tests.ok((select count(*) = 1 from public.lists where title = 'Camping trip'), 'Tom sees the group list');
select tests.ok((select count(*) = 0 from public.lists where title = 'Ray secret'), 'but not Ray''s private list');
select tests.ok((select count(*) = 0 from public.list_entries where text = 'Secret thing'), 'or anything on it');
select tests.ok((select count(*) = 0 from public.households), 'or Ray''s household');
select tests.ok((select count(*) = 0 from public.profiles where user_id = :ray), 'or Ray''s profile');
select tests.ok((select string_agg(display_name, ',' order by display_name) = 'Ray,Tom' from public.list_people()), 'the group''s names are shared, nothing more');
insert into public.list_entries (list_id, text) values ((select v::uuid from tests.vars where k = 'gl_camp'), 'Stove');
update public.list_entries set done_at = now() where text = 'Tent';
update public.lists set title = 'Mine now' where title = 'Camping trip';
select tests.fails($$select public.make_list_link((select v::uuid from tests.vars where k = 'gl_camp'))$$, 'not_found', 'a member can''t make links');

-- Sue lives with Ray but isn't in the group: she can't see it.
select tests.login(:sue);
select tests.ok((select count(*) = 0 from public.lists where title = 'Camping trip'), 'someone at home who wasn''t invited can''t see a group list');
select tests.ok((select count(*) = 0 from public.list_people()), 'nor its people');

-- Ray sees what Tom did; a new link stops the old one.
select tests.login(:ray);
select tests.ok((select title = 'Camping trip' from public.lists where id = (select v::uuid from tests.vars where k = 'gl_camp')), 'only the owner renames');
select tests.ok((select added_by = :tom from public.list_entries where text = 'Stove'), 'Ray sees what Tom added');
select tests.ok((select done_by = :tom from public.list_entries where text = 'Tent'), 'and what he ticked off');
insert into tests.vars select 'gl_tok2', token from public.make_list_link((select v::uuid from tests.vars where k = 'gl_camp'));
select tests.login(:una);
select tests.fails($$select public.join_list((select v from tests.vars where k = 'gl_tok'))$$, 'invitation_invalid', 'an old link stops working');
select public.join_list((select v from tests.vars where k = 'gl_tok2'));
select tests.ok((select count(*) = 1 from public.lists where title = 'Camping trip'), 'the new one works');
-- Una leaves.
delete from public.list_members where user_id = :una;
select tests.ok((select count(*) = 0 from public.lists where title = 'Camping trip'), 'leaving the group hides it');

-- Ray removes Tom; Tom can't remove anyone.
select tests.login(:tom);
delete from public.list_members where user_id <> :tom;
select tests.login(:ray);
delete from public.list_members where user_id = :tom;
select tests.login(:tom);
select tests.ok((select count(*) = 0 from public.lists where title = 'Camping trip'), 'the owner can take someone out');

-- Stopping the link; going back to Just me hides it from members.
select tests.login(:una);
select public.join_list((select v from tests.vars where k = 'gl_tok2'));
select tests.login(:ray);
select public.stop_list_link((select v::uuid from tests.vars where k = 'gl_camp'));
select tests.ok((select public.list_link_status((select v::uuid from tests.vars where k = 'gl_camp')) is null), 'the link can be stopped');
update public.lists set visibility = 'me' where id = (select v::uuid from tests.vars where k = 'gl_camp');
select tests.login(:una);
select tests.ok((select count(*) = 0 from public.list_entries where text = 'Stove'), 'switching to Just me hides it from the group');
select tests.ok((select count(*) = 0 from public.list_invite_preview((select v from tests.vars where k = 'gl_tok2'))), 'a stopped link shows nothing');
