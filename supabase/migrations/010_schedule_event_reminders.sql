-- Schedules the send-event-reminders Edge Function to run every minute via pg_cron.
-- NOTE: applied with real values substituted at push time; placeholders kept out of git.
--   __ANON_KEY__    = project anon key (Dashboard -> Settings -> API)
--   __CRON_SECRET__ = matches the CRON_SECRET Edge Function secret

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'send-event-reminders',
  '* * * * *',
  $cron$
  select net.http_post(
    url     := 'https://zkdrmmpjhdsoeshpcxqi.supabase.co/functions/v1/send-event-reminders',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer __ANON_KEY__',
      'x-cron-secret', '__CRON_SECRET__'
    ),
    body := '{}'::jsonb
  );
  $cron$
);
