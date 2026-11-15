-- Phone notifications, step 2: places, a daily summary, and "use it soon" reminders.
--
-- Places get the same bell as lists, off to start with. Turned on, you hear when someone adds to or
-- takes from that place (a box inside it counts as the place). Any bell can also be set to a daily
-- summary: everything from that list or place in one message at 6 pm. And a place you follow sends
-- a morning reminder (9 am) when something in it is near its use-by or best-before date, and, on
-- Saturdays, what's been in a freezer for over three months.

-- ---------- What can be followed, and how ----------

alter table public.notify_follows drop constraint notify_follows_target_kind_check;
alter table public.notify_follows add constraint notify_follows_target_kind_check check (target_kind in ('wish_list', 'list', 'place'));
alter table public.notify_follows drop constraint notify_follows_mode_check;
alter table public.notify_follows add constraint notify_follows_mode_check check (mode in ('every', 'daily', 'off'));

alter table public.notify_events drop constraint notify_events_target_kind_check;
alter table public.notify_events add constraint notify_events_target_kind_check check (target_kind in ('wish_list', 'list', 'place'));
-- For places: whether something went in or came out, and the movement, so an undo takes it back.
alter table public.notify_events add column verb text not null default 'added' check (verb in ('added', 'took'));
alter table public.notify_events add column movement_id uuid references public.stock_movements on delete cascade;
create index notify_events_movement_idx on public.notify_events (movement_id) where movement_id is not null;

-- Which morning reminders have gone, so each place sends at most one a day.
create table public.notify_reminders_sent (
  user_id  uuid not null references auth.users on delete cascade,
  place_id uuid not null references public.storage_locations on delete cascade,
  day      date not null,
  primary key (user_id, place_id, day)
);
alter table public.notify_reminders_sent enable row level security;
revoke all on public.notify_reminders_sent from anon, authenticated;
grant select, insert, delete on public.notify_reminders_sent to service_role;

-- ---------- Starting choices ----------

create or replace function public.notify_default(p_kind text, p_visibility text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case when p_kind = 'wish_list' then 'every'
              when p_kind = 'place' then 'off'
              when p_visibility in ('family', 'group') then 'every'
              else 'off' end;
$$;

-- The bell's setting for this person and list or place, or its starting choice.
create function public.notify_mode(p_user uuid, p_kind text, p_target uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select f.mode from public.notify_follows f where f.user_id = p_user and f.target_kind = p_kind and f.target_id = p_target),
    public.notify_default(p_kind, case when p_kind = 'list' then (select l.visibility from public.lists l where l.id = p_target) end));
$$;

-- Now "on" means every change or a daily summary. p_default is kept for the step-1 callers.
create or replace function public.wants_notifying(p_user uuid, p_kind text, p_target uuid, p_default text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select f.mode from public.notify_follows f
                   where f.user_id = p_user and f.target_kind = p_kind and f.target_id = p_target), p_default) in ('every', 'daily')
     and not coalesce((select p.paused from public.notify_prefs p where p.user_id = p_user), false)
     and exists (select 1 from public.push_devices d where d.user_id = p_user);
$$;

-- ---------- Something going into or out of a place ----------

