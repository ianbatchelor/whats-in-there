-- Phone notifications, step 1: new present and book ideas, and things added to lists you share.
--
-- Each person chooses per list whether to hear about it (the bell on the list). Wish lists and lists
-- shared with family or a group start switched on; household lists start off. Nothing about who is
-- getting what is ever sent: claims make no notifications at all, and the person a wish list is for
-- isn't told when someone else adds an idea to it.
--
-- How it flows: adding an idea or a list entry writes a row per person to tell (notify_events). The
-- send-notifications function picks them up once a list has been quiet for a few minutes, so a burst
-- of adds becomes one message, and holds them through each person's quiet hours. A thing deleted
-- before it's sent (a typo fixed) takes its row with it.

-- ---------- Phones ----------

-- One row per phone that has said yes to notifications. A phone that changes hands moves to whoever
-- signs in on it. apns_env is learnt on the first send: Xcode builds talk to Apple's sandbox,
-- TestFlight and App Store builds to production.
create table public.push_devices (
  token      text primary key check (token ~ '^[0-9a-f]{64,200}$'),
  user_id    uuid not null references auth.users on delete cascade,
  platform   text not null default 'ios' check (platform = 'ios'),
  apns_env   text check (apns_env in ('production', 'sandbox')),
  updated_at timestamptz not null default now()
);
create index push_devices_user_idx on public.push_devices (user_id);

-- ---------- Each person's choices ----------

create table public.notify_prefs (
  user_id    uuid primary key references auth.users on delete cascade default auth.uid(),
  paused     boolean not null default false,
  -- Quiet hours, in the person's own time: nothing arrives from quiet_from until quiet_to.
  quiet_from smallint not null default 22 check (quiet_from between 0 and 23),
  quiet_to   smallint not null default 8 check (quiet_to between 0 and 23),
  time_zone  text not null default 'Europe/London' check (length(time_zone) between 1 and 64)
);

-- A bell set on a list. No row means the list's starting choice (see notify_default).
create table public.notify_follows (
  user_id     uuid not null references auth.users on delete cascade default auth.uid(),
  target_kind text not null check (target_kind in ('wish_list', 'list')),
  target_id   uuid not null,
  mode        text not null check (mode in ('every', 'off')),
  primary key (user_id, target_kind, target_id)
);

-- ---------- Waiting to be sent ----------

create table public.notify_events (
  id          bigint generated always as identity primary key,
  recipient   uuid not null references auth.users on delete cascade,
  target_kind text not null check (target_kind in ('wish_list', 'list')),
  target_id   uuid not null,
  actor       uuid references auth.users on delete set null,
  idea_id     uuid references public.wish_ideas on delete cascade,
  entry_id    uuid references public.list_entries on delete cascade,
  what        text not null,
  created_at  timestamptz not null default now(),
  sent_at     timestamptz
);
create index notify_events_waiting_idx on public.notify_events (recipient, target_kind, target_id) where sent_at is null;
create index notify_events_idea_idx on public.notify_events (idea_id) where idea_id is not null;
create index notify_events_entry_idx on public.notify_events (entry_id) where entry_id is not null;

-- ---------- Who hears about what ----------

-- The starting choice for a list, before anyone touches its bell.
create function public.notify_default(p_kind text, p_visibility text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case when p_kind = 'wish_list' then 'every'
              when p_visibility in ('family', 'group') then 'every'
              else 'off' end;
$$;

-- Whether to tell this person about this list right now: they chose it (or it starts on), they
-- haven't paused everything, and they have a phone to tell.
create function public.wants_notifying(p_user uuid, p_kind text, p_target uuid, p_default text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select f.mode from public.notify_follows f
                   where f.user_id = p_user and f.target_kind = p_kind and f.target_id = p_target), p_default) = 'every'
     and not coalesce((select p.paused from public.notify_prefs p where p.user_id = p_user), false)
     and exists (select 1 from public.push_devices d where d.user_id = p_user);
