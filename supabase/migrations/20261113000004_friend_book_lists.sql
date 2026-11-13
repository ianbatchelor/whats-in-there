-- Friends' own book lists. Someone with a household's book list link can start a list of their own
-- (just a first name, no account), which then shows in that household so the household can get
-- them a book too. They keep it from the same browser with a private key, the way "I'm getting
-- this" can be taken back. Friends can also suggest a book for the list they were sent.

alter table public.wish_lists add column friend boolean not null default false;
alter table public.wish_ideas add column suggested_by text check (length(btrim(suggested_by)) between 1 and 40);

-- The private key a friend's browser keeps to change their own list. Never readable.
create table public.wish_list_keys (
  list_id  uuid primary key references public.wish_lists on delete cascade,
  key_hash text not null
);
alter table public.wish_list_keys enable row level security;
revoke all on public.wish_list_keys from anon, authenticated;

-- Limits, so a link that gets passed around can't be used to fill the database.
create function public.friend_limits_ok(p_household uuid, p_list uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select count(*) from public.wish_ideas where list_id = p_list) < 150
     and (select count(*) from public.wish_ideas where list_id = p_list and added_at > now() - interval '1 hour') < 40;
$$;

-- The list a share code points at, if it's a book list.
create function public.book_list_by_code(p_code text)
returns public.wish_lists
language sql
stable
security definer
set search_path = ''
as $$
  select * from public.wish_lists where share_code = p_code and kind = 'books' and p_code ~ '^[0-9A-Za-z]{10}$';
$$;

-- "Start my list" from a book list link. Returns the new list's own link code and the private key.
create function public.start_friend_book_list(p_code text, p_name text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  src public.wish_lists;
  new_list public.wish_lists;
  raw text;
begin
  src := public.book_list_by_code(p_code);
  if src.id is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if length(btrim(coalesce(p_name, ''))) not between 1 and 40 then
    raise exception 'name_needed' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('friend-lists:' || src.household_id::text, 0));
  if (select count(*) from public.wish_lists where household_id = src.household_id and friend) >= 40 then
    raise exception 'too_many_lists' using errcode = 'P0001';
  end if;
  insert into public.wish_lists (household_id, name, kind, friend, share_code, created_by)
    values (src.household_id, btrim(p_name), 'books', true, public.generate_link_code(), null)
    returning * into new_list;
  raw := translate(encode(extensions.gen_random_bytes(24), 'base64'), '+/=', '-_');
  insert into public.wish_list_keys (list_id, key_hash) values (new_list.id, encode(extensions.digest(raw, 'sha256'), 'hex'));
  return jsonb_build_object('code', new_list.share_code, 'key', raw);
end;
$$;

-- Whether a key opens a list, by the list's link code. Returns the list, or raises.
create function public.friend_list_for(p_code text, p_key text)
returns public.wish_lists
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  l public.wish_lists;
begin
  select w.* into l from public.wish_lists w join public.wish_list_keys k on k.list_id = w.id
  where w.share_code = p_code and p_code ~ '^[0-9A-Za-z]{10}$'
    and k.key_hash = encode(extensions.digest(coalesce(p_key, ''), 'sha256'), 'hex');
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  return l;
end;
$$;

create function public.add_friend_book(p_code text, p_key text, p_title text, p_author text, p_isbn text, p_cover integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  l public.wish_lists;
begin
  l := public.friend_list_for(p_code, p_key);
  if not public.friend_limits_ok(l.household_id, l.id) then
    raise exception 'too_many_books' using errcode = 'P0001';
  end if;
  insert into public.wish_ideas (list_id, household_id, title, author, isbn, cover_id)
    values (l.id, l.household_id, left(btrim(p_title), 120), nullif(left(btrim(coalesce(p_author, '')), 120), ''), p_isbn, p_cover);
end;
$$;

create function public.remove_friend_book(p_code text, p_key text, p_idea uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  l public.wish_lists;
begin
  l := public.friend_list_for(p_code, p_key);
  delete from public.wish_ideas where id = p_idea and list_id = l.id;
end;
$$;

-- A friend removing their own list altogether.
create function public.remove_friend_book_list(p_code text, p_key text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  l public.wish_lists;
begin
  l := public.friend_list_for(p_code, p_key);
  delete from public.wish_lists where id = l.id;
end;
$$;

-- "Suggest a book" for the list someone was sent, with their first name.
create function public.suggest_shared_book(p_code text, p_name text, p_title text, p_author text, p_isbn text, p_cover integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  l public.wish_lists;
begin
  l := public.book_list_by_code(p_code);
  if l.id is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if length(btrim(coalesce(p_name, ''))) not between 1 and 40 then
    raise exception 'name_needed' using errcode = '22023';
  end if;
  if not public.friend_limits_ok(l.household_id, l.id) then
    raise exception 'too_many_books' using errcode = 'P0001';
  end if;
  insert into public.wish_ideas (list_id, household_id, title, author, isbn, cover_id, suggested_by)
    values (l.id, l.household_id, left(btrim(p_title), 120), nullif(left(btrim(coalesce(p_author, '')), 120), ''), p_isbn, p_cover, btrim(p_name));
end;
$$;

-- The shared page also says whether the list is a friend's, and who suggested a book.
create or replace function public.shared_wish_list(p_code text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'name', coalesce(l.name, p.display_name, 'Someone'),
    'kind', l.kind,
    'friend', l.friend,
    'ideas', coalesce((
      select jsonb_agg(jsonb_build_object(
          'id', i.id, 'title', i.title, 'note', i.note, 'link', i.link, 'price', i.price, 'favourite', i.favourite,
          'imagePath', i.image_path,
          'author', i.author, 'coverId', i.cover_id, 'suggestedBy', i.suggested_by,
          'taken', c.idea_id is not null,
          'takenBy', coalesce(c.claimed_name, cp.display_name)
        ) order by i.favourite desc, i.added_at)
      from public.wish_ideas i
      left join public.wish_claims c on c.idea_id = i.id
      left join public.profiles cp on cp.user_id = c.claimed_by
      where i.list_id = l.id), '[]'::jsonb)
  )
  from public.wish_lists l
  left join public.profiles p on p.user_id = l.for_user
  where l.share_code = p_code and p_code ~ '^[0-9A-Za-z]{10}$';
$$;

revoke all on function public.friend_limits_ok(uuid, uuid), public.book_list_by_code(text), public.friend_list_for(text, text),
  public.start_friend_book_list(text, text), public.add_friend_book(text, text, text, text, text, integer),
  public.remove_friend_book(text, text, uuid), public.remove_friend_book_list(text, text),
  public.suggest_shared_book(text, text, text, text, text, integer)
  from public, anon, authenticated;
grant execute on function public.start_friend_book_list(text, text), public.add_friend_book(text, text, text, text, text, integer),
  public.remove_friend_book(text, text, uuid), public.remove_friend_book_list(text, text),
  public.suggest_shared_book(text, text, text, text, text, integer)
  to anon, authenticated;
