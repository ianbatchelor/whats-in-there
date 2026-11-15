-- Runs send-notifications every minute, but only calls it when something is waiting.
-- Run once, after the notifications migration and after deploying the function. Replace the two
-- values first: the project's URL, and a long random secret that is also saved as the function's
-- CRON_SECRET (Supabase > Edge Functions > Secrets).

create extension if not exists pg_cron;
create extension if not exists pg_net;

select vault.create_secret('https://YOUR-PROJECT.supabase.co/functions/v1/send-notifications', 'notify_url');
select vault.create_secret('REPLACE-WITH-THE-SAME-SECRET-AS-CRON_SECRET', 'notify_cron_secret');

select cron.schedule('send-notifications', '* * * * *', $cron$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'notify_url'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'notify_cron_secret')),
    body := '{}'::jsonb)
  where exists (select 1 from public.notify_events where sent_at is null);
$cron$);
