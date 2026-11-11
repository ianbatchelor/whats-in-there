-- The shared barcode list needs two different people to agree, and the scan limits hold.
\set alice '''aaaaaaaa-0000-0000-0000-000000000001'''
\set bob   '''bbbbbbbb-0000-0000-0000-000000000002'''
\set carol '''cccccccc-0000-0000-0000-000000000003'''
reset role;

-- Nobody signed in to the app can call these.
set role authenticated;
select tests.fails($$select public.share_product_reading('50000000', null, 'x', null, null, null)$$, 'permission denied', 'the app cannot write to the barcode list');
select tests.fails($$select * from public.reserve_scan(gen_random_uuid(), gen_random_uuid(), 'x', 'm', 9, 9, 9)$$, 'permission denied', 'the app cannot reserve scans');
set role anon;
select tests.fails($$select public.share_product_reading('50000000', null, 'x', null, null, null)$$, 'permission denied', 'signed-out visitors cannot write to the barcode list');
reset role;
select tests.ok(has_function_privilege('service_role', 'public.share_product_reading(text, uuid, text, text, numeric, public.stock_unit)', 'execute')
  and has_function_privilege('service_role', 'public.reserve_scan(uuid, uuid, text, text, int, int, int)', 'execute'),
  'the scan function (service role) can call both');

-- First scan: remembered, not shared.
select tests.ok(public.share_product_reading('4006381333931', :alice, 'Rude name', 'Brand', 500, 'g') is null,
  'a first scan is not shared');
select tests.ok(public.share_product_reading('4006381333931', :alice, 'Rude name', 'Brand', 500, 'g') is null,
  'the same person scanning again does not confirm it');
-- Disagreement replaces the waiting reading.
select tests.ok(public.share_product_reading('4006381333931', :bob, 'Garden peas', null, 750, 'g') is null,
  'a disagreeing scan is not shared');
select tests.ok((select product_name = 'Garden peas' and candidate_by = :bob and not confirmed from public.products where barcode = '4006381333931'),
  'a disagreeing scan replaces the waiting reading');
-- Agreement from someone else confirms it.
select tests.ok(public.share_product_reading('4006381333931', :carol, ' garden PEAS.', 'Birds Eye', null, null) ->> 'product_name' = 'Garden peas',
  'a second person reading the same name confirms and shares it');
select tests.ok((select confirmed and brand = 'Birds Eye' and weight_value = 750 from public.products where barcode = '4006381333931'),
  'confirming fills in a missing brand and keeps the weight');
select tests.ok(public.share_product_reading('4006381333931', :alice, 'Something else', null, null, null) ->> 'product_name' = 'Garden peas',
  'a confirmed barcode is shared with everyone');
-- An unsure name never starts or confirms an entry.
select tests.ok(public.share_product_reading('96385074', :alice, null, 'Brand', null, null) is null
  and not exists (select 1 from public.products where barcode = '96385074'),
  'a scan unsure of the name adds nothing');
-- Rows from before this change start unconfirmed.
select tests.ok((select not confirmed from public.products where barcode = '5000169005224'),
  'older barcode entries start unconfirmed');
select tests.ok(public.share_product_reading('5000169005224', :bob, 'Garden peas', null, null, null) ->> 'product_name' = 'Garden peas',
  'an older entry is confirmed by the next matching scan');

-- Scan limits: per minute, then per household per day.
insert into tests.vars values ('scan_h', (select id::text from public.households limit 1)) on conflict (k) do update set v = excluded.v;
select tests.ok((select attempt_id is not null and refused is null
  from public.reserve_scan((select v::uuid from tests.vars where k = 'scan_h'), :carol, 'p', 'm', 2, 300, 50)),
  'a scan within the limits is reserved');
select tests.ok((select error_code = 'pending' from public.ai_extraction_attempts where actor_user_id = :carol),
  'the reserved scan is recorded at once');
select public.reserve_scan((select v::uuid from tests.vars where k = 'scan_h'), :carol, 'p', 'm', 2, 300, 50);
select tests.ok((select refused = 'too_many_now'
  from public.reserve_scan((select v::uuid from tests.vars where k = 'scan_h'), :carol, 'p', 'm', 2, 300, 50)),
  'the per-minute limit holds');
select tests.ok((select refused = 'too_many_this_month'
  from public.reserve_scan((select v::uuid from tests.vars where k = 'scan_h'), :carol, 'p', 'm', 99, 2, 50)),
  'the monthly limit holds');
select tests.ok((select refused = 'too_many_today'
  from public.reserve_scan((select v::uuid from tests.vars where k = 'scan_h'), :bob, 'p', 'm', 99, 300, 2)),
  'the household daily limit holds');
reset role;
