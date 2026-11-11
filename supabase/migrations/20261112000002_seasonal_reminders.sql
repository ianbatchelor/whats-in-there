-- Seasonal reminders (check the medicine cabinet, swap the wardrobe over, winter kit for the car).
-- Which reminders and when live in the app; this only records that someone at home has done one, so
-- it disappears for everyone in the household until it comes round again.

create table public.seasonal_done (
  household_id uuid not null references public.households on delete cascade,
  reminder     text not null check (reminder ~ '^[a-z0-9-]{1,40}$'),
  -- Which time it came round, e.g. '2026-10'. The same reminder can come round twice a year.
  period       text not null check (period ~ '^[0-9]{4}-[0-9]{2}$'),
  done_by      uuid default auth.uid() references auth.users on delete set null,
  done_at      timestamptz not null default now(),
  primary key (household_id, reminder, period)
);

alter table public.seasonal_done enable row level security;
revoke all on public.seasonal_done from anon, authenticated;
grant select on public.seasonal_done to authenticated;
-- Who did it and when come from the signed-in person and the clock, never from the app.
grant insert (household_id, reminder, period) on public.seasonal_done to authenticated;
create policy seasonal_done_select on public.seasonal_done for select to authenticated
  using (public.is_member(household_id));
create policy seasonal_done_insert on public.seasonal_done for insert to authenticated
  with check (public.is_member(household_id));
