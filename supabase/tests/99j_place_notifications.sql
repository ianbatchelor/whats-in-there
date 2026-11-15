-- Phone notifications for places: bells, daily summaries, and use-it-soon reminders.
\set ON_ERROR_STOP 1
\set ian   '''f4f4f4f4-0000-0000-0000-00000000000a'''
\set shel  '''f4f4f4f4-0000-0000-0000-00000000000b'''
\set molly '''f4f4f4f4-0000-0000-0000-00000000000c'''
\set pal   '''f4f4f4f4-0000-0000-0000-00000000000d'''

reset role;
insert into auth.users (id, email) values (:ian, 'pi@example.com'), (:shel, 'ps@example.com'), (:molly, 'pm@example.com'), (:pal, 'pp@example.com');

set role authenticated;
select tests.login(:ian);
insert into tests.vars values ('pn', public.create_household('Place House')::text);
insert into tests.vars select 'pn_home', token from public.create_invitation((select v::uuid from tests.vars where k = 'pn'));
insert into public.storage_locations (household_id, name, type) values
  ((select v::uuid from tests.vars where k = 'pn'), 'Garage freezer', 'freezer'),
  ((select v::uuid from tests.vars where k = 'pn'), 'Pantry', 'pantry');
insert into tests.vars select 'pn_freezer', id::text from public.storage_locations where name = 'Garage freezer' and household_id = (select v::uuid from tests.vars where k = 'pn');
insert into tests.vars select 'pn_pantry', id::text from public.storage_locations where name = 'Pantry' and household_id = (select v::uuid from tests.vars where k = 'pn');
insert into public.storage_locations (household_id, name, type, parent_id)
  values ((select v::uuid from tests.vars where k = 'pn'), 'Drawer 1', 'box', (select v::uuid from tests.vars where k = 'pn_freezer'));
insert into tests.vars select 'pn_drawer', id::text from public.storage_locations where name = 'Drawer 1' and household_id = (select v::uuid from tests.vars where k = 'pn');
select tests.login(:shel);
select public.accept_invitation((select v from tests.vars where k = 'pn_home'));

-- Molly uses the freezer only; Pal uses nothing.
reset role;
insert into public.place_members (location_id, user_id) values ((select v::uuid from tests.vars where k = 'pn_freezer'), :molly);

set role authenticated;
select tests.login(:ian);   select public.register_push_device(repeat('d', 64));
select tests.login(:shel);  select public.register_push_device(repeat('e', 64));
select tests.login(:molly); select public.register_push_device(repeat('f', 64));
select tests.login(:pal);   select public.register_push_device(repeat('0', 64));

-- Places start quiet.
select tests.login(:molly);
select public.add_stock((select v::uuid from tests.vars where k = 'pn_freezer'), 'Chicken', 1);
reset role;
select tests.ok((select count(*) = 0 from public.notify_events where target_kind = 'place'), 'places are quiet until you turn the bell on');

-- Ian follows the freezer; Pal tries to.
set role authenticated;
select tests.login(:ian);
insert into public.notify_follows (target_kind, target_id, mode) values ('place', (select v::uuid from tests.vars where k = 'pn_freezer'), 'every');
select tests.login(:pal);
insert into public.notify_follows (target_kind, target_id, mode) values ('place', (select v::uuid from tests.vars where k = 'pn_freezer'), 'every');

select tests.login(:molly);
select public.add_stock((select v::uuid from tests.vars where k = 'pn_drawer'), 'Peas', 1);
select public.remove_stock((select id from public.stock_items where product_name = 'Chicken' and household_id = (select v::uuid from tests.vars where k = 'pn')), 1);
reset role;
select tests.ok((select count(*) = 2 and bool_and(recipient = :ian) from public.notify_events where target_kind = 'place'),
                'Ian hears about the freezer, and Pal, who can''t use it, doesn''t');
select tests.ok((select target_id = (select v::uuid from tests.vars where k = 'pn_freezer') from public.notify_events where what = 'Peas'),
                'something put in a drawer counts as the freezer');
