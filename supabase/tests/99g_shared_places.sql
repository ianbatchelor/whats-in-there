-- Sharing a single place. Molly (family, own home) is let into Ian's Garage freezer and sees only that.
\set ON_ERROR_STOP 1
\set ian   '''f1f1f1f1-0000-0000-0000-00000000000a'''
\set molly '''f1f1f1f1-0000-0000-0000-00000000000b'''
\set pal   '''f1f1f1f1-0000-0000-0000-00000000000c'''
\set nosy  '''f1f1f1f1-0000-0000-0000-00000000000d'''

reset role;
insert into auth.users (id, email) values (:ian, 'si@example.com'), (:molly, 'sm@example.com'), (:pal, 'sp@example.com'), (:nosy, 'sn@example.com');
update public.profiles set display_name = 'Ian' where user_id = :ian;
update public.profiles set display_name = 'Molly' where user_id = :molly;
update public.profiles set display_name = 'Pal' where user_id = :pal;

set role authenticated;
select tests.login(:ian);
insert into tests.vars values ('sp', public.create_household('Batchelor House')::text);
insert into public.storage_locations (household_id, name, type) values
  ((select v::uuid from tests.vars where k = 'sp'), 'Garage freezer', 'freezer'),
  ((select v::uuid from tests.vars where k = 'sp'), 'Wine rack', 'other'),
  ((select v::uuid from tests.vars where k = 'sp'), 'Pantry', 'pantry');
insert into tests.vars select 'sp_freezer', id::text from public.storage_locations where name = 'Garage freezer';
insert into tests.vars select 'sp_wine', id::text from public.storage_locations where name = 'Wine rack';
insert into tests.vars select 'sp_pantry', id::text from public.storage_locations where name = 'Pantry';
insert into public.storage_locations (household_id, name, type, parent_id)
  values ((select v::uuid from tests.vars where k = 'sp'), 'Blue box', 'other', (select v::uuid from tests.vars where k = 'sp_freezer'));
insert into tests.vars select 'sp_box', id::text from public.storage_locations where name = 'Blue box';
insert into tests.vars select 'sp_code', link_code from public.storage_locations where name = 'Garage freezer';
insert into tests.vars select 'sp_winecode', link_code from public.storage_locations where name = 'Wine rack';
select public.add_stock((select v::uuid from tests.vars where k = 'sp_freezer'), 'Sausages', 2, p_image_path => (select v from tests.vars where k = 'sp') || '/sausages.webp');
select public.add_stock((select v::uuid from tests.vars where k = 'sp_box'), 'Peas', 1);
select public.add_stock((select v::uuid from tests.vars where k = 'sp_wine'), 'Rioja', 6, p_image_path => (select v from tests.vars where k = 'sp') || '/rioja.webp');
insert into tests.vars select 'sp_sausages', id::text from public.stock_items where product_name = 'Sausages';
insert into tests.vars select 'sp_rioja', id::text from public.stock_items where product_name = 'Rioja';
insert into storage.objects (bucket_id, name) values
  ('item-photos', (select v from tests.vars where k = 'sp') || '/sausages.webp'),
  ('item-photos', (select v from tests.vars where k = 'sp') || '/sausages.thumb.webp'),
  ('item-photos', (select v from tests.vars where k = 'sp') || '/rioja.webp');
insert into tests.vars select 'sp_fam', token from public.create_invitation((select v::uuid from tests.vars where k = 'sp'), 'family');

select tests.login(:molly);
insert into tests.vars values ('spm', public.create_household('Molly''s Flat')::text);
insert into public.storage_locations (household_id, name, type) values ((select v::uuid from tests.vars where k = 'spm'), 'Molly''s pantry', 'pantry');
select public.add_stock((select id from public.storage_locations where name = 'Molly''s pantry'), 'Pasta', 1);
select public.accept_invitation((select v from tests.vars where k = 'sp_fam'));
select tests.ok((select count(*) = 0 from public.storage_locations where household_id = (select v::uuid from tests.vars where k = 'sp')), 'before sharing, family see no places');

-- Ian ticks Molly for the freezer.
select tests.login(:ian);
select public.share_place_with((select v::uuid from tests.vars where k = 'sp_freezer'), :molly);
select tests.fails($$select public.share_place_with((select v::uuid from tests.vars where k = 'sp_freezer'), 'f1f1f1f1-0000-0000-0000-00000000000d')$$,
                   'not_found', 'only family can be ticked in');
select tests.ok((select count(*) = 1 from public.place_people((select v::uuid from tests.vars where k = 'sp_freezer'))), 'Ian sees who uses the freezer');

