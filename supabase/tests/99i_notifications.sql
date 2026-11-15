-- Phone notifications: who gets told about what, and that claims never make one.
\set ON_ERROR_STOP 1
\set ian   '''f3f3f3f3-0000-0000-0000-00000000000a'''
\set shel  '''f3f3f3f3-0000-0000-0000-00000000000b'''
\set molly '''f3f3f3f3-0000-0000-0000-00000000000c'''
\set pal   '''f3f3f3f3-0000-0000-0000-00000000000d'''
\set quiet '''f3f3f3f3-0000-0000-0000-00000000000e'''

reset role;
insert into auth.users (id, email) values (:ian, 'ni@example.com'), (:shel, 'ns@example.com'), (:molly, 'nm@example.com'),
  (:pal, 'np@example.com'), (:quiet, 'nq@example.com');

set role authenticated;
select tests.login(:ian);
insert into tests.vars values ('nz', public.create_household('Notify House')::text);
insert into tests.vars select 'nz_fam', token from public.create_invitation((select v::uuid from tests.vars where k = 'nz'), 'family');
insert into tests.vars select 'nz_home', token from public.create_invitation((select v::uuid from tests.vars where k = 'nz'));
select tests.login(:shel);
select public.accept_invitation((select v from tests.vars where k = 'nz_home'));
select tests.login(:molly);
select public.accept_invitation((select v from tests.vars where k = 'nz_fam'));

-- Everyone but Pal has a phone.
select tests.login(:ian);   select public.register_push_device(repeat('a', 64));
select tests.login(:shel);  select public.register_push_device(repeat('b', 64));
select tests.login(:molly); select public.register_push_device(repeat('c', 64));
select tests.fails($$select public.register_push_device('not a token')$$, 'check', 'only real phone tokens are kept');

-- Shel adds ideas to her own present list.
select tests.login(:shel);
insert into public.wish_lists (household_id, for_user) values ((select v::uuid from tests.vars where k = 'nz'), :shel);
insert into tests.vars select 'nz_shel_list', id::text from public.wish_lists where for_user = :shel;
insert into public.wish_ideas (list_id, household_id, title)
  values ((select v::uuid from tests.vars where k = 'nz_shel_list'), (select v::uuid from tests.vars where k = 'nz'), 'Lego set');

reset role;
select tests.ok((select count(*) = 2 from public.notify_events where what = 'Lego set'), 'a new idea tells two people');
select tests.ok((select bool_and(recipient in (:ian, :molly)) from public.notify_events where what = 'Lego set'), 'ian at home and Molly as family');

-- Ian adds an idea to Shel's list: Molly hears, Shel doesn't.
set role authenticated;
select tests.login(:ian);
insert into public.wish_ideas (list_id, household_id, title)
  values ((select v::uuid from tests.vars where k = 'nz_shel_list'), (select v::uuid from tests.vars where k = 'nz'), 'Scarf');
reset role;
select tests.ok((select count(*) = 1 and bool_and(recipient = :molly) from public.notify_events where what = 'Scarf'),
                'the person a list is for isn''t told about ideas added for them');

-- Claims never make a notification.
set role authenticated;
select tests.login(:ian);
insert into public.wish_claims (idea_id, list_id, household_id)
  select id, list_id, household_id from public.wish_ideas where title = 'Lego set';
reset role;
select tests.ok((select count(*) = 3 from public.notify_events), 'saying "I''m getting this" tells nobody');

-- Turning the bell off.
set role authenticated;
select tests.login(:molly);
insert into public.notify_follows (target_kind, target_id, mode) values ('wish_list', (select v::uuid from tests.vars where k = 'nz_shel_list'), 'off');
select tests.login(:shel);
insert into public.wish_ideas (list_id, household_id, title)
  values ((select v::uuid from tests.vars where k = 'nz_shel_list'), (select v::uuid from tests.vars where k = 'nz'), 'Book token');
reset role;
select tests.ok((select count(*) = 1 and bool_and(recipient = :ian) from public.notify_events where what = 'Book token'), 'a bell turned off means nothing for that list');

-- Lists: household lists start quiet, family lists start on.
set role authenticated;
select tests.login(:ian);
insert into public.lists (title, visibility, household_id) values ('Jobs at home', 'household', (select v::uuid from tests.vars where k = 'nz'));
insert into public.lists (title, visibility, household_id) values ('Christmas Day', 'family', (select v::uuid from tests.vars where k = 'nz'));
insert into public.lists (title) values ('Just mine');
insert into public.list_entries (list_id, text) select id, 'Fix the gate' from public.lists where title = 'Jobs at home';
insert into public.list_entries (list_id, text) select id, 'Turkey' from public.lists where title = 'Christmas Day';
insert into public.list_entries (list_id, text) select id, 'Secret' from public.lists where title = 'Just mine';
reset role;
select tests.ok((select count(*) = 0 from public.notify_events where what = 'Fix the gate'), 'household lists are quiet until you turn the bell on');
select tests.ok((select count(*) = 2 from public.notify_events where what = 'Turkey'), 'family lists tell everyone in the family');
select tests.ok((select count(*) = 0 from public.notify_events where what = 'Secret'), 'private lists never notify');