$$;

-- A new idea on a wish list: tell everyone who can see the list, except whoever added it and the
-- person the list is for (an idea someone adds for you is meant to stay a little quiet).
create function public.notify_new_idea()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.notify_events (recipient, target_kind, target_id, actor, idea_id, what)
  select m.user_id, 'wish_list', l.id, new.added_by, new.id, new.title
  from public.wish_lists l
  join public.household_members m on m.household_id = l.household_id
  where l.id = new.list_id
    and m.user_id is distinct from new.added_by
    and m.user_id is distinct from l.for_user
    and (m.role <> 'family' or l.kind = 'presents')
    and public.wants_notifying(m.user_id, 'wish_list', l.id, 'every');
  return null;
end;
$$;
create trigger wish_ideas_notify after insert on public.wish_ideas
  for each row execute function public.notify_new_idea();

-- Something added to a shared list: tell everyone it's shared with, except whoever added it.
create function public.notify_new_entry()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  l public.lists;
begin
  select * into l from public.lists where id = new.list_id;
  if l.visibility = 'me' then
    return null;
  end if;
  insert into public.notify_events (recipient, target_kind, target_id, actor, entry_id, what)
  select who.user_id, 'list', l.id, new.added_by, new.id, new.text
  from (
    select m.user_id from public.household_members m
      where l.visibility = 'household' and m.household_id = l.household_id and m.role <> 'family'
    union
    select m.user_id from public.household_members m
      where l.visibility = 'family' and m.household_id = l.household_id
    union
    select g.user_id from public.list_members g where l.visibility = 'group' and g.list_id = l.id
    union
    select l.owner
  ) who
  where who.user_id is distinct from new.added_by
    and public.wants_notifying(who.user_id, 'list', l.id, public.notify_default('list', l.visibility));
  return null;
end;
$$;
create trigger list_entries_notify after insert on public.list_entries
  for each row execute function public.notify_new_entry();

-- ---------- What the app can do ----------

