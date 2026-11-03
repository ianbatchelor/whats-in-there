-- Acceptance tests from spec section 18 (security, inventory integrity) at the database level.
\set ON_ERROR_STOP 1
\set alice '''aaaaaaaa-0000-0000-0000-000000000001'''
\set bob   '''bbbbbbbb-0000-0000-0000-000000000002'''
\set carol '''cccccccc-0000-0000-0000-000000000003'''

reset role;
insert into auth.users (id, email) values
  (:alice, 'alice@example.com'), (:bob, 'bob@example.com'), (:carol, 'carol@example.com');
select tests.ok((select count(*) from public.profiles) = 3, 'sign-up creates a profile for each user');

-- ---------- Two households ----------
set role authenticated;
select tests.login(:alice);
insert into tests.vars values ('ha', public.create_household('Alice House')::text);
select tests.ok((select role from public.household_members where user_id = :alice) = 'owner', 'creator becomes owner');
insert into public.storage_locations (household_id, name, type)
  values ((select v::uuid from tests.vars where k = 'ha'), 'Garage Freezer', 'freezer');
insert into public.storage_locations (household_id, name, type)
  values ((select v::uuid from tests.vars where k = 'ha'), 'Kitchen Freezer', 'freezer');
insert into tests.vars select 'garage', id::text from public.storage_locations where name = 'Garage Freezer';
insert into tests.vars select 'garage_code', link_code from public.storage_locations where name = 'Garage Freezer';
select tests.ok((select count(distinct link_code) from public.storage_locations) = 2, 'two freezers get separate sticker codes');
select tests.ok((select link_code from public.storage_locations where name = 'Garage Freezer') ~ '^[0-9A-Za-z]{10}$', 'sticker code is 10 base62 characters');

select tests.login(:bob);
insert into tests.vars values ('hb', public.create_household('Bob House')::text);

-- ---------- Inventory integrity ----------
select tests.login(:alice);
insert into tests.vars select 'lamb', (public.add_stock((select v::uuid from tests.vars where k = 'garage'), 'Leg of lamb', 3)).id::text;
select tests.ok((select frozen_at from public.stock_items where product_name = 'Leg of lamb') = current_date, 'freezer items default date frozen to today');
select tests.ok((select use_by_date from public.stock_items where product_name = 'Leg of lamb') is null, 'missing printed dates stay blank');
select public.remove_stock((select v::uuid from tests.vars where k = 'lamb'), 1);
select tests.ok((select quantity from public.stock_items where product_name = 'Leg of lamb') = 2, 'three added minus one removed leaves two');

insert into tests.vars select 'peas', (public.add_stock((select v::uuid from tests.vars where k = 'garage'), 'Garden peas', 0.9, 'kg')).id::text;
select public.remove_stock((select v::uuid from tests.vars where k = 'peas'), 0.35);
select tests.ok((select quantity from public.stock_items where product_name = 'Garden peas') = 0.55, 'partial removal by weight works');
select tests.fails($$select public.remove_stock((select v::uuid from tests.vars where k = 'peas'), 1)$$, 'insufficient_quantity', 'cannot remove more than is left');
select tests.fails($$select public.remove_stock((select v::uuid from tests.vars where k = 'peas'), 0)$$, 'invalid_amount', 'zero removal is rejected');
select tests.fails($$select public.remove_stock((select v::uuid from tests.vars where k = 'peas'), 0.1, 1)$$, 'version_conflict', 'stale version is refused instead of overwriting');

-- undo an accidental removal
select public.remove_stock((select v::uuid from tests.vars where k = 'lamb'), 2);
select tests.ok((select status from public.stock_items where product_name = 'Leg of lamb') = 'used_up', 'removing the last one marks the item used up');
select public.undo_movement((select id from public.stock_movements where action = 'remove' and quantity_delta = -2));
select tests.ok((select quantity from public.stock_items where product_name = 'Leg of lamb') = 2
  and (select status from public.stock_items where product_name = 'Leg of lamb') = 'in_stock', 'undo restores an accidental removal');
select tests.fails($$select public.undo_movement((select id from public.stock_movements where action = 'remove' and quantity_delta = -2))$$, 'already_undone', 'the same removal cannot be undone twice');
select tests.ok((select count(*) from public.stock_movements where stock_item_id = (select v::uuid from tests.vars where k = 'lamb')) = 4, 'every change is kept in the history');

-- direct writes are blocked; history is append-only
select tests.fails($$update public.stock_items set quantity = 99$$, 'permission denied', 'no direct quantity edits');
select tests.fails($$insert into public.stock_movements (household_id, stock_item_id, action, quantity_delta, quantity_after) select household_id, id, 'add', 1, 1 from public.stock_items limit 1$$, 'permission denied', 'no direct history inserts');
select tests.fails($$delete from public.stock_movements$$, 'permission denied', 'history cannot be deleted');
select tests.fails($$update public.storage_locations set link_code = 'AAAAAAAAAA'$$, 'permission denied', 'sticker codes are not client-writable');