-- What Molly sees now: the freezer and its box, what's in them, and nothing else.
select tests.login(:molly);
select tests.ok((select count(*) = 2 from public.storage_locations where household_id = (select v::uuid from tests.vars where k = 'sp')), 'Molly sees the freezer and the box in it');
select tests.ok((select count(*) = 0 from public.storage_locations where name in ('Wine rack', 'Pantry')), 'but not the wine rack or pantry');
select tests.ok((select count(*) = 2 from public.stock_items where household_id = (select v::uuid from tests.vars where k = 'sp')), 'and what''s in the freezer and box');
select tests.ok((select count(*) = 0 from public.stock_items where product_name = 'Rioja'), 'not the wine');
select tests.ok((select count(*) = 2 from public.stock_movements where household_id = (select v::uuid from tests.vars where k = 'sp')), 'the freezer''s history only');
select tests.ok((select count(*) = 2 from storage.objects), 'its photos and thumbnails, not the wine''s');
select tests.ok((select public.resolve_location_code(v) = (select v::uuid from tests.vars where k = 'sp_freezer') from tests.vars where k = 'sp_code'), 'the freezer sticker opens for her');
select tests.ok((select public.resolve_location_code(v) is null from tests.vars where k = 'sp_winecode'), 'the wine rack sticker doesn''t');
select tests.ok((select count(*) = 1 and min(household) = 'Batchelor House' and min(things) = 2 from public.shared_with_me()), 'Home lists it as shared with her');
select tests.ok((select count(*) = 1 from public.profiles where display_name = 'Ian'), 'she sees Ian''s name');
select tests.ok(not public.is_member((select v::uuid from tests.vars where k = 'sp')), 'she still doesn''t live there');

-- Using it.
select public.add_stock((select v::uuid from tests.vars where k = 'sp_freezer'), 'Ice cream', 1);
select public.remove_stock((select v::uuid from tests.vars where k = 'sp_sausages'), 1);
select tests.ok((select quantity = 1 from public.stock_items where product_name = 'Sausages'), 'she can take something out');
select public.undo_movement((select id from public.stock_movements where action = 'remove' and stock_item_id = (select v::uuid from tests.vars where k = 'sp_sausages')));
select tests.ok((select quantity = 2 from public.stock_items where product_name = 'Sausages'), 'and undo it');
select public.move_stock((select id from public.stock_items where product_name = 'Ice cream'), (select v::uuid from tests.vars where k = 'sp_box'));
select tests.ok((select location_id = (select v::uuid from tests.vars where k = 'sp_box') from public.stock_items where product_name = 'Ice cream'), 'she can move things into the box');
select tests.fails($$select public.move_stock((select id from public.stock_items where product_name = 'Ice cream'), (select v::uuid from tests.vars where k = 'sp_pantry'))$$,
                   'not_found', 'but not out to a place she isn''t in');
select tests.fails($$select public.add_stock((select v::uuid from tests.vars where k = 'sp_wine'), 'Sneaky', 1)$$, 'not_found', 'she can''t add to the wine rack');
select tests.fails($$select public.remove_stock((select v::uuid from tests.vars where k = 'sp_rioja'), 1)$$, 'not_found', 'or take wine out');
select tests.fails($$select public.update_stock_item((select v::uuid from tests.vars where k = 'sp_rioja'), null, 'Mine', 1, 'item')$$, 'not_found', 'or edit it');
update public.storage_locations set name = 'Molly''s freezer' where id = (select v::uuid from tests.vars where k = 'sp_freezer');
select tests.ok((select name = 'Garage freezer' from public.storage_locations where id = (select v::uuid from tests.vars where k = 'sp_freezer')), 'she can''t rename the place');
select tests.fails($$insert into public.storage_locations (household_id, name, type, parent_id) values ((select v::uuid from tests.vars where k = 'sp'), 'Her box', 'other', (select v::uuid from tests.vars where k = 'sp_freezer'))$$,
                   'row-level security', 'or add a box to it');
select tests.fails($$select public.make_place_link((select v::uuid from tests.vars where k = 'sp_freezer'))$$, 'not_found', 'or send links to it');
insert into storage.objects (bucket_id, name) values ('item-photos', (select v from tests.vars where k = 'sp') || '/icecream.webp');
select tests.ok((select count(*) = 3 from storage.objects), 'she can add photos there and see her own');
select tests.fails($$insert into storage.objects (bucket_id, name) values ('item-photos', 'f1f1f1f1-0000-0000-0000-0000000000ff/x.webp')$$,
                   'row-level security', 'but not into folders of homes she has no place in');

