-- The secret pg_cron sends to send-notifications, kept in Vault (supabase/scripts/notifications-cron.sql
-- creates it). The function reads it from here instead of needing its own CRON_SECRET, so the only
-- function secret to set by hand is Apple's key. Service role only.
create function public.notify_cron_secret()
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  s text;
begin
  -- Vault isn't there in the local test database; nothing matches then.
  if to_regclass('vault.decrypted_secrets') is null then
    return null;
  end if;
  execute 'select decrypted_secret from vault.decrypted_secrets where name = ''notify_cron_secret''' into s;
  return s;
end;
$$;
revoke all on function public.notify_cron_secret() from public, anon, authenticated;
grant execute on function public.notify_cron_secret() to service_role;
