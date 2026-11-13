-- Wine details on bottles, and tasting notes.
\set ON_ERROR_STOP 1
\set wyn '''a1a1a1a1-0000-0000-0000-0000000000c1'''
\set wes '''b2b2b2b2-0000-0000-0000-0000000000d2'''

reset role;
insert into auth.users (id, email) values (:wyn, 'wyn@example.com'), (:wes, 'wes@example.com');

set role authenticated;
select tests.login(:wyn);
insert into tests.vars values ('wh', public.create_household('Wyn House')::text);
insert into public.storage_locations (household_id, name, type) values ((select v::uuid from tests.vars where k = 'wh'), 'Wyn Rack', 'wine');
insert into tests.vars select 'w_rack', id::text from public.storage_locations where name = 'Wyn Rack';
insert into tests.vars select 'w_musar', (public.add_stock((select v::uuid from tests.vars where k = 'w_rack'), 'Château Musar', 3)).id::text;

select public.set_wine_details((select v::uuid from tests.vars where k = 'w_musar'), 2016, 'red', ' Cinsault ', 'Bekaa Valley', 2024, 2032, '', null);
select tests.ok((select vintage = 2016 and wine_colour = 'red' and grape = 'Cinsault' and drink_until = 2032 and saved_for is null and version = 2
                 from public.stock_items where id = (select v::uuid from tests.vars where k = 'w_musar')), 'wine details are saved, trimmed and blanks cleared');
select tests.fails($$select public.set_wine_details((select v::uuid from tests.vars where k = 'w_musar'), 2016, 'blue', null, null, null, null, null)$$,
                   'violates check', 'an unknown colour is refused');
select tests.fails($$select public.set_wine_details((select v::uuid from tests.vars where k = 'w_musar'), 2016, 'red', null, null, 2030, 2020, null)$$,
                   'violates check', 'a window that ends before it starts is refused');
select tests.fails($$select public.set_wine_details((select v::uuid from tests.vars where k = 'w_musar'), 2016, 'red', null, null, null, null, null, 1)$$,
                   'version_conflict', 'saving from a stale copy is refused');

insert into public.wine_notes (household_id, wine_name, vintage, stars, note, noted_by)
  values ((select v::uuid from tests.vars where k = 'wh'), 'Château Musar', 2016, 5, 'Christmas Day', :wyn);
select tests.ok((select count(*) = 1 from public.wine_notes), 'a tasting note can be added');

-- ---------- Other households ----------
select tests.login(:wes);
select tests.fails($$select public.set_wine_details((select v::uuid from tests.vars where k = 'w_musar'), 2016, 'red', null, null, null, null, null)$$,
                   'not_found', 'cannot change another household''s wine');
select tests.ok((select count(*) = 0 from public.wine_notes), 'cannot read another household''s notes');
select tests.fails($$insert into public.wine_notes (household_id, wine_name, stars, noted_by) values ((select v::uuid from tests.vars where k = 'wh'), 'Sneaky', 1, 'b2b2b2b2-0000-0000-0000-0000000000d2')$$,
                   'row-level security', 'cannot add notes to another household');
select tests.login(:wyn);
select tests.fails($$insert into public.wine_notes (household_id, wine_name, stars, noted_by) values ((select v::uuid from tests.vars where k = 'wh'), 'Musar', 4, 'b2b2b2b2-0000-0000-0000-0000000000d2')$$,
                   'row-level security', 'a note is always in your own name');

reset role;
