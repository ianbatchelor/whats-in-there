-- Private photo bucket. The first folder must be a household you belong to (compared as text, so odd paths
-- elsewhere in storage can never make a policy error).
-- Paths are {household_id}/{item_or_attempt_id}/{file}.webp
insert into storage.buckets (id, name, public)
values ('item-photos', 'item-photos', false)
on conflict (id) do nothing;

create policy item_photos_select on storage.objects for select to authenticated
  using (bucket_id = 'item-photos' and (storage.foldername(name))[1] in (
    select m.household_id::text from public.household_members m where m.user_id = (select auth.uid())));

create policy item_photos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'item-photos' and (storage.foldername(name))[1] in (
    select m.household_id::text from public.household_members m where m.user_id = (select auth.uid())));

create policy item_photos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'item-photos' and (storage.foldername(name))[1] in (
    select m.household_id::text from public.household_members m where m.user_id = (select auth.uid())));
