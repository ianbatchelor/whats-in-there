-- A place's cover photo must sit in its own household's folder, and members can set it.
do $$
declare h uuid; other uuid; loc uuid;
begin
  select household_id, id into h, loc from public.storage_locations limit 1;
  if loc is null then
    insert into public.households (name) values ('Photo test') returning id into h;
    insert into public.storage_locations (household_id, name, type) values (h, 'Shed', 'shed') returning id into loc;
  end if;
  other := gen_random_uuid();
  insert into tests.vars values ('photo_loc', loc::text), ('photo_h', h::text), ('photo_other', other::text)
    on conflict (k) do update set v = excluded.v;
end $$;

select tests.fails(
  format($$update public.storage_locations set image_path = %L where id = %L$$,
    (select v from tests.vars where k = 'photo_other') || '/places/x.webp', (select v from tests.vars where k = 'photo_loc')),
  'check', 'a cover photo cannot point into another household''s folder');
select tests.fails(
  format($$update public.storage_locations set image_path = %L where id = %L$$,
    (select v from tests.vars where k = 'photo_h') || '/labels/x.webp', (select v from tests.vars where k = 'photo_loc')),
  'check', 'a cover photo must be in the places folder');

update public.storage_locations
  set image_path = (select v from tests.vars where k = 'photo_h') || '/places/x.webp'
  where id = (select v from tests.vars where k = 'photo_loc')::uuid;
select tests.ok(
  (select image_path is not null from public.storage_locations where id = (select v from tests.vars where k = 'photo_loc')::uuid),
  'a cover photo in the household''s own places folder is accepted');
select tests.ok(
  has_column_privilege('authenticated', 'public.storage_locations', 'image_path', 'UPDATE'),
  'signed-in members may set the cover photo');
select tests.ok(
  not has_column_privilege('authenticated', 'public.storage_locations', 'link_code', 'UPDATE'),
  'the sticker code is still not writable from the app');
update public.storage_locations set image_path = null where id = (select v from tests.vars where k = 'photo_loc')::uuid;