set role authenticated;
select tests.login(:shel);
insert into public.notify_follows (target_kind, target_id, mode) select 'list', id, 'every' from public.lists where title = 'Jobs at home';
select tests.login(:ian);
insert into public.list_entries (list_id, text) select id, 'Paint the shed' from public.lists where title = 'Jobs at home';
reset role;
select tests.ok((select count(*) = 1 and bool_and(recipient = :shel) from public.notify_events where what = 'Paint the shed'), 'turned on, a household list tells you');

-- A thing taken off again before it's sent takes its notification with it.
set role authenticated;
select tests.login(:ian);
delete from public.list_entries where text = 'Paint the shed';
reset role;
select tests.ok((select count(*) = 0 from public.notify_events where what = 'Paint the shed'), 'a typo fixed quickly sends nothing');

-- Choices are private.
set role authenticated;
select tests.login(:ian);
select tests.ok((select count(*) = 0 from public.notify_follows), 'nobody sees anyone else''s bells');
select tests.ok((select count(*) = 1 from public.push_devices), 'you see only your own phone');
select tests.fails($$select * from public.notify_events$$, 'permission denied', 'the waiting messages aren''t readable');
select tests.fails($$select * from public.notifications_due()$$, 'permission denied', 'nor is the sending queue');
select tests.fails($$insert into public.notify_prefs (time_zone) values ('Mars/Olympus')$$, 'time zone', 'only real time zones');
insert into public.notify_prefs (time_zone, quiet_from, quiet_to) values ('Europe/London', 0, 0); -- no quiet hours, so this test passes at any time of day

-- What the sender sees: nothing until the list has been quiet a while, then grouped with names.
reset role;
update public.profiles set display_name = 'Shel Batchelor' where user_id = :shel;
reset role;
select tests.ok((select count(*) = 0 from public.notifications_due(interval '5 minutes')), 'held while a list is still busy');
reset role;
update public.notify_events set created_at = created_at - interval '10 minutes';
reset role;
select tests.ok((select total = 2 from public.notifications_due(interval '5 minutes') where recipient = :ian and target_kind = 'wish_list'),
                'ian''s two new ideas on Shel''s list come as one');
select tests.ok((select actors = array['Shel Batchelor'] and things[1] = 'Lego set' from public.notifications_due(interval '5 minutes') where recipient = :ian and target_kind = 'wish_list'),
                'with who added them and what');
select tests.ok((select devices->0->>'token' = repeat('a', 64) from public.notifications_due(interval '5 minutes') where recipient = :ian limit 1), 'and the phone to send to');

-- Quiet hours.
select tests.ok(public.in_quiet_hours('2026-11-15 23:30+00', 22, 8, 'Europe/London'), '11.30 pm is quiet');
select tests.ok(public.in_quiet_hours('2026-11-15 07:59+00', 22, 8, 'Europe/London'), 'so is just before 8');
select tests.ok(not public.in_quiet_hours('2026-11-15 08:00+00', 22, 8, 'Europe/London'), '8 am is not');
select tests.ok(not public.in_quiet_hours('2026-11-15 03:00+00', 9, 9, 'Europe/London'), 'the same hour twice means no quiet hours');

-- Paused: what's waiting is dropped.
reset role;
set role authenticated;
select tests.login(:ian);
update public.notify_prefs set paused = true;
reset role;
select tests.ok((select count(*) = 0 from public.notifications_due(interval '5 minutes') where recipient = :ian), 'pausing drops what was waiting');

-- Signing out forgets the phone.
reset role;
set role authenticated;
select tests.login(:ian);
select public.forget_push_device(repeat('a', 64));
select tests.ok((select count(*) = 0 from public.push_devices), 'signed out, no more notifications');
reset role;

-- The app saves a bell with an upsert (insert, or update on the same list).
set role authenticated;
select tests.login(:shel);
insert into public.notify_follows (target_kind, target_id, mode) select 'list', id, 'off' from public.lists where title = 'Jobs at home'
  on conflict (user_id, target_kind, target_id) do update set target_kind = excluded.target_kind, target_id = excluded.target_id, mode = excluded.mode;
select tests.ok((select mode = 'off' from public.notify_follows where target_kind = 'list'), 'a bell can be switched back off');
reset role;
