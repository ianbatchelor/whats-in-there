-- Cost controls for label photos.
--
-- products: a shared list of products seen on labels, keyed by barcode. The extract-product
-- function fills it from label readings and reuses the name, brand and weight the next time anyone
-- scans the same barcode, so the same product reads the same way in every household. Dates are never
-- stored here: they belong to one pack. Only the function (service role) can read or write it.
--
-- ai_extraction_attempts gains the barcode read and whether the details came from the list, plus an
-- index for the per-person monthly limit the function checks.

create table public.products (
  barcode       text primary key check (barcode ~ '^[0-9]{8,14}$'),
  product_name  text not null check (char_length(product_name) between 1 and 120),
  brand         text check (char_length(brand) <= 80),
  weight_value  numeric check (weight_value > 0 and weight_value <= 100000),
  weight_unit   public.stock_unit check (weight_unit in ('g', 'kg', 'ml', 'l')),
  times_seen    int not null default 1,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.products enable row level security;
revoke all on public.products from anon, authenticated;

alter table public.ai_extraction_attempts
  add column barcode text,
  add column from_cache boolean not null default false;

create index ai_extraction_attempts_user_idx on public.ai_extraction_attempts (actor_user_id, created_at desc);
