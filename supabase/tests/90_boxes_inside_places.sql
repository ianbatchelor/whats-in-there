-- Places inside places.
\set ON_ERROR_STOP 1
\set kim '''55555555-0000-0000-0000-00000000000b'''
\set lou '''44444444-0000-0000-0000-00000000000c'''

reset role;
insert into auth.users (id, email) values (:kim, 'kim@example.com'), (:lou, 'lou@example.com');

set role authenticated;
select tests.login(:lou);
insert into tests.vars values ('lh', public.create_household('Lou House')::text);
insert into public.storage_locations (household_id, name, type) values ((select v::uuid from tests.vars where k = 'lh'), 'Lou Loft', 'attic');
insert into tests.vars select 'l_loft', id::text from public.storage_locations where name = 'Lou Loft';

select tests.login(:kim);
insert into tests.vars values ('kh', public.create_household('Kim House')::text);
insert into public.storage_locations (household_id, name, type) values
  ((select v::uuid from tests.vars where k = 'kh'), 'Kim Garage', 'garage'),
  ((select v::uuid from tests.vars where k = 'kh'), 'Kim Shed', 'shed');
insert into tests.vars select 'k_garage', id::text from public.storage_locations where name = 'Kim Garage';
insert into tests.vars select 'k_shed', id::text from public.storage_locations where name = 'Kim Shed';
insert into public.storage_locations (household_id, name, type, parent_id)
  values ((select v::uuid from tests.vars where k = 'kh'), 'Kim Blue box', 'box', (select v::uuid from tests.vars where k = 'k_garage'));
insert into tests.vars select 'k_box', id::text from public.storage_locations where name = 'Kim Blue box';
select tests.ok((select parent_id = (select v::uuid from tests.vars where k = 'k_garage') from public.storage_locations where name = 'Kim Blue box'), 'a box can be added inside a place');

select tests.fails($$insert into public.storage_locations (household_id, name, type, parent_id)
  values ((select v::uuid from tests.vars where k = 'kh'), 'Kim Tin', 'box', (select v::uuid from tests.vars where k = 'k_box'))$$, 'invalid_parent', 'a box cannot go inside a box');
select tests.fails($$update public.storage_locations set parent_id = (select v::uuid from tests.vars where k = 'k_shed') where id = (select v::uuid from tests.vars where k = 'k_garage')$$,
                   'invalid_parent', 'a place holding boxes cannot go inside something');
select tests.fails($$update public.storage_locations set parent_id = id where id = (select v::uuid from tests.vars where k = 'k_shed')$$, 'not_own_parent', 'a place cannot be inside itself');
select tests.fails($$update public.storage_locations set parent_id = (select v::uuid from tests.vars where k = 'l_loft') where id = (select v::uuid from tests.vars where k = 'k_box')$$,
                   'storage_locations_parent_fk', 'a box cannot go into another household''s place');

update public.storage_locations set parent_id = (select v::uuid from tests.vars where k = 'k_shed') where id = (select v::uuid from tests.vars where k = 'k_box');
select tests.ok((select parent_id = (select v::uuid from tests.vars where k = 'k_shed') from public.storage_locations where id = (select v::uuid from tests.vars where k = 'k_box')), 'a box can be moved to another place');

insert into tests.vars select 'k_drill', (public.add_stock((select v::uuid from tests.vars where k = 'k_box'), 'Cordless drill', 1)).id::text;
select tests.ok((select location_id = (select v::uuid from tests.vars where k = 'k_box') from public.stock_items where id = (select v::uuid from tests.vars where k = 'k_drill')), 'things can be added to a box');

update public.storage_locations set archived_at = now() where id = (select v::uuid from tests.vars where k = 'k_shed');
select tests.ok((select parent_id is null and archived_at is null from public.storage_locations where id = (select v::uuid from tests.vars where k = 'k_box')),
                'removing a place leaves its boxes as places of their own');
select tests.fails($$update public.storage_locations set parent_id = (select v::uuid from tests.vars where k = 'k_shed') where id = (select v::uuid from tests.vars where k = 'k_box')$$,
                   'invalid_parent', 'a box cannot go into a removed place');