-- Ian sees none of Molly's home.
select tests.login(:ian);
select tests.ok((select count(*) = 0 from public.storage_locations where name = 'Molly''s pantry'), 'Ian doesn''t see Molly''s pantry');
select tests.ok((select count(*) = 0 from public.stock_items where product_name = 'Pasta'), 'or what''s in it');
select tests.ok((select count(*) = 0 from public.shared_with_me()), 'nothing is shared with Ian');
select tests.ok((select count(*) = 4 from storage.objects), 'Ian sees every photo in his home, hers too');

-- A link: for one person, once.
insert into tests.vars select 'sp_link', public.make_place_link((select v::uuid from tests.vars where k = 'sp_freezer'));
select tests.ok(public.place_link_status((select v::uuid from tests.vars where k = 'sp_freezer')) > now(), 'Ian sees a link is out');
select tests.fails($$select public.make_place_link((select v::uuid from tests.vars where k = 'sp_box'))$$, 'not_found', 'links are for whole places, not boxes');
reset role;
set role anon;
select tests.ok((select place = 'Garage freezer' and household = 'Batchelor House' and invited_by = 'Ian' and things = 1
                 from public.place_invite_preview((select v from tests.vars where k = 'sp_link'))), 'the link says what it''s for before signing in');
set role authenticated;
select tests.login(:pal);
select tests.ok(public.join_place((select v from tests.vars where k = 'sp_link')) = (select v::uuid from tests.vars where k = 'sp_freezer'), 'Pal joins with the link');
select tests.ok((select count(*) = 2 from public.storage_locations), 'and sees the freezer and its box');
select tests.ok((select count(*) = 0 from public.households where name = 'Batchelor House'), 'but not Ian''s household');
select tests.ok((select count(*) = 2 from public.place_people((select v::uuid from tests.vars where k = 'sp_freezer'))), 'and who else uses it');
select tests.ok((select count(*) = 1 from public.profiles where display_name = 'Molly'), 'with their names');
select tests.login(:nosy);
select tests.fails($$select public.join_place((select v from tests.vars where k = 'sp_link'))$$, 'invitation_used', 'a used link doesn''t work again');
select tests.ok((select count(*) = 0 from public.place_invite_preview((select v from tests.vars where k = 'sp_link'))), 'or show anything');
select tests.ok((select count(*) = 0 from public.place_people((select v::uuid from tests.vars where k = 'sp_freezer'))), 'strangers can''t see who uses it');
select tests.ok((select count(*) = 0 from public.profiles where display_name in ('Molly', 'Pal', 'Ian')), 'or their names');

-- Stopping links, and taking people out.
select tests.login(:ian);
insert into tests.vars select 'sp_link2', public.make_place_link((select v::uuid from tests.vars where k = 'sp_freezer'));
select public.stop_place_links((select v::uuid from tests.vars where k = 'sp_freezer'));
select tests.ok(public.place_link_status((select v::uuid from tests.vars where k = 'sp_freezer')) is null, 'links can be stopped');
select tests.login(:nosy);
select tests.fails($$select public.join_place((select v from tests.vars where k = 'sp_link2'))$$, 'invitation_invalid', 'a stopped link doesn''t work');
select tests.fails($$select public.unshare_place((select v::uuid from tests.vars where k = 'sp_freezer'), 'f1f1f1f1-0000-0000-0000-00000000000b')$$,
                   'not_found', 'strangers can''t take people out');
select tests.login(:pal);
select tests.fails($$select public.unshare_place((select v::uuid from tests.vars where k = 'sp_freezer'), 'f1f1f1f1-0000-0000-0000-00000000000b')$$,
                   'not_found', 'guests can''t take each other out');
select public.unshare_place((select v::uuid from tests.vars where k = 'sp_freezer'), :pal);
select tests.ok((select count(*) = 0 from public.storage_locations), 'a guest can leave');
select tests.login(:ian);
select public.unshare_place((select v::uuid from tests.vars where k = 'sp_freezer'), :molly);
select tests.login(:molly);
select tests.ok((select count(*) = 0 from public.storage_locations where household_id = (select v::uuid from tests.vars where k = 'sp')), 'once taken out, Molly sees no places of Ian''s');
select tests.ok((select count(*) = 0 from public.stock_items where household_id = (select v::uuid from tests.vars where k = 'sp')), 'or what''s in them');
select tests.ok((select count(*) = 0 from public.shared_with_me()), 'and Home stops showing it');
select tests.ok((select count(*) = 1 from public.storage_locations), 'her own pantry is untouched');

-- Removing a place takes its sharing with it.
select tests.login(:ian);
select public.share_place_with((select v::uuid from tests.vars where k = 'sp_freezer'), :molly);
update public.storage_locations set archived_at = now() where id = (select v::uuid from tests.vars where k = 'sp_freezer');
select tests.login(:molly);
select tests.ok((select count(*) = 0 from public.shared_with_me()), 'a removed place is no longer shared');
