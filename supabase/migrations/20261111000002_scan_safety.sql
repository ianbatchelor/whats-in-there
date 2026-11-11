-- Two safety changes for label scans. Only the extract-product function (service role) can call
-- these functions; nobody signed in to the app can.
--
-- 1. The shared barcode list no longer trusts a single scan. A barcode's name, brand and weight are
--    shared with everyone only once two different people have scanned it and the name read the same
--    both times. Until then each scan shows what was read from that person's own photo. If a later
--    scan disagrees, the waiting entry is replaced, so a bad first reading can't block the barcode.
--    Rows already in the list start unconfirmed and are confirmed by the next matching scan.
--
-- 2. The scan limits are checked and counted in one step (reserve_scan), under a lock per person
--    and per household, so firing many scans at the same moment can't get past them. The function
--    then fills in the reserved row with the result.

alter table public.products
  add column if not exists confirmed boolean not null default false,
  add column if not exists candidate_by uuid references auth.users on delete set null;

-- Same name if the letters and digits match, ignoring case, spaces and punctuation.
create or replace function public.same_product_name(a text, b text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select lower(regexp_replace(coalesce(a, ''), '[^[:alnum:]]+', '', 'g'))
       = lower(regexp_replace(coalesce(b, ''), '[^[:alnum:]]+', '', 'g'))
     and length(regexp_replace(coalesce(a, ''), '[^[:alnum:]]+', '', 'g')) > 0;
$$;

-- Called with one scan's reading of a valid barcode. p_name, p_brand and p_weight_* are null when
-- that part wasn't read clearly. Returns the shared details to use (product_name, brand,
-- weight_value, weight_unit) when the barcode is confirmed, else null.
create or replace function public.share_product_reading(
  p_barcode      text,
  p_user         uuid,
  p_name         text,
  p_brand        text,
  p_weight_value numeric,
  p_weight_unit  public.stock_unit
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  known public.products%rowtype;
  v_name  text := nullif(left(btrim(coalesce(p_name, '')), 120), '');
  v_brand text := nullif(left(btrim(coalesce(p_brand, '')), 80), '');
  v_wv    numeric := case when p_weight_value > 0 and p_weight_value <= 100000 and p_weight_unit in ('g', 'kg', 'ml', 'l') then p_weight_value end;
  v_wu    public.stock_unit := case when p_weight_value > 0 and p_weight_value <= 100000 and p_weight_unit in ('g', 'kg', 'ml', 'l') then p_weight_unit end;
begin
  if p_barcode is null or p_barcode !~ '^[0-9]{8,14}$' then
    return null;
  end if;

  select * into known from public.products where barcode = p_barcode for update;

  if not found then
    if v_name is null then
      return null;
    end if;
    insert into public.products (barcode, product_name, brand, weight_value, weight_unit, confirmed, candidate_by)
    values (p_barcode, v_name, v_brand, v_wv, v_wu, false, p_user)
    on conflict (barcode) do nothing;
    return null;
  end if;

  if not known.confirmed then
    if v_name is null or known.candidate_by is not distinct from p_user then
      return null;                                    -- the same person can't confirm their own scan
    end if;
    if not public.same_product_name(known.product_name, v_name) then
      update public.products set                      -- disagreement: this reading becomes the one waiting
        product_name = v_name, brand = v_brand, weight_value = v_wv, weight_unit = v_wu,
        candidate_by = p_user, times_seen = known.times_seen + 1, updated_at = now()
      where barcode = p_barcode;
      return null;
    end if;
    update public.products set                        -- a second person agrees: share it from now on
      confirmed = true,
      brand = coalesce(known.brand, v_brand),
      weight_value = coalesce(known.weight_value, v_wv),
      weight_unit = case when known.weight_value is null then v_wu else known.weight_unit end,
      times_seen = known.times_seen + 1,
      updated_at = now()
    where barcode = p_barcode
    returning * into known;
  else
    update public.products set times_seen = known.times_seen + 1, updated_at = now() where barcode = p_barcode;
  end if;

  return jsonb_build_object(
    'product_name', known.product_name,
    'brand', known.brand,
    'weight_value', known.weight_value,
    'weight_unit', known.weight_unit
  );
end;
$$;

-- Checks the limits and, if the scan is allowed, records it straight away (error_code 'pending')
-- so that scans arriving at the same moment see each other. Returns the new attempt's id, or the
-- name of the limit that was reached: too_many_now, too_many_this_month or too_many_today.
create or replace function public.reserve_scan(
  p_household          uuid,
  p_user               uuid,
  p_image_path         text,
  p_model              text,
  p_per_user_minute    int,
  p_per_user_month     int,
  p_per_household_day  int
)
returns table (attempt_id uuid, refused text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id uuid;
begin
  -- Always person first, then household, so two scans never wait on each other in a circle.
  perform pg_advisory_xact_lock(hashtextextended('scan-user:' || p_user::text, 0));
  perform pg_advisory_xact_lock(hashtextextended('scan-household:' || p_household::text, 0));

  if (select count(*) from public.ai_extraction_attempts a
      where a.actor_user_id = p_user and a.created_at >= now() - interval '1 minute') >= p_per_user_minute then
    return query select null::uuid, 'too_many_now'::text;
    return;
  end if;
  if (select count(*) from public.ai_extraction_attempts a
      where a.actor_user_id = p_user and a.created_at >= now() - interval '30 days') >= p_per_user_month then
    return query select null::uuid, 'too_many_this_month'::text;
    return;
  end if;
  if (select count(*) from public.ai_extraction_attempts a
      where a.household_id = p_household and a.created_at >= now() - interval '1 day') >= p_per_household_day then
    return query select null::uuid, 'too_many_today'::text;
    return;
  end if;

  insert into public.ai_extraction_attempts (household_id, actor_user_id, image_path, model, error_code)
  values (p_household, p_user, p_image_path, p_model, 'pending')
  returning ai_extraction_attempts.id into new_id;
  return query select new_id, null::text;
end;
$$;

revoke all on function public.same_product_name(text, text) from public, anon, authenticated;
revoke all on function public.share_product_reading(text, uuid, text, text, numeric, public.stock_unit) from public, anon, authenticated;
revoke all on function public.reserve_scan(uuid, uuid, text, text, int, int, int) from public, anon, authenticated;
grant execute on function public.same_product_name(text, text) to service_role;
grant execute on function public.share_product_reading(text, uuid, text, text, numeric, public.stock_unit) to service_role;
grant execute on function public.reserve_scan(uuid, uuid, text, text, int, int, int) to service_role;