-- ---------- Isolation ----------
select tests.login(:bob);
select tests.ok((select count(*) from public.stock_items) = 0, 'other household: no stock items visible');
select tests.ok((select count(*) from public.stock_movements) = 0, 'other household: no history visible');
select tests.ok((select count(*) from public.storage_locations) = 0, 'other household: no locations visible');
select tests.ok((select count(*) from public.households) = 1, 'other household: only own household visible');
select tests.ok((select count(*) from public.household_members) = 1, 'other household: only own membership visible');
select tests.ok((select count(*) from public.profiles) = 1, 'strangers'' profiles are hidden');
select tests.ok(public.resolve_location_code((select v from tests.vars where k = 'garage_code')) is null, 'a copied sticker link does not reveal another household''s location');
select tests.fails($$select public.remove_stock((select v::uuid from tests.vars where k = 'lamb'), 1)$$, 'not_found', 'cannot remove from another household');
select tests.fails($$select public.add_stock((select v::uuid from tests.vars where k = 'garage'), 'Sneaky', 1)$$, 'not_found', 'cannot add to another household');
select tests.fails($$insert into public.storage_locations (household_id, name, type) values ((select v::uuid from tests.vars where k = 'ha'), 'Mine now', 'pantry')$$, 'row-level security', 'cannot create a location in another household');
select tests.fails($$select * from public.create_invitation((select v::uuid from tests.vars where k = 'ha'))$$, 'not_owner', 'cannot invite people into another household');
update public.households set name = 'Hacked' where id = (select v::uuid from tests.vars where k = 'ha');
reset role;
select tests.ok((select name from public.households where id = (select v::uuid from tests.vars where k = 'ha')) = 'Alice House', 'cannot rename another household');

-- ---------- Signed out ----------
set role anon;
select tests.login(null);
select tests.fails($$select count(*) from public.stock_items$$, 'permission denied', 'signed-out users cannot read inventory');
select tests.fails($$select public.resolve_location_code('anything')$$, 'permission denied', 'signed-out users cannot resolve sticker links');

-- ---------- Invitations ----------
set role authenticated;
select tests.login(:alice);
insert into tests.vars select 'token', token from public.create_invitation((select v::uuid from tests.vars where k = 'ha'));
select tests.ok((select count(*) from public.household_invitations) = 1, 'owner sees the invitation');
select tests.fails($$select token_hash from public.household_invitations$$, 'permission denied', 'token hash is never readable');

select tests.login(:carol);
select tests.ok(public.accept_invitation((select v from tests.vars where k = 'token')) = (select v::uuid from tests.vars where k = 'ha'), 'invitation adds the new member');
select tests.ok((select count(*) from public.stock_items) = 2, 'new member sees the shared inventory');
select tests.ok(public.resolve_location_code((select v from tests.vars where k = 'garage_code')) = (select v::uuid from tests.vars where k = 'garage'), 'sticker link opens the location for a member');
select tests.ok((select count(*) from public.profiles) = 2, 'members see each other''s names');
select tests.fails($$select * from public.create_invitation((select v::uuid from tests.vars where k = 'ha'))$$, 'not_owner', 'only owners can invite');
select tests.fails($$select public.rotate_location_code((select v::uuid from tests.vars where k = 'garage'))$$, 'not_owner', 'only owners can rotate sticker codes');

select tests.login(:bob);
select tests.fails($$select public.accept_invitation((select v from tests.vars where k = 'token'))$$, 'invitation_used', 'a used invitation cannot be reused');
select tests.fails($$select public.accept_invitation('not-a-real-token')$$, 'invitation_invalid', 'a made-up token is refused');

reset role;
insert into public.household_invitations (household_id, token_hash, expires_at)
  values ((select v::uuid from tests.vars where k = 'ha'), encode(extensions.digest('expired-token', 'sha256'), 'hex'), now() - interval '1 minute');
set role authenticated;
select tests.login(:bob);
select tests.fails($$select public.accept_invitation('expired-token')$$, 'invitation_expired', 'an expired invitation is refused');

-- ---------- Sticker codes ----------
select tests.login(:alice);
update public.storage_locations set name = 'Big Garage Freezer' where id = (select v::uuid from tests.vars where k = 'garage');
select tests.ok(public.resolve_location_code((select v from tests.vars where k = 'garage_code')) = (select v::uuid from tests.vars where k = 'garage'), 'renaming a freezer keeps its sticker working');
select public.rotate_location_code((select v::uuid from tests.vars where k = 'garage'));
select tests.ok(public.resolve_location_code((select v from tests.vars where k = 'garage_code')) is null, 'rotating the code retires old stickers');

-- ---------- Photos ----------
insert into storage.objects (bucket_id, name) values ('item-photos', (select v from tests.vars where k = 'ha') || '/x/photo.webp');
select tests.ok((select count(*) from storage.objects) = 1, 'member can store a photo in their household folder');
select tests.fails($$insert into storage.objects (bucket_id, name) values ('item-photos', (select v from tests.vars where k = 'hb') || '/x/photo.webp')$$, 'row-level security', 'cannot store photos in another household''s folder');
select tests.login(:bob);
select tests.ok((select count(*) from storage.objects) = 0, 'other household cannot see private photos');

-- ---------- Leaving ----------
select tests.login(:alice);
select tests.fails($$select public.leave_household((select v::uuid from tests.vars where k = 'ha'))$$, 'last_owner', 'the only owner must hand over before leaving');
select tests.login(:carol);
select public.leave_household((select v::uuid from tests.vars where k = 'ha'));
select tests.ok((select count(*) from public.stock_items) = 0, 'after leaving, the inventory is no longer visible');

reset role;
\echo 'All database tests passed'
