-- More kinds of place, so the app covers attics, garages, sheds, wardrobes, gardens and boxes,
-- not just kitchens. Additive only: existing rows and values are untouched.
alter type public.location_type add value if not exists 'attic';
alter type public.location_type add value if not exists 'garage';
alter type public.location_type add value if not exists 'shed';
alter type public.location_type add value if not exists 'wardrobe';
alter type public.location_type add value if not exists 'garden';
alter type public.location_type add value if not exists 'box';
