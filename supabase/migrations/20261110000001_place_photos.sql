-- A household's own cover photo for a place (their actual freezer, shed or wardrobe).
-- The photo lives in the existing private item-photos bucket under {household_id}/places/, so the
-- storage policies already cover it. The check stops a place pointing at another household's file.
alter table public.storage_locations
  add column if not exists image_path text;

alter table public.storage_locations
  drop constraint if exists storage_locations_image_path_check;
alter table public.storage_locations
  add constraint storage_locations_image_path_check
  check (image_path is null or (length(image_path) <= 200 and image_path like household_id::text || '/places/%'));

grant update (image_path) on public.storage_locations to authenticated;
