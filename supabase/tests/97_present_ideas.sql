-- Present ideas: wish lists, hidden "I'm getting this", and share links.
\set ON_ERROR_STOP 1
\set ian '''88888888-0000-0000-0000-00000000000a'''
\set shel '''88888888-0000-0000-0000-00000000000b'''
\set out '''88888888-0000-0000-0000-00000000000c'''

reset role;
insert into auth.users (id, email) values (:ian, 'ian@example.com'), (:shel, 'shel@example.com'), (:out, 'out@example.com');
update public.profiles set display_name = 'Michelle' where user_id = :shel;

set role authenticated;
select tests.login(:out);
insert into tests.vars values ('oh', public.create_household('Out House')::text);

select tests.login(:ian);
insert into tests.vars values ('h', public.create_household('Gift House')::text);
insert into tests.vars select 'inv', token from public.create_invitation((select v::uuid from tests.vars where k = 'h'));
select tests.login(:shel);
select public.accept_invitation((select v from tests.vars where k = 'inv'));

-- Michelle starts her list and adds an idea.
insert into public.wish_lists (household_id, for_user) values ((select v::uuid from tests.vars where k = 'h'), :shel);
insert into tests.vars select 'shel_list', id::text from public.wish_lists where for_user = :shel;
insert into public.wish_ideas (list_id, household_id, title, link, price, favourite)
  values ((select v::uuid from tests.vars where k = 'shel_list'), (select v::uuid from tests.vars where k = 'h'), 'Blue jumper', 'https://example.com/j', 'about £40', true);
insert into public.wish_ideas (list_id, household_id, title)
  values ((select v::uuid from tests.vars where k = 'shel_list'), (select v::uuid from tests.vars where k = 'h'), 'Candle');
select tests.ok((select added_by = :shel from public.wish_ideas where title = 'Blue jumper'), 'added by is the person signed in');
select tests.fails($$insert into public.wish_ideas (list_id, household_id, title, link) values ((select v::uuid from tests.vars where k = 'shel_list'), (select v::uuid from tests.vars where k = 'h'), 'Bad', 'javascript:alert(1)')$$,
                   'check constraint', 'only web links are allowed');
select tests.fails($$insert into public.wish_lists (household_id, for_user) values ((select v::uuid from tests.vars where k = 'h'), '88888888-0000-0000-0000-00000000000b')$$,
                   'wish_lists_one_each_idx', 'one list per person');
select tests.fails($$insert into public.wish_lists (household_id, for_user) values ((select v::uuid from tests.vars where k = 'h'), '88888888-0000-0000-0000-00000000000c')$$,
                   'row-level security', 'a list can''t be for someone outside the household');
insert into public.wish_lists (household_id, name) values ((select v::uuid from tests.vars where k = 'h'), 'Grandad');
select tests.ok((select count(*) = 1 from public.wish_lists where name = 'Grandad'), 'a list can be for someone without an account');
select tests.fails($$select public.claim_shared_wish('nope', (select id from public.wish_ideas where title = 'Candle'), 'X')$$, 'not_found', 'a claim needs the share code');

-- Ian says he's getting the jumper. Michelle must not be able to tell.
select tests.login(:ian);
insert into public.wish_claims (idea_id, list_id, household_id)
  select id, list_id, household_id from public.wish_ideas where title = 'Blue jumper';
select tests.ok((select claimed_by = :ian from public.wish_claims), 'the claim records who');
select tests.login(:shel);
select tests.ok((select count(*) = 0 from public.wish_claims), 'you can''t see what people are getting you');
select tests.fails($$insert into public.wish_claims (idea_id, list_id, household_id) select id, list_id, household_id from public.wish_ideas where title = 'Candle'$$,
                   'row-level security', 'you can''t claim from your own list');
delete from public.wish_claims;
select tests.login(:ian);
select tests.ok((select count(*) = 1 from public.wish_claims), 'and can''t clear what people are getting you');

-- Share outside the household.
select tests.login(:shel);
insert into tests.vars values ('code', public.share_wish_list((select v::uuid from tests.vars where k = 'shel_list')));
select tests.ok((select public.share_wish_list((select v::uuid from tests.vars where k = 'shel_list')) = v from tests.vars where k = 'code'), 'sharing again gives the same link');
select tests.login(:out);
select tests.ok((select count(*) = 0 from public.wish_lists where for_user = :shel), 'another household can''t see the list');
select tests.fails($$select public.share_wish_list((select v::uuid from tests.vars where k = 'shel_list'))$$, 'not_found', 'another household can''t share it');

reset role;
set role anon;
select tests.login(null);
select tests.ok((select (public.shared_wish_list(v)) ->> 'name' = 'Michelle' from tests.vars where k = 'code'), 'the link shows whose list it is, with no account');
select tests.ok((select jsonb_array_length(public.shared_wish_list(v) -> 'ideas') = 2 from tests.vars where k = 'code'), 'and its ideas');
select tests.ok((select (public.shared_wish_list(v) -> 'ideas' -> 0 ->> 'taken')::boolean from tests.vars where k = 'code'), 'favourites first, showing they''re taken');
select tests.ok(public.shared_wish_list('ZZZZZZZZZZ') is null, 'an unknown code shows nothing');
select tests.fails($$select * from public.wish_ideas$$, 'permission denied', 'the tables themselves are closed to people without an account');
insert into tests.vars select 'tok', public.claim_shared_wish((select v from tests.vars where k = 'code'), (select (public.shared_wish_list(v) -> 'ideas' -> 1 ->> 'id')::uuid from tests.vars where k = 'code'), ' Auntie Sue ');
select tests.fails($$select public.claim_shared_wish((select v from tests.vars where k = 'code'), (select (public.shared_wish_list(v) -> 'ideas' -> 1 ->> 'id')::uuid from tests.vars where k = 'code'), 'Bob')$$,
                   'already_taken', 'nobody can get the same thing twice');
select tests.ok((select public.shared_wish_list(v) -> 'ideas' -> 1 ->> 'takenBy' = 'Auntie Sue' from tests.vars where k = 'code'), 'the link shows who''s getting it');
select tests.fails($$select public.unclaim_shared_wish((select v from tests.vars where k = 'code'), (select (public.shared_wish_list(v) -> 'ideas' -> 1 ->> 'id')::uuid from tests.vars where k = 'code'), 'wrong')$$,
                   'not_found', 'only the person who claimed it can take it back');

reset role;
set role authenticated;
select tests.login(:ian);
select tests.ok((select claimed_by is null and claimed_name = 'Auntie Sue' from public.wish_claims where claimed_name is not null), 'the household sees a share-link claim, with its name');
select tests.login(:shel);
select tests.ok((select count(*) = 0 from public.wish_claims), 'still hidden from Michelle');

reset role;
set role anon;
select public.unclaim_shared_wish((select v from tests.vars where k = 'code'), (select (public.shared_wish_list(v) -> 'ideas' -> 1 ->> 'id')::uuid from tests.vars where k = 'code'), (select v from tests.vars where k = 'tok'));
select tests.ok((select not (public.shared_wish_list(v) -> 'ideas' -> 1 ->> 'taken')::boolean from tests.vars where k = 'code'), 'taking it back frees it up');

reset role;
set role authenticated;
select tests.login(:shel);
select public.unshare_wish_list((select v::uuid from tests.vars where k = 'shel_list'));
reset role;
set role anon;
select tests.ok((select public.shared_wish_list(v) is null from tests.vars where k = 'code'), 'after stopping sharing, the old link shows nothing');
reset role;
