-- One present list shared with someone outside the household (Carol sees only Michele's list).
\set ON_ERROR_STOP 1
\set ian   '''e1e1e1e1-0000-0000-0000-00000000000a'''
\set shel  '''e1e1e1e1-0000-0000-0000-00000000000b'''
\set carol '''e1e1e1e1-0000-0000-0000-00000000000c'''
\set nosy  '''e1e1e1e1-0000-0000-0000-00000000000d'''
\set fam   '''e1e1e1e1-0000-0000-0000-00000000000e'''

reset role;
insert into auth.users (id, email) values (:ian, 'oi@example.com'), (:shel, 'Shel.Op@Example.com'), (:carol, 'carol.op@example.com'),
  (:nosy, 'nosy.op@example.com'), (:fam, 'fam.op@example.com');
update public.profiles set display_name = 'Ian' where user_id = :ian;
update public.profiles set display_name = 'Michele' where user_id = :shel;
update public.profiles set display_name = 'Carol' where user_id = :carol;

set role authenticated;
select tests.login(:ian);
insert into tests.vars values ('op', public.create_household('Batchelor House')::text);
insert into tests.vars select 'op_inv', token from public.create_invitation((select v::uuid from tests.vars where k = 'op'));
insert into tests.vars select 'op_fam', token from public.create_invitation((select v::uuid from tests.vars where k = 'op'), 'family');
insert into public.storage_locations (household_id, name, type) values ((select v::uuid from tests.vars where k = 'op'), 'Op freezer', 'freezer');
select tests.login(:shel);
select public.accept_invitation((select v from tests.vars where k = 'op_inv'));
insert into public.wish_lists (household_id, for_user) values ((select v::uuid from tests.vars where k = 'op'), :shel);
insert into tests.vars select 'op_shel', id::text from public.wish_lists where for_user = :shel;
insert into public.wish_ideas (list_id, household_id, title) values
  ((select v::uuid from tests.vars where k = 'op_shel'), (select v::uuid from tests.vars where k = 'op'), 'Scarf'),
  ((select v::uuid from tests.vars where k = 'op_shel'), (select v::uuid from tests.vars where k = 'op'), 'Candle'),
  ((select v::uuid from tests.vars where k = 'op_shel'), (select v::uuid from tests.vars where k = 'op'), 'Book');
select tests.login(:fam);
select public.accept_invitation((select v from tests.vars where k = 'op_fam'));
select tests.login(:ian);
insert into public.wish_lists (household_id, name) values ((select v::uuid from tests.vars where k = 'op'), 'Daisy');
insert into tests.vars select 'op_daisy', id::text from public.wish_lists where name = 'Daisy' and household_id = (select v::uuid from tests.vars where k = 'op');
insert into public.wish_ideas (list_id, household_id, title) values
  ((select v::uuid from tests.vars where k = 'op_daisy'), (select v::uuid from tests.vars where k = 'op'), 'Pony');
insert into tests.vars select 'op_' || lower(title), id::text from public.wish_ideas where household_id = (select v::uuid from tests.vars where k = 'op');
-- Ian gets the scarf.
insert into public.wish_claims (idea_id, list_id, household_id)
  select id, list_id, household_id from public.wish_ideas where title = 'Scarf' and list_id = (select v::uuid from tests.vars where k = 'op_shel');

-- Who can invite.
select tests.fails($$select public.invite_to_wish_list((select v::uuid from tests.vars where k = 'op_shel'), 'not an email')$$, 'bad_email', 'needs a real email');
select tests.fails($$select public.invite_to_wish_list((select v::uuid from tests.vars where k = 'op_shel'), ' shel.op@example.COM ')$$, 'own_list', 'Michele can''t be invited onto her own list');
select tests.login(:fam);
select tests.fails($$select public.invite_to_wish_list((select v::uuid from tests.vars where k = 'op_shel'), 'x@example.com')$$, 'not_found', 'family can''t invite people in');
select tests.login(:nosy);
select tests.fails($$select public.invite_to_wish_list((select v::uuid from tests.vars where k = 'op_shel'), 'x@example.com')$$, 'not_found', 'outsiders can''t invite people in');

select tests.login(:ian);
insert into tests.vars values ('op_old', public.invite_to_wish_list((select v::uuid from tests.vars where k = 'op_shel'), 'Carol.Op@Example.com'));
insert into tests.vars values ('op_tok', public.invite_to_wish_list((select v::uuid from tests.vars where k = 'op_shel'), 'carol.op@example.com'));
select tests.ok((select count(*) = 1 from public.wish_list_people((select v::uuid from tests.vars where k = 'op_shel')) where label = 'carol.op@example.com'),
  'a fresh invite replaces the one waiting for the same email');
select tests.fails($$select * from public.wish_list_invites$$, 'permission denied', 'invitations can''t be read directly');

-- The link, before signing in.
set role anon;
select tests.ok((select name = 'Michele' and invited_by = 'Ian' and email_hint = 'c…@example.com'
  from public.wish_list_invite_preview((select v from tests.vars where k = 'op_tok'))), 'the link says whose list it is, with the email hinted');
select tests.ok((select count(*) = 0 from public.wish_list_invite_preview((select v from tests.vars where k = 'op_old'))), 'the replaced link no longer works');
set role authenticated;

-- Someone else can't use Carol's invitation.
select tests.login(:nosy);
select tests.fails($$select public.join_wish_list((select v from tests.vars where k = 'op_tok'))$$, 'wrong_email', 'only the invited email can join');
select tests.ok((select viewer_wish_list is null from public.viewer_wish_list((select v::uuid from tests.vars where k = 'op_shel'))), 'outsiders see nothing');
select tests.fails($$select public.viewer_claim_wish((select v::uuid from tests.vars where k = 'op_shel'), (select v::uuid from tests.vars where k = 'op_candle'))$$,
  'not_found', 'outsiders can''t claim');

-- Carol joins.
select tests.login(:carol);
select tests.ok((select public.join_wish_list(v) = (select v::uuid from tests.vars where k = 'op_shel') from tests.vars where k = 'op_tok'), 'Carol joins Michele''s list');
select tests.ok((select public.join_wish_list(v) is not null from tests.vars where k = 'op_tok'), 'opening the link again is fine');
select tests.ok((select count(*) = 1 and min(name) = 'Michele' and min(free) = 2 and min(shared_by) = 'Ian' from public.wish_lists_shared_with_me()), 'Carol has Michele''s list, 2 still free');
select tests.ok((select jsonb_array_length(public.viewer_wish_list((select v::uuid from tests.vars where k = 'op_shel')) -> 'ideas') = 2), 'she sees only the ideas still free');
select tests.ok((select (public.viewer_wish_list((select v::uuid from tests.vars where k = 'op_shel')) ->> 'hidden')::int = 1), 'and that one is hidden');
select tests.ok((select public.viewer_wish_list((select v::uuid from tests.vars where k = 'op_shel'))::text not like '%Scarf%'), 'the taken scarf isn''t sent at all');
select tests.ok((select viewer_wish_list is null from public.viewer_wish_list((select v::uuid from tests.vars where k = 'op_daisy'))), 'not Daisy''s list');
select tests.ok((select count(*) = 0 from public.wish_lists), 'no lists readable directly');
select tests.ok((select count(*) = 0 from public.wish_ideas), 'no ideas readable directly');
select tests.ok((select count(*) = 0 from public.wish_claims), 'no claims readable directly');
select tests.ok((select count(*) = 0 from public.storage_locations), 'no places');
select tests.ok((select count(*) = 0 from public.households), 'not the household');

-- Carol gets the candle, then can't take Ian's scarf.
-- Carol gets the candle; she can't take the scarf Ian is getting, or claim on Daisy's list.
select public.viewer_claim_wish((select v::uuid from tests.vars where k = 'op_shel'), (select v::uuid from tests.vars where k = 'op_candle'));
select tests.ok((select (public.viewer_wish_list((select v::uuid from tests.vars where k = 'op_shel')) -> 'ideas' @> '[{"title": "Candle", "mine": true}]')),
  'her own claim still shows, as hers');
select tests.fails($$select public.viewer_claim_wish((select v::uuid from tests.vars where k = 'op_shel'), (select v::uuid from tests.vars where k = 'op_scarf'))$$,
  'already_taken', 'can''t take one already taken');
select tests.fails($$select public.viewer_claim_wish((select v::uuid from tests.vars where k = 'op_shel'), (select v::uuid from tests.vars where k = 'op_pony'))$$,
  'not_found', 'can''t claim from another list through this one');
select tests.fails($$select public.viewer_claim_wish((select v::uuid from tests.vars where k = 'op_daisy'), (select v::uuid from tests.vars where k = 'op_pony'))$$,
  'not_found', 'can''t claim on Daisy''s list');
select tests.fails($$select public.viewer_unclaim_wish((select v::uuid from tests.vars where k = 'op_shel'), (select v::uuid from tests.vars where k = 'op_scarf'))$$,
  'not_found', 'can''t take back Ian''s claim');
select tests.ok((select count(*) = 0 from public.wish_list_people((select v::uuid from tests.vars where k = 'op_shel'))), 'Carol can''t see who else is on the list');

-- Ian sees "Carol is getting this"; Michele sees nothing.
select tests.login(:ian);
select tests.ok((select c.claimed_by = 'e1e1e1e1-0000-0000-0000-00000000000c'::uuid from public.wish_claims c where c.idea_id = (select v::uuid from tests.vars where k = 'op_candle')), 'Ian sees the candle is taken');
select tests.ok((select display_name = 'Carol' from public.profiles where user_id = 'e1e1e1e1-0000-0000-0000-00000000000c'), 'and Carol''s name');
select tests.ok((select count(*) = 1 from public.wish_list_people((select v::uuid from tests.vars where k = 'op_shel')) where label = 'Carol'), 'Ian sees Carol can see the list');
select tests.login(:shel);
select tests.ok((select count(*) = 0 from public.wish_claims where list_id = (select v::uuid from tests.vars where k = 'op_shel')), 'Michele still can''t see any claims');

-- Carol undoes, Ian takes her off; she then sees nothing.
select tests.login(:carol);
select public.viewer_unclaim_wish((select v::uuid from tests.vars where k = 'op_shel'), (select v::uuid from tests.vars where k = 'op_candle'));
select tests.ok((select public.viewer_wish_list((select v::uuid from tests.vars where k = 'op_shel')) -> 'ideas' @> '[{"title": "Candle", "mine": false}]'), 'undo frees the candle again');
select tests.login(:ian);
insert into tests.vars values ('op_tok2', public.invite_to_wish_list((select v::uuid from tests.vars where k = 'op_shel'), 'someone@example.com'));
select public.cancel_wish_list_invite((select invite_id from public.wish_list_people((select v::uuid from tests.vars where k = 'op_shel')) where label = 'someone@example.com'));
select tests.ok((select count(*) = 0 from public.wish_list_invite_preview((select v from tests.vars where k = 'op_tok2'))), 'a cancelled invite stops working');
select public.remove_wish_list_viewer((select v::uuid from tests.vars where k = 'op_shel'), :carol);
select tests.login(:carol);
select tests.ok((select count(*) = 0 from public.wish_lists_shared_with_me()), 'once taken off, Carol has no lists');
select tests.ok((select viewer_wish_list is null from public.viewer_wish_list((select v::uuid from tests.vars where k = 'op_shel'))), 'and can''t see Michele''s');
select tests.fails($$select public.join_wish_list((select v from tests.vars where k = 'op_tok'))$$, 'invitation_used', 'the used link doesn''t let her back in');
