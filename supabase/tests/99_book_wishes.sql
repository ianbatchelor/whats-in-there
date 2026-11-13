-- Book wish lists: a second list each, book details, and the shared page saying it's books.
\set ON_ERROR_STOP 1
\set bea '''99999999-0000-0000-0000-00000000000b'''

reset role;
insert into auth.users (id, email) values (:bea, 'bea@example.com');
set role authenticated;
select tests.login(:bea);
insert into tests.vars values ('bkh', public.create_household('Book House')::text);
insert into public.wish_lists (household_id, for_user) values ((select v::uuid from tests.vars where k = 'bkh'), :bea);
insert into public.wish_lists (household_id, for_user, kind) values ((select v::uuid from tests.vars where k = 'bkh'), :bea, 'books');
select tests.ok((select count(*) = 2 from public.wish_lists where for_user = :bea), 'a present list and a book list each');
select tests.fails($$insert into public.wish_lists (household_id, for_user, kind) select household_id, for_user, 'books' from public.wish_lists where for_user = '99999999-0000-0000-0000-00000000000b' limit 1$$,
                   'duplicate key', 'only one book list each');
select tests.fails($$insert into public.wish_lists (household_id, for_user, kind) select household_id, null, 'films' from public.wish_lists where for_user = '99999999-0000-0000-0000-00000000000b' limit 1$$,
                   'check constraint', 'only presents or books');
select tests.fails($$insert into public.wish_ideas (list_id, household_id, title, isbn) select id, household_id, 'Bad', 'abc' from public.wish_lists where for_user = '99999999-0000-0000-0000-00000000000b' and kind = 'books'$$,
                   'check constraint', 'an ISBN must be digits');
insert into public.wish_ideas (list_id, household_id, title, author, isbn, cover_id)
  select id, household_id, 'Wolf Hall', 'Hilary Mantel', '9780007230204', 8231856 from public.wish_lists where for_user = :bea and kind = 'books';
insert into tests.vars select 'bcode', public.share_wish_list(id) from public.wish_lists where for_user = :bea and kind = 'books';

reset role;
set role anon;
select tests.ok((select public.shared_wish_list(v) ->> 'kind' = 'books' from tests.vars where k = 'bcode'), 'the shared page knows it is books');
select tests.ok((select public.shared_wish_list(v) -> 'ideas' -> 0 ->> 'author' = 'Hilary Mantel' from tests.vars where k = 'bcode'), 'the shared page gets the author');
select tests.ok((select (public.shared_wish_list(v) -> 'ideas' -> 0 ->> 'coverId')::int = 8231856 from tests.vars where k = 'bcode'), 'the shared page gets the cover');
