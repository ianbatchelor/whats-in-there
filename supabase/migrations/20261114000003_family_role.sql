-- Family: someone with their own home (a grown-up daughter, a grandparent) who belongs to the
-- household for presents and Christmas, and nothing else. A new enum value has to be committed
-- before anything can use it, so it gets a migration of its own.
alter type public.member_role add value if not exists 'family';
