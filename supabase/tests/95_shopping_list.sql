-- The shared shopping list.
\set ON_ERROR_STOP 1
\set mia '''66666666-0000-0000-0000-00000000000d'''
\set ned '''77777777-0000-0000-0000-00000000000e'''

reset role;
insert into auth.users (id, email) values (:mia, 'mia@example.com'), (:ned, 'ned@example.com');

set role authenticated;
select tests.login(:ned);
insert into tests.vars values ('nh', public.create_household('Ned House')::text);
insert into public.storage_locations (household_id, name, type) values ((select v::uuid from tests.vars where k = 'nh'), 'Ned Fridge', 'fridge');
insert into tests.vars select 'n_fridge', id::text from public.storage_locations where name = 'Ned Fridge';
insert into public.shopping_items (household_id, name) values ((select v::uuid from tests.vars where k = 'nh'), 'Ned Bread');

select tests.login(:mia);
insert into tests.vars values ('mh', public.create_household('Mia House')::text);
insert into public.storage_locations (household_id, name, type) values ((select v::uuid from tests.vars where k = 'mh'), 'Mia Fridge', 'fridge');
insert into tests.vars select 'm_fridge', id::text from public.storage_locations where name = 'Mia Fridge';

insert into public.shopping_items (household_id, name, brand, quantity, unit, location_id)
  values ((select v::uuid from tests.vars where k = 'mh'), 'Milk', 'Cravendale', 2, 'l', (select v::uuid from tests.vars where k = 'm_fridge'));
select tests.ok((select added_by = :mia from public.shopping_items where name = 'Milk'), 'added by is the person signed in');
select tests.fails($$insert into public.shopping_items (household_id, name, added_by) values ((select v::uuid from tests.vars where k = 'mh'), 'Jam', '77777777-0000-0000-0000-00000000000e')$$,
                   'permission denied', 'nobody can say someone else added it');
select tests.fails($$update public.shopping_items set bought_by = '77777777-0000-0000-0000-00000000000e' where name = 'Milk'$$,
                   'permission denied', 'nobody can say someone else bought it');

select tests.ok((select count(*) = 0 from public.shopping_items where name = 'Ned Bread'), 'another household''s list can''t be seen');
select tests.fails($$insert into public.shopping_items (household_id, name) values ((select v::uuid from tests.vars where k = 'nh'), 'Sneaky')$$,
                   'row-level security', 'nothing can be added to another household''s list');
select tests.fails($$insert into public.shopping_items (household_id, name) values ((select v::uuid from tests.vars where k = 'mh'), ' milk ')$$,
                   'shopping_items_once_idx', 'the same thing can''t be on the list twice');
select tests.fails($$insert into public.shopping_items (household_id, name, location_id) values ((select v::uuid from tests.vars where k = 'mh'), 'Eggs', (select v::uuid from tests.vars where k = 'n_fridge'))$$,
                   'foreign key', 'a thing can''t be set to go in another household''s place');

update public.shopping_items set bought_at = '2000-01-01' where name = 'Milk';
select tests.ok((select bought_by = :mia and bought_at > now() - interval '1 minute' from public.shopping_items where name = 'Milk'), 'ticking off records who and when');
insert into public.shopping_items (household_id, name) values ((select v::uuid from tests.vars where k = 'mh'), 'Milk');
select tests.ok((select count(*) = 2 from public.shopping_items where name = 'Milk'), 'something bought can go back on the list');
delete from public.shopping_items where name = 'Milk' and bought_at is null;

select tests.ok((select (public.put_away_shopping((select id from public.shopping_items where name = 'Milk'))).quantity = 2), 'putting away adds it to its place');
select tests.ok((select count(*) = 1 from public.stock_items where product_name = 'Milk' and brand = 'Cravendale' and unit = 'l'
                  and location_id = (select v::uuid from tests.vars where k = 'm_fridge')), 'it arrives with its brand and amount');
select tests.ok((select count(*) = 0 from public.shopping_items where name = 'Milk'), 'and comes off the list');

insert into public.shopping_items (household_id, name) values ((select v::uuid from tests.vars where k = 'mh'), 'Foil');
select tests.fails($$select public.put_away_shopping((select id from public.shopping_items where name = 'Foil'))$$, 'no_place', 'putting away needs a place');

select tests.login(:ned);
select tests.fails($$select public.put_away_shopping((select id from public.shopping_items where name = 'Foil' limit 1))$$, 'not_found', 'another household''s list can''t be put away');
