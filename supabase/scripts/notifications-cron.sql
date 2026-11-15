-- Runs send-notifications every minute, but only calls it when something is waiting.
-- Run once, after the notifications migrations and after deploying the function. Replace the
-- project's URL first. The secret is made here and only ever kept in Vault; the function reads it
-- through notify_cron_secret().

create extension if not exists pg_cron;
create extension if not exists pg_net;

select vault.create_secret('https://YOUR-PROJECT.supabase.co/functions/v1/send-notifications', 'notify_url');
select vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'notify_cron_secret');

select cron.schedule('send-notifications', '* * * * *', $cron$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'notify_url'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'notify_cron_secret')),
    body := '{}'::jsonb)
  where exists (select 1 from public.notify_events where sent_at is null);
$cron$);
