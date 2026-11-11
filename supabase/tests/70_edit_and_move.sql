-- Editing a thing's details and moving it between places.
\set ON_ERROR_STOP 1
\set gina '''99999999-0000-0000-0000-000000000007'''
\set hal  '''88888888-0000-0000-0000-000000000008'''

reset role;
insert into auth.users (id, email) values (:gina, 'gina@example.com'), (:hal, 'hal@example.com');

set role authenticated;
select tests.login(:gina);
insert into tests.vars values ('gh', public.create_household('Gina House')::text);
insert into public.storage_locations (household_id, name, type) values
  ((select v::uuid from tests.vars where k = 'gh'), 'Gina Attic', 'attic'),
  ((select v::uuid from tests.vars where k = 'gh'), 'Gina Garage', 'garage'),
  ((select v::uuid from tests.vars where k = 'gh'), 'Gina Freezer', 'freezer');
insert into tests.vars select 'g_attic', id::text from public.storage_locations where name = 'Gina Attic';
insert into tests.vars select 'g_garage', id::text from public.storage_locations where name = 'Gina Garage';
insert into tests.vars select 'gfreezer', id::text from public.storage_locations where name = 'Gina Freezer';
insert into tests.vars select 'g_tent', (public.add_stock((select v::uuid from tests.vars where k = 'g_attic'), 'Camping tnet', 1)).id::text;

-- ---------- Edit ----------
select public.update_stock_item((select v::uuid from tests.vars where k = 'g_tent'), 1, '  Camping tent ', 2, 'item',
  'Outdoors', 'Vango', null, null, null, '2027-05-01', null, 'Four-person');
select tests.ok((select product_name = 'Camping tent' and brand = 'Vango' and category = 'Outdoors' and quantity = 2
                   and best_before_date = '2027-05-01' and notes = 'Four-person' and version = 2
                 from public.stock_items where id = (select v::uuid from tests.vars where k = 'g_tent')), 'edit saves every detail, trimmed');
select tests.ok((select quantity_delta = 1 and quantity_after = 2 and notes = 'edited'
                 from public.stock_movements where stock_item_id = (select v::uuid from tests.vars where k = 'g_tent') and action = 'adjust'),
                'edit keeps the change of amount in the history');
select tests.fails($$select public.update_stock_item((select v::uuid from tests.vars where k = 'g_tent'), 1, 'Tent', 1, 'item')$$, 'version_conflict', 'editing a stale copy is refused');
select tests.fails($$select public.update_stock_item((select v::uuid from tests.vars where k = 'g_tent'), null, '  ', 1, 'item')$$, 'invalid_name', 'a blank name is refused');
select tests.fails($$select public.update_stock_item((select v::uuid from tests.vars where k = 'g_tent'), null, 'Tent', 0, 'item')$$, 'invalid_amount', 'an amount of zero is refused');
select tests.fails($$select public.undo_movement((select id from public.stock_movements where stock_item_id = (select v::uuid from tests.vars where k = 'g_tent') and action = 'adjust'))$$,
                   'cannot_undo', 'an edit is not undone from history');
select public.update_stock_item((select v::uuid from tests.vars where k = 'g_tent'), null, 'Camping tent', 2, 'item', null, null, 750, null);
select tests.ok((select weight_value is null and weight_unit is null from public.stock_items where id = (select v::uuid from tests.vars where k = 'g_tent')),
                'a pack size without a unit is dropped rather than failing');

-- ---------- Move ----------
select public.move_stock((select v::uuid from tests.vars where k = 'g_tent'), (select v::uuid from tests.vars where k = 'g_garage'));
select tests.ok((select location_id from public.stock_items where id = (select v::uuid from tests.vars where k = 'g_tent')) = (select v::uuid from tests.vars where k = 'g_garage'), 'move puts it in the new place');
select tests.ok((select from_location_id = (select v::uuid from tests.vars where k = 'g_attic') and to_location_id = (select v::uuid from tests.vars where k = 'g_garage')
                 from public.stock_movements where stock_item_id = (select v::uuid from tests.vars where k = 'g_tent') and action = 'move'),
                'move is kept in the history with where from and where to');
select tests.ok((select (public.move_stock((select v::uuid from tests.vars where k = 'g_tent'), (select v::uuid from tests.vars where k = 'g_garage'))).version)
                = (select version from public.stock_items where id = (select v::uuid from tests.vars where k = 'g_tent')), 'moving to the same place changes nothing');
select public.undo_movement((select id from public.stock_movements where stock_item_id = (select v::uuid from tests.vars where k = 'g_tent') and action = 'move'));
select tests.ok((select location_id from public.stock_items where id = (select v::uuid from tests.vars where k = 'g_tent')) = (select v::uuid from tests.vars where k = 'g_attic'), 'undo moves it back');
select tests.fails($$select public.undo_movement((select id from public.stock_movements where stock_item_id = (select v::uuid from tests.vars where k = 'g_tent') and action = 'move'))$$,
                   'already_undone', 'a move is undone only once');
select public.move_stock((select v::uuid from tests.vars where k = 'g_tent'), (select v::uuid from tests.vars where k = 'gfreezer'));
select tests.ok((select frozen_at from public.stock_items where id = (select v::uuid from tests.vars where k = 'g_tent')) = current_date, 'going into a freezer starts the frozen-on date');
select public.move_stock((select v::uuid from tests.vars where k = 'g_tent'), (select v::uuid from tests.vars where k = 'g_attic'));
select public.move_stock((select v::uuid from tests.vars where k = 'g_tent'), (select v::uuid from tests.vars where k = 'g_garage'));
select tests.fails($$select public.undo_movement((select id from public.stock_movements where stock_item_id = (select v::uuid from tests.vars where k = 'g_tent') and action = 'move' and to_location_id = (select v::uuid from tests.vars where k = 'g_attic')))$$,
                   'cannot_undo', 'an old move cannot be undone once the thing has moved on');

-- ---------- Other households ----------
select tests.login(:hal);
insert into tests.vars values ('hh', public.create_household('Hal House')::text);
insert into public.storage_locations (household_id, name, type) values ((select v::uuid from tests.vars where k = 'hh'), 'Hal Shed', 'shed');
insert into tests.vars select 'h_shed', id::text from public.storage_locations where name = 'Hal Shed';
select tests.fails($$select public.update_stock_item((select v::uuid from tests.vars where k = 'g_tent'), null, 'Mine', 1, 'item')$$, 'not_found', 'cannot edit another household''s things');
select tests.fails($$select public.move_stock((select v::uuid from tests.vars where k = 'g_tent'), (select v::uuid from tests.vars where k = 'h_shed'))$$, 'not_found', 'cannot move another household''s things');
select tests.login(:gina);
select tests.fails($$select public.move_stock((select v::uuid from tests.vars where k = 'g_tent'), (select v::uuid from tests.vars where k = 'h_shed'))$$, 'not_found', 'cannot move a thing into another household');
select tests.fails($$update public.stock_items set location_id = (select v::uuid from tests.vars where k = 'g_attic')$$, 'permission denied', 'no direct moves');
