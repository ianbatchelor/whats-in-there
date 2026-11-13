-- Present ideas from a shop link: the read-link function opens the shop page, picks out the name,
-- picture and price, and keeps a copy of the picture so it doesn't break when the shop changes it.

-- The picture for an idea. Kept in its own public bucket because it is the shop's own product
-- picture, and family looking at a shared list (who have no account) need to see it too.
alter table public.wish_ideas add column image_path text check (image_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp|gif)$');
grant insert (image_path) on public.wish_ideas to authenticated;
grant update (image_path) on public.wish_ideas to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('wish-pictures', 'wish-pictures', true, 3145728, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do nothing;
-- Only the read-link function (service role) puts pictures here; nobody else can write.

-- One row per link read, for the allowance and to see what works.
create table public.link_reads (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households on delete cascade,
  user_id      uuid references auth.users on delete set null,
  host         text not null,
  used_ai      boolean not null default false,
  found        text,
  error_code   text,
  created_at   timestamptz not null default now()
);
create index link_reads_user_idx on public.link_reads (user_id, created_at);
alter table public.link_reads enable row level security;
revoke all on public.link_reads from anon, authenticated;

-- Checks the allowance and counts this read in one step, under a lock per person.
create function public.reserve_link_read(p_household uuid, p_user uuid, p_host text, p_per_minute int, p_per_month int)
returns table (read_id uuid, refused text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended('link-user:' || p_user::text, 0));
  if (select count(*) from public.link_reads r where r.user_id = p_user and r.created_at >= now() - interval '1 minute') >= p_per_minute then
    return query select null::uuid, 'too_many_now'::text;
    return;
  end if;
  if (select count(*) from public.link_reads r where r.user_id = p_user and r.created_at >= now() - interval '30 days') >= p_per_month then
    return query select null::uuid, 'too_many_links'::text;
    return;
  end if;
  insert into public.link_reads (household_id, user_id, host, error_code) values (p_household, p_user, left(p_host, 200), 'pending')
  returning id into new_id;
  return query select new_id, null::text;
end;
$$;
revoke all on function public.reserve_link_read(uuid, uuid, text, int, int) from public, anon, authenticated;
grant execute on function public.reserve_link_read(uuid, uuid, text, int, int) to service_role;

-- The shared page shows the picture too.
create or replace function public.shared_wish_list(p_code text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'name', coalesce(l.name, p.display_name, 'Someone'),
    'ideas', coalesce((
      select jsonb_agg(jsonb_build_object(
          'id', i.id, 'title', i.title, 'note', i.note, 'link', i.link, 'price', i.price, 'favourite', i.favourite,
          'imagePath', i.image_path,
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
