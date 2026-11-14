-- Lists for the household and its family: Molly (family, own home) sees and adds to them, nothing else.
\set ON_ERROR_STOP 1
\set ian   '''f2f2f2f2-0000-0000-0000-00000000000a'''
\set shel  '''f2f2f2f2-0000-0000-0000-00000000000b'''
\set molly '''f2f2f2f2-0000-0000-0000-00000000000c'''
\set pal   '''f2f2f2f2-0000-0000-0000-00000000000d'''

reset role;
insert into auth.users (id, email) values (:ian, 'li@example.com'), (:shel, 'ls@example.com'), (:molly, 'lm@example.com'), (:pal, 'lp@example.com');

set role authenticated;
select tests.login(:ian);
insert into tests.vars values ('fl', public.create_household('Batchelor House')::text);
insert into tests.vars select 'fl_fam', token from public.create_invitation((select v::uuid from tests.vars where k = 'fl'), 'family');
insert into tests.vars select 'fl_home', token from public.create_invitation((select v::uuid from tests.vars where k = 'fl'));
select tests.login(:shel);
select public.accept_invitation((select v from tests.vars where k = 'fl_home'));
select tests.login(:molly);
select public.accept_invitation((select v from tests.vars where k = 'fl_fam'));

select tests.login(:ian);
insert into public.lists (title, visibility, household_id) values ('Christmas Day: who brings what', 'family', (select v::uuid from tests.vars where k = 'fl'));
insert into public.lists (title, visibility, household_id) values ('Jobs at home', 'household', (select v::uuid from tests.vars where k = 'fl'));
insert into public.list_entries (list_id, text) select id, 'Turkey' from public.lists where title = 'Christmas Day: who brings what';
select tests.fails($$insert into public.lists (title, visibility) values ('Broken', 'family')$$, 'check', 'a family list needs its household');

select tests.login(:shel);
select tests.ok((select count(*) = 2 from public.lists), 'people at home see the family list and the home one');

select tests.login(:molly);
select tests.ok((select count(*) = 1 from public.lists where title = 'Christmas Day: who brings what'), 'family see the family list');
select tests.ok((select count(*) = 0 from public.lists where title = 'Jobs at home'), 'but not lists for people at home');
insert into public.list_entries (list_id, text) select id, 'Trifle' from public.lists where title = 'Christmas Day: who brings what';
update public.list_entries set done_at = now() where text = 'Turkey';
select tests.ok((select count(*) = 2 from public.list_entries), 'family can add to it');
select tests.ok((select done_by = :molly from public.list_entries where text = 'Turkey'), 'and tick things off');
update public.lists set title = 'Mine now' where title = 'Christmas Day: who brings what';
select tests.ok((select count(*) = 0 from public.lists where title = 'Mine now'), 'only the owner renames it');
select tests.fails($$insert into public.lists (title, visibility, household_id) values ('Sneaky', 'family', (select v::uuid from tests.vars where k = 'fl'))$$,
                   'row-level security', 'family can''t make lists in a home they don''t live in');

select tests.login(:pal);
select tests.ok((select count(*) = 0 from public.lists), 'strangers see nothing');
select tests.ok((select count(*) = 0 from public.list_entries), 'or anything on it');

-- Back to just home: family stop seeing it.
select tests.login(:ian);
update public.lists set visibility = 'household' where title = 'Christmas Day: who brings what';
select tests.login(:molly);
select tests.ok((select count(*) = 0 from public.lists), 'switched to home only, family stop seeing it');
select tests.ok((select count(*) = 0 from public.list_entries), 'and what''s on it');