-- Who can use a place: people who live in its household, and people let into it (or the place a box is in).
create function public.place_users(p_place uuid)
returns table (user_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select m.user_id from public.storage_locations l
    join public.household_members m on m.household_id = l.household_id and m.role <> 'family'
    where l.id = p_place
  union
  select pm.user_id from public.storage_locations l
    join public.place_members pm on pm.location_id = l.id or pm.location_id = l.parent_id
    where l.id = p_place;
$$;

create function public.notify_stock_movement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  item public.stock_items;
  top uuid;
begin
  -- Taking back a change before it's been sent takes its notification with it.
  if new.action = 'undo' then
    delete from public.notify_events where movement_id = new.reverses_movement_id and sent_at is null;
    return null;
  end if;
  if new.action not in ('add', 'remove') or new.quantity_delta = 0 then
    return null;
  end if;
  select * into item from public.stock_items where id = new.stock_item_id;
  select coalesce(l.parent_id, l.id) into top from public.storage_locations l where l.id = item.location_id;
  insert into public.notify_events (recipient, target_kind, target_id, actor, movement_id, what, verb)
  select u.user_id, 'place', top, new.actor_user_id, new.id, item.product_name,
         case when new.quantity_delta > 0 then 'added' else 'took' end
  from public.place_users(top) u
  where u.user_id is distinct from new.actor_user_id
    and public.wants_notifying(u.user_id, 'place', top, 'off');
  return null;
end;
$$;
create trigger stock_movements_notify after insert on public.stock_movements
  for each row execute function public.notify_stock_movement();

-- ---------- What the sender sees ----------

-- As before, plus places and daily summaries. A daily summary waits for 6 pm in the person's own time.
drop function public.notifications_due(interval);
create function public.notifications_due(p_quiet interval default interval '5 minutes')
returns table (
  event_ids  bigint[],
  recipient  uuid,
  target_kind text,
  target_id  uuid,
  actors     text[],
  things     text[],
  total      int,
  took       int,
  list_title text,
  list_kind  text,
  for_user   uuid,
  for_name   text,
  household_id uuid,
  daily      boolean,
  devices    jsonb
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.notify_events where sent_at < now() - interval '7 days';
  delete from public.notify_reminders_sent where day < current_date - 7;

  -- Turned off or paused since: nothing to send for them.
  update public.notify_events e set sent_at = now()
  where e.sent_at is null
    and not public.wants_notifying(e.recipient, e.target_kind, e.target_id, public.notify_mode(e.recipient, e.target_kind, e.target_id));

  return query
  with waiting as (
    select e.recipient, e.target_kind, e.target_id,
           array_agg(e.id order by e.id) as ids,
           array_agg(e.what order by e.id) as whats,
           array_agg(e.actor order by e.id) as actor_ids,
           count(*) filter (where e.verb = 'took')::int as took_n,
           max(e.created_at) as newest, min(e.created_at) as oldest,
           public.notify_mode(e.recipient, e.target_kind, e.target_id) = 'daily' as is_daily
    from public.notify_events e
    where e.sent_at is null
    group by e.recipient, e.target_kind, e.target_id
  )
  select w.ids, w.recipient, w.target_kind, w.target_id,
         array(select coalesce(p.display_name, 'Someone') from unnest(w.actor_ids) with ordinality a(id, n)
               left join public.profiles p on p.user_id = a.id
               group by a.id, p.display_name order by min(a.n)),
         w.whats[1:3],
         cardinality(w.ids),
         w.took_n,
         coalesce(ol.title, wl.name, pl.name),
         case when w.target_kind = 'wish_list' then wl.kind when w.target_kind = 'place' then pl.type::text else 'list' end,
         wl.for_user,
         coalesce(fp.display_name, wl.name),
         wl.household_id,
         w.is_daily,
         (select coalesce(jsonb_agg(jsonb_build_object('token', d.token, 'env', d.apns_env)), '[]'::jsonb)
            from public.push_devices d where d.user_id = w.recipient)
  from waiting w
  left join public.lists ol on w.target_kind = 'list' and ol.id = w.target_id
  left join public.wish_lists wl on w.target_kind = 'wish_list' and wl.id = w.target_id
  left join public.storage_locations pl on w.target_kind = 'place' and pl.id = w.target_id
  left join public.profiles fp on fp.user_id = wl.for_user
  left join public.notify_prefs np on np.user_id = w.recipient
  where (case when w.is_daily
              then extract(hour from now() at time zone coalesce(np.time_zone, 'Europe/London')) = 18
              else w.newest < now() - p_quiet or w.oldest < now() - interval '30 minutes' end)
    and not public.in_quiet_hours(now(), coalesce(np.quiet_from, 22), coalesce(np.quiet_to, 8), coalesce(np.time_zone, 'Europe/London'));
end;
$$;

-- Morning reminders for places people follow: things near their date (looking 2 days ahead, and up
-- to 3 days past), and on Saturdays, what's been in a freezer more than 90 days. From 9 am in the
-- person's own time, once a day per place, outside quiet hours.
create function public.place_reminders_due()
returns table (
  recipient    uuid,
  place_id     uuid,
  place_name   text,
  place_type   text,
  day          date,
  soon         text[],
  soon_total   int,
  frozen       text[],
  frozen_total int,
  devices      jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  with followers as (
    select f.user_id, f.target_id as place_id,
           (now() at time zone coalesce(np.time_zone, 'Europe/London')) as local_now,
           np.quiet_from, np.quiet_to, np.time_zone
    from public.notify_follows f
    left join public.notify_prefs np on np.user_id = f.user_id
    where f.target_kind = 'place' and f.mode in ('every', 'daily')
      and not coalesce(np.paused, false)
      and exists (select 1 from public.push_devices d where d.user_id = f.user_id)
  ),
  ready as (
    select fo.*, fo.local_now::date as today, l.name, l.type
    from followers fo
    join public.storage_locations l on l.id = fo.place_id and l.archived_at is null
    where extract(hour from fo.local_now) >= 9
      and not public.in_quiet_hours(now(), coalesce(fo.quiet_from, 22), coalesce(fo.quiet_to, 8), coalesce(fo.time_zone, 'Europe/London'))
      and exists (select 1 from public.place_users(fo.place_id) u where u.user_id = fo.user_id)
      and not exists (select 1 from public.notify_reminders_sent r where r.user_id = fo.user_id and r.place_id = fo.place_id and r.day = fo.local_now::date)
  ),
  found as (
    select r.user_id, r.place_id, r.name, r.type, r.today,
      array(select s.product_name from public.stock_items s join public.storage_locations sl on sl.id = s.location_id
            where (sl.id = r.place_id or sl.parent_id = r.place_id) and s.status = 'in_stock'
              and coalesce(s.use_by_date, s.best_before_date) between r.today - 3 and r.today + 2
            order by coalesce(s.use_by_date, s.best_before_date), s.product_name) as soon,
      array(select s.product_name from public.stock_items s join public.storage_locations sl on sl.id = s.location_id
            where (sl.id = r.place_id or sl.parent_id = r.place_id) and s.status = 'in_stock'
              and r.type = 'freezer' and extract(isodow from r.today) = 6
              and coalesce(s.frozen_at, s.added_at::date) < r.today - 90
            order by coalesce(s.frozen_at, s.added_at::date), s.product_name) as frozen
    from ready r
  )
  select f.user_id, f.place_id, f.name, f.type::text, f.today,
         f.soon[1:3], cardinality(f.soon), f.frozen[1:3], cardinality(f.frozen),
         (select coalesce(jsonb_agg(jsonb_build_object('token', d.token, 'env', d.apns_env)), '[]'::jsonb)
            from public.push_devices d where d.user_id = f.user_id)
  from found f
  where cardinality(f.soon) > 0 or cardinality(f.frozen) > 0;
$$;

revoke all on function public.notify_mode(uuid, text, uuid), public.place_users(uuid), public.notify_stock_movement(),
  public.notifications_due(interval), public.place_reminders_due()
  from public, anon, authenticated;
grant execute on function public.notifications_due(interval), public.place_reminders_due() to service_role;
