-- Boxes inside places: a place can sit inside another place in the same household ("Blue box",
-- in the Garage). One level only, so a box can't hold a box, and a place holding boxes can't
-- itself go inside something.

alter table public.storage_locations
  add column parent_id uuid,
  -- Same household is enforced by the key itself: (parent_id, household_id) must be a real place there.
  add constraint storage_locations_parent_fk foreign key (parent_id, household_id) references public.storage_locations (id, household_id),
  add constraint storage_locations_not_own_parent check (parent_id is null or parent_id <> id);

create index storage_locations_parent_idx on public.storage_locations (parent_id) where parent_id is not null;

grant insert (parent_id) on public.storage_locations to authenticated;
grant update (parent_id) on public.storage_locations to authenticated;

-- Checks a place's parent: it must be a place in use, not inside anything itself, and the place being
-- put inside it mustn't be holding boxes of its own.
create function public.check_location_parent()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.parent_id is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.parent_id is not distinct from old.parent_id then
    return new;
  end if;
  if exists (select 1 from public.storage_locations p
             where p.id = new.parent_id and (p.parent_id is not null or p.archived_at is not null)) then
    raise exception 'invalid_parent' using errcode = '22023';
  end if;
  if exists (select 1 from public.storage_locations c where c.parent_id = new.id and c.archived_at is null) then
    raise exception 'invalid_parent' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger storage_locations_check_parent before insert or update of parent_id on public.storage_locations
  for each row execute function public.check_location_parent();

-- When a place is removed, the boxes in it stay, as places of their own, so nothing goes missing.
create function public.release_child_locations()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.storage_locations set parent_id = null where parent_id = new.id;
  return new;
end;
$$;

create trigger storage_locations_release_children after update of archived_at on public.storage_locations
  for each row when (old.archived_at is null and new.archived_at is not null)
  execute function public.release_child_locations();
