-- Present ideas from shop links: the allowance, and pictures on the shared page.
\set ON_ERROR_STOP 1
\set lia '''99999999-0000-0000-0000-00000000000a'''

reset role;
insert into auth.users (id, email) values (:lia, 'lia@example.com');
set role authenticated;
select tests.login(:lia);
insert into tests.vars values ('lkh', public.create_household('Link House')::text);
select tests.fails($$select * from public.link_reads$$, 'permission denied', 'link reads are never readable from the app');
select tests.fails($$select * from public.reserve_link_read((select v::uuid from tests.vars where k = 'lkh'), '99999999-0000-0000-0000-00000000000a', 'x.com', 10, 100)$$,
                   'permission denied', 'only the server function can count link reads');
insert into public.wish_lists (household_id, for_user) values ((select v::uuid from tests.vars where k = 'lkh'), :lia);
select tests.fails($$insert into public.wish_ideas (list_id, household_id, title, image_path) select id, household_id, 'Bad', '../../etc/passwd' from public.wish_lists where for_user = '99999999-0000-0000-0000-00000000000a'$$,
                   'check constraint', 'a picture path must be one the function made');
insert into public.wish_ideas (list_id, household_id, title, image_path)
  select id, household_id, 'Mug', household_id::text || '/0b6f5c1e-1111-4222-8333-944455556666.jpg' from public.wish_lists where for_user = :lia;
insert into tests.vars select 'lcode', public.share_wish_list(id) from public.wish_lists where for_user = :lia;

reset role;
set role anon;
select tests.ok((select public.shared_wish_list(v) -> 'ideas' -> 0 ->> 'imagePath' like '%.jpg' from tests.vars where k = 'lcode'), 'the shared page gets the picture');

reset role;
select tests.ok((select refused is null from public.reserve_link_read((select v::uuid from tests.vars where k = 'lkh'), :lia, 'amazon.co.uk', 2, 100)), 'a first read is allowed');
select public.reserve_link_read((select v::uuid from tests.vars where k = 'lkh'), :lia, 'amazon.co.uk', 2, 100);
select tests.ok((select refused = 'too_many_now' from public.reserve_link_read((select v::uuid from tests.vars where k = 'lkh'), :lia, 'amazon.co.uk', 2, 100)), 'too many at once is refused');
select tests.ok((select refused = 'too_many_links' from public.reserve_link_read((select v::uuid from tests.vars where k = 'lkh'), :lia, 'amazon.co.uk', 100, 2)), 'the monthly allowance is enforced');
