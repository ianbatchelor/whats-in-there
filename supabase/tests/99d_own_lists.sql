-- Your own lists: 'me' lists are seen by nobody else; 'household' lists by the household only.
\set ON_ERROR_STOP 1
\set ola '''aaaaaaaa-0000-0000-0000-0000000000f1'''
\set pip '''aaaaaaaa-0000-0000-0000-0000000000f2'''
\set quin '''aaaaaaaa-0000-0000-0000-0000000000f3'''

reset role;
insert into auth.users (id, email) values (:ola, 'ola@example.com'), (:pip, 'pip@example.com'), (:quin, 'quin@example.com');

set role authenticated;
select tests.login(:ola);
insert into tests.vars values ('olh', public.create_household('Ola House')::text);
reset role;
insert into public.household_members (household_id, user_id, role) values ((select v::uuid from tests.vars where k = 'olh'), :pip, 'member');
set role authenticated;

-- Ola makes a private list and a household one.
insert into public.lists (title) values ('Ideas for Pip');
select tests.ok((select owner = :ola and visibility = 'me' and household_id is null from public.lists where title = 'Ideas for Pip'), 'a new list is just for its maker');
insert into public.list_entries (list_id, text) values ((select id from public.lists where title = 'Ideas for Pip'), 'Scarf');
insert into public.lists (title, kind, visibility, household_id) values ('Jobs before the visit', 'todo', 'household', (select v::uuid from tests.vars where k = 'olh'));
insert into public.list_entries (list_id, text) values ((select id from public.lists where title = 'Jobs before the visit'), 'Mow the lawn');
insert into tests.vars select 'ol_private', id::text from public.lists where title = 'Ideas for Pip';
insert into tests.vars select 'ol_shared', id::text from public.lists where title = 'Jobs before the visit';

select tests.fails($$insert into public.lists (title, visibility) values ('Broken', 'household')$$, 'check', 'a household list needs its household');
select tests.fails($$insert into public.lists (title, owner) values ('Not mine', 'aaaaaaaa-0000-0000-0000-0000000000f2')$$, 'permission denied', 'nobody can make a list in someone else''s name');

-- Pip lives with Ola but can't see the private list or anything on it.
select tests.login(:pip);
select tests.ok((select count(*) = 0 from public.lists where title = 'Ideas for Pip'), 'a private list is hidden from the rest of the household');
select tests.ok((select count(*) = 0 from public.list_entries where text = 'Scarf'), 'and so is everything on it');
select tests.ok((select not public.can_see_list((select v::uuid from tests.vars where k = 'ol_private'))), 'the check agrees');
select tests.fails($$insert into public.list_entries (list_id, text) values ((select v::uuid from tests.vars where k = 'ol_private'), 'Peek')$$,
                   'row-level security', 'nothing can be added to someone else''s private list');
update public.list_entries set done_at = now() where list_id = (select v::uuid from tests.vars where k = 'ol_private');
delete from public.list_entries where list_id = (select v::uuid from tests.vars where k = 'ol_private');
update public.lists set title = 'Hacked' where id = (select v::uuid from tests.vars where k = 'ol_private');

-- The household list is shared: Pip can add and tick, but not rename, reshare or delete it.
select tests.ok((select count(*) = 1 from public.lists where title = 'Jobs before the visit'), 'a household list is seen by the household');
insert into public.list_entries (list_id, text) values ((select v::uuid from tests.vars where k = 'ol_shared'), 'Clean the windows');
update public.list_entries set done_at = '2000-01-01' where text = 'Mow the lawn';
select tests.ok((select done_by = :pip and done_at > now() - interval '1 minute' from public.list_entries where text = 'Mow the lawn'), 'ticking off records who and when');
select tests.fails($$update public.list_entries set done_by = 'aaaaaaaa-0000-0000-0000-0000000000f1' where text = 'Mow the lawn'$$, 'permission denied', 'nobody can say someone else did it');
update public.lists set title = 'Renamed', visibility = 'me', household_id = null where id = (select v::uuid from tests.vars where k = 'ol_shared');
delete from public.lists where id = (select v::uuid from tests.vars where k = 'ol_shared');

-- Someone outside the household sees neither.
select tests.login(:quin);
select tests.ok((select count(*) = 0 from public.lists), 'someone outside sees no lists');
select tests.ok((select count(*) = 0 from public.list_entries), 'and nothing on them');
select tests.fails($$insert into public.lists (title, visibility, household_id) values ('Sneaky', 'household', (select v::uuid from tests.vars where k = 'olh'))$$,
                   'row-level security', 'a list can''t be shared with a household you''re not in');

-- Back to Ola: nothing Pip tried on the private list or the settings got through.
select tests.login(:ola);
select tests.ok((select count(*) = 1 and bool_and(done_at is null) from public.list_entries where text = 'Scarf'), 'the private list is untouched');
select tests.ok((select title = 'Ideas for Pip' from public.lists where id = (select v::uuid from tests.vars where k = 'ol_private')), 'its name too');
select tests.ok((select title = 'Jobs before the visit' and visibility = 'household' from public.lists where id = (select v::uuid from tests.vars where k = 'ol_shared')), 'only the owner changes a shared list');
select tests.ok((select count(*) = 2 from public.list_entries where list_id = (select v::uuid from tests.vars where k = 'ol_shared')), 'Ola sees what Pip added');
select tests.ok((select added_by = :pip from public.list_entries where text = 'Clean the windows'), 'and who added it');

-- Ola makes the household list private again: Pip loses sight of it straight away.
update public.lists set visibility = 'me', household_id = null where id = (select v::uuid from tests.vars where k = 'ol_shared');
select tests.login(:pip);
select tests.ok((select count(*) = 0 from public.list_entries where text = 'Clean the windows'), 'going back to Just me hides it, even what others added');

-- Ola deletes the account: their lists go with it.
reset role;
delete from auth.users where id = :ola;
select tests.ok((select count(*) = 0 from public.lists where title in ('Ideas for Pip', 'Jobs before the visit')), 'deleting the account deletes its lists');