-- This phone wants notifications for whoever is signed in on it.
create function public.register_push_device(p_token text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_user();
  insert into public.push_devices (token, user_id) values (lower(p_token), auth.uid())
  on conflict (token) do update set user_id = excluded.user_id, updated_at = now();
end;
$$;

-- Signing out: stop sending to this phone.
create function public.forget_push_device(p_token text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.push_devices where token = lower(p_token) and user_id = (select auth.uid());
$$;

-- A time zone Postgres doesn't know would stop quiet hours working, so check it on the way in.
create function public.check_notify_prefs()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.user_id := auth.uid();
  perform now() at time zone new.time_zone;
  return new;
end;
$$;
create trigger notify_prefs_check before insert or update on public.notify_prefs
  for each row execute function public.check_notify_prefs();

create function public.stamp_notify_follow()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.user_id := auth.uid();
  return new;
end;
$$;
create trigger notify_follows_stamp before insert or update on public.notify_follows
  for each row execute function public.stamp_notify_follow();

alter table public.push_devices enable row level security;
alter table public.notify_prefs enable row level security;
alter table public.notify_follows enable row level security;
alter table public.notify_events enable row level security;
revoke all on public.push_devices, public.notify_prefs, public.notify_follows, public.notify_events from anon, authenticated;

-- Phones are only added and removed through the functions above. You can see that yours is there.
grant select on public.push_devices to authenticated;
create policy push_devices_select on public.push_devices for select to authenticated
  using (user_id = (select auth.uid()));

grant select, delete on public.notify_prefs to authenticated;
grant insert (paused, quiet_from, quiet_to, time_zone) on public.notify_prefs to authenticated;
grant update (paused, quiet_from, quiet_to, time_zone) on public.notify_prefs to authenticated;
create policy notify_prefs_own on public.notify_prefs for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

grant select, delete on public.notify_follows to authenticated;
grant insert (target_kind, target_id, mode) on public.notify_follows to authenticated;
grant update (target_kind, target_id, mode) on public.notify_follows to authenticated;
create policy notify_follows_own on public.notify_follows for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
-- notify_events is never readable from the app: only send-notifications (service role) uses it.

-- ---------- For send-notifications (service role only) ----------

-- What's ready to send: one row per person and list that has been quiet for a few minutes (or has
-- been busy for half an hour), outside that person's quiet hours, with the names to put in it.
-- Rows for people who have since turned the bell off, or paused, are dropped on the way.
create function public.notifications_due(p_quiet interval default interval '5 minutes')
returns table (
  event_ids  bigint[],
  recipient  uuid,
  target_kind text,
  target_id  uuid,
  actors     text[],
  things     text[],
  total      int,
  list_title text,
  list_kind  text,
  for_user   uuid,
  for_name   text,
  household_id uuid,
  devices    jsonb
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Housekeeping: sent ones are kept a week, then go.
  delete from public.notify_events where sent_at < now() - interval '7 days';

  -- Turned off or paused since: nothing to send for them.
  update public.notify_events e set sent_at = now()
  where e.sent_at is null and not public.wants_notifying(e.recipient, e.target_kind, e.target_id,
    case when e.target_kind = 'wish_list' then 'every'
         else public.notify_default('list', (select l.visibility from public.lists l where l.id = e.target_id)) end);

  return query
  with waiting as (
    select e.recipient, e.target_kind, e.target_id,
           array_agg(e.id order by e.id) as ids,
           array_agg(e.what order by e.id) as whats,
           array_agg(e.actor order by e.id) as actor_ids,
           max(e.created_at) as newest, min(e.created_at) as oldest
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
         coalesce(ol.title, wl.name),
         case when w.target_kind = 'wish_list' then wl.kind else 'list' end,
         wl.for_user,
         coalesce(fp.display_name, wl.name),
         wl.household_id,
         (select coalesce(jsonb_agg(jsonb_build_object('token', d.token, 'env', d.apns_env)), '[]'::jsonb)
            from public.push_devices d where d.user_id = w.recipient)
  from waiting w
  left join public.lists ol on w.target_kind = 'list' and ol.id = w.target_id
  left join public.wish_lists wl on w.target_kind = 'wish_list' and wl.id = w.target_id
  left join public.profiles fp on fp.user_id = wl.for_user
  left join public.notify_prefs np on np.user_id = w.recipient
  where (w.newest < now() - p_quiet or w.oldest < now() - interval '30 minutes')
    and not public.in_quiet_hours(now(), coalesce(np.quiet_from, 22), coalesce(np.quiet_to, 8), coalesce(np.time_zone, 'Europe/London'));
end;
$$;

-- Whether a moment falls in someone's quiet hours (from 22 to 8 means overnight). Equal hours: none.
create function public.in_quiet_hours(p_at timestamptz, p_from int, p_to int, p_zone text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select case
    when p_from = p_to then false
    when p_from > p_to then extract(hour from p_at at time zone p_zone) >= p_from or extract(hour from p_at at time zone p_zone) < p_to
    else extract(hour from p_at at time zone p_zone) >= p_from and extract(hour from p_at at time zone p_zone) < p_to
  end;
$$;

revoke all on function public.notify_default(text, text), public.wants_notifying(uuid, text, uuid, text),
  public.notify_new_idea(), public.notify_new_entry(), public.register_push_device(text), public.forget_push_device(text),
  public.check_notify_prefs(), public.stamp_notify_follow(), public.notifications_due(interval),
  public.in_quiet_hours(timestamptz, int, int, text)
  from public, anon, authenticated;
grant execute on function public.register_push_device(text), public.forget_push_device(text) to authenticated;
grant execute on function public.notifications_due(interval), public.in_quiet_hours(timestamptz, int, int, text) to service_role;
grant select, update, delete on public.notify_events, public.push_devices to service_role;
