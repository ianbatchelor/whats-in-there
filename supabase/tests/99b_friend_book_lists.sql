-- Friends' own book lists and suggestions, from a book list link with no account.
\set ON_ERROR_STOP 1
\set fio '''99999999-0000-0000-0000-00000000000f'''

reset role;
insert into auth.users (id, email) values (:fio, 'fio@example.com');
set role authenticated;
select tests.login(:fio);
insert into tests.vars values ('fh', public.create_household('Friend House')::text);
insert into public.wish_lists (household_id, for_user, kind) values ((select v::uuid from tests.vars where k = 'fh'), :fio, 'books');
insert into public.wish_lists (household_id, for_user) values ((select v::uuid from tests.vars where k = 'fh'), :fio);
insert into tests.vars select 'fbooks', public.share_wish_list(id) from public.wish_lists where for_user = :fio and kind = 'books';
insert into tests.vars select 'fpresents', public.share_wish_list(id) from public.wish_lists where for_user = :fio and kind = 'presents';

reset role;
set role anon;
select tests.login(null);
select tests.fails($$select public.start_friend_book_list((select v from tests.vars where k = 'fpresents'), 'Carol')$$, 'not_found', 'a present list link cannot start a book list');
select tests.fails($$select public.start_friend_book_list((select v from tests.vars where k = 'fbooks'), '  ')$$, 'name_needed', 'a friend must give a name');
insert into tests.vars select 'carol', public.start_friend_book_list(v, 'Carol')::text from tests.vars where k = 'fbooks';
insert into tests.vars select 'ccode', (v::jsonb) ->> 'code' from tests.vars where k = 'carol';
insert into tests.vars select 'ckey', (v::jsonb) ->> 'key' from tests.vars where k = 'carol';
select public.add_friend_book((select v from tests.vars where k = 'ccode'), (select v from tests.vars where k = 'ckey'), 'Piranesi', 'Susanna Clarke', null, null);
select tests.ok((select public.shared_wish_list(v) -> 'ideas' -> 0 ->> 'title' = 'Piranesi' from tests.vars where k = 'ccode'), 'a friend adds to their own list');
select tests.ok((select (public.shared_wish_list(v) ->> 'friend')::boolean from tests.vars where k = 'ccode'), 'the shared page knows it is a friend''s list');
select tests.fails($$select public.add_friend_book((select v from tests.vars where k = 'ccode'), 'wrong-key', 'Sneaky', null, null, null)$$, 'not_found', 'the wrong key cannot add');
select tests.fails($$select public.add_friend_book((select v from tests.vars where k = 'fbooks'), (select v from tests.vars where k = 'ckey'), 'Sneaky', null, null, null)$$, 'not_found', 'a friend''s key does not open the household''s list');
select tests.fails($$select * from public.wish_list_keys$$, 'permission denied', 'keys are never readable');
select public.suggest_shared_book((select v from tests.vars where k = 'fbooks'), 'Carol', 'Clear', 'Carys Davies', null, null);
select tests.ok((select public.shared_wish_list(v) -> 'ideas' -> 0 ->> 'suggestedBy' = 'Carol' from tests.vars where k = 'fbooks'), 'a suggestion carries the name');

reset role;
set role authenticated;
select tests.login(:fio);
select tests.ok((select count(*) = 1 from public.wish_lists where friend and name = 'Carol'), 'the household sees Carol''s list');
insert into public.wish_claims (idea_id, list_id, household_id)
  select i.id, i.list_id, i.household_id from public.wish_ideas i join public.wish_lists l on l.id = i.list_id where l.name = 'Carol';
reset role;
set role anon;
select tests.login(null);
select tests.ok((select (public.shared_wish_list(v) -> 'ideas' -> 0 ->> 'taken')::boolean from tests.vars where k = 'ccode'), 'the household can get Carol a book');
select public.remove_friend_book((select v from tests.vars where k = 'ccode'), (select v from tests.vars where k = 'ckey'),
  (select (public.shared_wish_list(v) -> 'ideas' -> 0 ->> 'id')::uuid from tests.vars where k = 'ccode'));
select tests.ok((select jsonb_array_length(public.shared_wish_list(v) -> 'ideas') = 0 from tests.vars where k = 'ccode'), 'a friend removes a book');
select public.remove_friend_book_list((select v from tests.vars where k = 'ccode'), (select v from tests.vars where k = 'ckey'));
select tests.ok((select public.shared_wish_list(v) is null from tests.vars where k = 'ccode'), 'a friend removes their list');
