-- Book wish lists: the books each reader in the household wants to read. Built on the present
-- lists, so the same private share link and hidden "I'll get this" work for books too. A list is
-- now either for presents or for books, and a book can carry its author, ISBN and Open Library
-- cover number.

alter table public.wish_lists add column kind text not null default 'presents' check (kind in ('presents', 'books'));
grant insert (kind) on public.wish_lists to authenticated;

-- One list of each kind per household member.
drop index public.wish_lists_one_each_idx;
create unique index wish_lists_one_each_idx on public.wish_lists (household_id, kind, for_user) where for_user is not null;

alter table public.wish_ideas
  add column author   text check (length(btrim(author)) between 1 and 120),
  add column isbn     text check (isbn ~ '^(97[89][0-9]{10}|[0-9]{9}[0-9X])$'),
  add column cover_id integer check (cover_id > 0);
grant insert (author, isbn, cover_id) on public.wish_ideas to authenticated;
grant update (author, isbn, cover_id) on public.wish_ideas to authenticated;

-- The shared page also says which kind of list it is, and shows a book's author and cover.
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
    'ideas', coalesce((
      select jsonb_agg(jsonb_build_object(
          'id', i.id, 'title', i.title, 'note', i.note, 'link', i.link, 'price', i.price, 'favourite', i.favourite,
          'imagePath', i.image_path,
          'author', i.author, 'coverId', i.cover_id,
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
