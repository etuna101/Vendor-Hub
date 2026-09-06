CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

SELECT cron.unschedule('vendorhub-daily-debt-reminders')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'vendorhub-daily-debt-reminders');

SELECT cron.schedule(
  'vendorhub-daily-debt-reminders',
  '0 4 * * *',
  $$
  SELECT net.http_post(
    url := 'https://xqjcvilgexoqkdhfpvfh.supabase.co/functions/v1/debt-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', '8JHp2PRjzxADbEF-7pMiA5CgLZmlfQdd_VeVG6nqvmviKBfD'
    ),
    body := '{}'::jsonb
  );
  $$
);