select tests.ok((select verb = 'took' from public.notify_events where what = 'Chicken'), 'taking something out says so');

-- Undo straight away: nothing to send.
set role authenticated;
select tests.login(:molly);
select public.undo_movement((select m.id from public.stock_movements m join public.stock_items s on s.id = m.stock_item_id
                             where s.product_name = 'Chicken' and m.action = 'remove' and s.household_id = (select v::uuid from tests.vars where k = 'pn')));
reset role;
select tests.ok((select count(*) = 0 from public.notify_events where what = 'Chicken'), 'an undone change sends nothing');

-- The pantry isn't followed.
set role authenticated;
select tests.login(:shel);
select public.add_stock((select v::uuid from tests.vars where k = 'pn_pantry'), 'Rice', 1);
reset role;
select tests.ok((select count(*) = 0 from public.notify_events where what = 'Rice'), 'only places you follow');

-- What the sender sees for a place.
update public.notify_events set created_at = created_at - interval '10 minutes' where target_kind = 'place';
reset role;
set role authenticated;
select tests.login(:ian);
insert into public.notify_prefs (quiet_from, quiet_to) values (0, 0);
reset role;
select tests.ok((select list_title = 'Garage freezer' and list_kind = 'freezer' and total = 1 and took = 0 and not daily
                 from public.notifications_due(interval '5 minutes') where recipient = :ian and target_kind = 'place'),
                'one message for the freezer, with its name');

-- Daily summary: held until 6 pm.
set role authenticated;
select tests.login(:ian);
update public.notify_follows set mode = 'daily' where target_kind = 'place';
reset role;
select tests.ok((select count(*) = (case when extract(hour from now() at time zone 'Europe/London') = 18 then 1 else 0 end)
                 from public.notifications_due(interval '5 minutes') where recipient = :ian and target_kind = 'place'),
                'a daily summary waits for 6 pm');
select tests.ok((select count(*) = 1 from public.notify_events where target_kind = 'place' and sent_at is null), 'and isn''t dropped meanwhile');

-- Reminders: things near their date in a place you follow.
set role authenticated;
select tests.login(:ian);
select public.add_stock((select v::uuid from tests.vars where k = 'pn_drawer'), 'Mince', 1, p_use_by_date => (now() at time zone 'Europe/London')::date + 1);
select public.add_stock((select v::uuid from tests.vars where k = 'pn_freezer'), 'Ice lollies', 1, p_best_before_date => (now() at time zone 'Europe/London')::date + 60);
select public.add_stock((select v::uuid from tests.vars where k = 'pn_freezer'), 'Old lamb', 1, p_frozen_at => (now() at time zone 'Europe/London')::date - 120);
reset role;
select tests.ok(case when extract(hour from now() at time zone 'Europe/London') < 9 then true
                     else coalesce((select soon = array['Mince'] and soon_total = 1 from public.place_reminders_due() where recipient = :ian), false) end,
                'the morning reminder lists what needs using soon');
select tests.ok((select count(*) = 0 from public.place_reminders_due() where recipient in (:shel, :molly, :pal)), 'only for people following the place');
select tests.ok((select bool_and(case when extract(isodow from (now() at time zone 'Europe/London')::date) = 6 then frozen = array['Old lamb'] else frozen_total = 0 end)
                 from public.place_reminders_due() where recipient = :ian), 'long-frozen things only on Saturdays');
insert into public.notify_reminders_sent (user_id, place_id, day)
  values (:ian, (select v::uuid from tests.vars where k = 'pn_freezer'), (now() at time zone 'Europe/London')::date);
select tests.ok((select count(*) = 0 from public.place_reminders_due() where recipient = :ian), 'once a day');

-- Bells take a daily choice; nothing else.
set role authenticated;
select tests.login(:shel);
select tests.fails($$insert into public.notify_follows (target_kind, target_id, mode) values ('place', gen_random_uuid(), 'hourly')$$, 'check', 'only every, daily or off');
reset role;
