-- Fills the App Store demo account with a believable household, for Apple's reviewers and screenshots.
-- Run once in the Supabase SQL editor AFTER creating the user under Authentication > Users > Add user
-- (with a password, "Auto confirm" ticked). Change the email below if you used a different one.
-- Safe to run again: it does nothing if the demo account already has a household.
do $$
declare
  demo_email text := 'appreview@seewhatsinhere.com';
  uid uuid;
  hid uuid;
  freezer uuid; fridge uuid; pantry uuid; attic uuid; shed uuid; wardrobe uuid;
  item record;
begin
  select id into uid from auth.users where email = demo_email;
  if uid is null then
    raise exception 'No user %: add it under Authentication > Users first', demo_email;
  end if;
  if exists (select 1 from public.household_members where user_id = uid) then
    raise notice 'The demo account already has a household; nothing to do.';
    return;
  end if;

  update public.profiles set display_name = 'Sam' where user_id = uid;
  insert into public.households (name, created_by) values ('The Riverside House', uid) returning id into hid;
  insert into public.household_members (household_id, user_id, role) values (hid, uid, 'owner');

  insert into public.storage_locations (household_id, name, type, sort_order, created_by) values (hid, 'Garage freezer', 'freezer', 1, uid) returning id into freezer;
  insert into public.storage_locations (household_id, name, type, sort_order, created_by) values (hid, 'Kitchen fridge', 'fridge', 2, uid) returning id into fridge;
  insert into public.storage_locations (household_id, name, type, sort_order, created_by) values (hid, 'Pantry', 'pantry', 3, uid) returning id into pantry;
  insert into public.storage_locations (household_id, name, type, sort_order, created_by) values (hid, 'Attic', 'attic', 4, uid) returning id into attic;
  insert into public.storage_locations (household_id, name, type, sort_order, created_by) values (hid, 'Garden shed', 'shed', 5, uid) returning id into shed;
  insert into public.storage_locations (household_id, name, type, sort_order, created_by) values (hid, 'Bedroom wardrobe', 'wardrobe', 6, uid) returning id into wardrobe;

  for item in
    select * from (values
      (freezer, 'Leg of lamb', null::text, 1::numeric, 'item', 1.8::numeric, 'kg', null::int, null::int, -70),
      (freezer, 'Garden peas', 'Birds Eye', 1, 'pack', 900, 'g', null, null, -40),
      (freezer, 'Chicken curry', null, 4, 'portion', null, null, null, null, -12),
      (freezer, 'Vanilla ice cream', 'Carte d''Or', 1, 'pack', 900, 'ml', null, 120, -20),
      (freezer, 'Blackberries', null, 500, 'g', null, null, null, null, -55),
      (fridge, 'Semi-skimmed milk', 'Cravendale', 2, 'l', null, null, 2, null, -2),
      (fridge, 'Mature cheddar', 'Cathedral City', 1, 'pack', 350, 'g', null, 25, -6),
      (fridge, 'Greek yoghurt', 'Fage', 1, 'pack', 500, 'g', -1, null, -8),
      (fridge, 'Free-range eggs', null, 6, 'item', null, null, null, 9, -4),
      (pantry, 'Basmati rice', 'Tilda', 1, 'pack', 1, 'kg', null, 300, -30),
      (pantry, 'Chopped tomatoes', 'Napolina', 4, 'item', 400, 'g', null, 400, -15),
      (pantry, 'Olive oil', 'Filippo Berio', 1, 'item', 500, 'ml', null, 200, -25),
      (attic, 'Christmas decorations', null, 3, 'item', null, null, null, null, -300),
      (attic, 'Camping tent', 'Vango', 1, 'item', null, null, null, null, -400),
      (attic, 'Photo albums', null, 6, 'item', null, null, null, null, -500),
      (shed, 'Potting compost', 'Westland', 2, 'pack', 50, 'l', null, null, -60),
      (shed, 'Tulip bulbs', null, 30, 'item', null, null, null, null, -20),
      (wardrobe, 'Winter coat', 'Barbour', 1, 'item', null, null, null, null, -200),
      (wardrobe, 'Spare duvet', null, 1, 'item', null, null, null, null, -150)
    ) as t(loc, name, brand, qty, unit, wv, wu, use_by_days, best_before_days, added_days)
  loop
    with added as (
      insert into public.stock_items (household_id, location_id, product_name, brand, quantity, unit, weight_value, weight_unit,
                                      use_by_date, best_before_date, frozen_at, added_at, added_by)
      values (hid, item.loc, item.name, item.brand, item.qty, item.unit::public.stock_unit, item.wv,
              item.wu::public.stock_unit,
              case when item.use_by_days is not null then current_date + item.use_by_days end,
              case when item.best_before_days is not null then current_date + item.best_before_days end,
              case when item.loc = freezer then current_date + item.added_days end,
              now() + make_interval(days => item.added_days), uid)
      returning id, quantity, added_at
    )
    insert into public.stock_movements (household_id, stock_item_id, actor_user_id, action, quantity_delta, quantity_after, created_at)
    select hid, id, uid, 'add', quantity, quantity, added_at from added;
  end loop;
  raise notice 'Demo household ready for %', demo_email;
end;
$$;
