-- New kinds of place, and lending things out.
\set ON_ERROR_STOP 1
\set ivy '''77777777-0000-0000-0000-000000000009'''
\set joe '''66666666-0000-0000-0000-00000000000a'''

reset role;
insert into auth.users (id, email) values (:ivy, 'ivy@example.com'), (:joe, 'joe@example.com');

set role authenticated;
select tests.login(:ivy);
insert into tests.vars values ('ih', public.create_household('Ivy House')::text);
insert into public.storage_locations (household_id, name, type) values
  ((select v::uuid from tests.vars where k = 'ih'), 'Ivy Bookshelf', 'bookshelf'),
  ((select v::uuid from tests.vars where k = 'ih'), 'Ivy Toy box', 'toybox'),
  ((select v::uuid from tests.vars where k = 'ih'), 'Ivy Desk', 'desk'),
  ((select v::uuid from tests.vars where k = 'ih'), 'Ivy Medicine', 'medicine'),
  ((select v::uuid from tests.vars where k = 'ih'), 'Ivy Car', 'car');
select tests.ok((select count(*) = 5 from public.storage_locations where household_id = (select v::uuid from tests.vars where k = 'ih')), 'the five new kinds of place can be added');
insert into tests.vars select 'i_shelf', id::text from public.storage_locations where name = 'Ivy Bookshelf';
insert into tests.vars select 'i_book', (public.add_stock((select v::uuid from tests.vars where k = 'i_shelf'), 'The Hobbit', 1)).id::text;

-- ---------- Lend ----------
select public.lend_stock((select v::uuid from tests.vars where k = 'i_book'), '  Mum  ', 1);
select tests.ok((select lent_to = 'Mum' and lent_on = current_date and version = 2 from public.stock_items where id = (select v::uuid from tests.vars where k = 'i_book')),
                'lending keeps who has it and since when');
select tests.ok((select notes = 'Mum' and quantity_delta = 0 from public.stock_movements where stock_item_id = (select v::uuid from tests.vars where k = 'i_book') and action = 'lend'),
                'lending is in the history with the person''s name');
select tests.fails($$select public.lend_stock((select v::uuid from tests.vars where k = 'i_book'), 'Dad', 1)$$, 'version_conflict', 'lending from a stale copy is refused');
select tests.fails($$select public.lend_stock((select v::uuid from tests.vars where k = 'i_book'), repeat('x', 61))$$, 'invalid_name', 'a very long name is refused');
select tests.fails($$select public.undo_movement((select id from public.stock_movements where stock_item_id = (select v::uuid from tests.vars where k = 'i_book') and action = 'lend'))$$,
                   'cannot_undo', 'a lend is not undone from history');
select public.lend_stock((select v::uuid from tests.vars where k = 'i_book'), null);
select tests.ok((select lent_to is null and lent_on is null from public.stock_items where id = (select v::uuid from tests.vars where k = 'i_book')), 'giving it back clears the lend');
select tests.ok((select notes = 'Mum' from public.stock_movements where stock_item_id = (select v::uuid from tests.vars where k = 'i_book') and action = 'return'),
                'the return names who gave it back');
select tests.ok((select (public.lend_stock((select v::uuid from tests.vars where k = 'i_book'), ' ')).version)
                = (select version from public.stock_items where id = (select v::uuid from tests.vars where k = 'i_book')), 'giving back something not lent changes nothing');

-- ---------- Other households ----------
select tests.login(:joe);
select tests.fails($$select public.lend_stock((select v::uuid from tests.vars where k = 'i_book'), 'Joe')$$, 'not_found', 'cannot lend another household''s things');
select tests.login(:ivy);
select tests.fails($$update public.stock_items set lent_to = 'Me', lent_on = current_date$$, 'permission denied', 'no direct lending');
