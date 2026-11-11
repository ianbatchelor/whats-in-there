-- Seasonal reminders marked as done.
\set ON_ERROR_STOP 1
\set sam '''88888888-0000-0000-0000-00000000000f'''
\set tia '''99999999-0000-0000-0000-000000000010'''

reset role;
insert into auth.users (id, email) values (:sam, 'sam@example.com'), (:tia, 'tia@example.com');

set role authenticated;
select tests.login(:tia);
insert into tests.vars values ('th', public.create_household('Tia House')::text);
insert into public.seasonal_done (household_id, reminder, period) values ((select v::uuid from tests.vars where k = 'th'), 'car-winter', '2026-10');

select tests.login(:sam);
insert into tests.vars values ('sh', public.create_household('Sam House')::text);
insert into public.seasonal_done (household_id, reminder, period) values ((select v::uuid from tests.vars where k = 'sh'), 'medicine-check', '2026-09');
select tests.ok((select done_by = :sam and done_at > now() - interval '1 minute' from public.seasonal_done where reminder = 'medicine-check'), 'done by the person signed in');
select tests.ok((select count(*) = 1 from public.seasonal_done), 'another household''s reminders can''t be seen');
select tests.fails($$insert into public.seasonal_done (household_id, reminder, period, done_by) values ((select v::uuid from tests.vars where k = 'sh'), 'car-winter', '2026-10', '99999999-0000-0000-0000-000000000010')$$,
                   'permission denied', 'nobody can say someone else did it');
select tests.fails($$insert into public.seasonal_done (household_id, reminder, period) values ((select v::uuid from tests.vars where k = 'th'), 'sneaky', '2026-10')$$,
                   'row-level security', 'nothing can be marked done for another household');
select tests.fails($$insert into public.seasonal_done (household_id, reminder, period) values ((select v::uuid from tests.vars where k = 'sh'), 'medicine-check', '2026-09')$$,
                   'seasonal_done_pkey', 'the same time round can only be done once');
select tests.fails($$update public.seasonal_done set period = '2027-09'$$, 'permission denied', 'done can''t be changed');
select tests.fails($$delete from public.seasonal_done$$, 'permission denied', 'done can''t be undone by hand');

reset role;
