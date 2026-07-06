-- Re-schedules the send-event-reminders cron job with valid credentials.
-- (010 was applied with unsubstituted placeholders; cron.schedule upserts by
-- job name, so this replaces it.)
-- NOTE: applied with real values substituted at push time; placeholders kept out of git.
--   __ANON_KEY__    = project anon key (Dashboard -> Settings -> API)
--   __CRON_SECRET__ = matches the CRON_SECRET Edge Function secret

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
