-- Schedule the daily morning reminder email.
-- Run this AFTER deploying the `daily-digest` Edge Function.
--
-- The function runs hourly and emails each user only when it's the send-hour
-- (default 7am) in *their* timezone — so everyone gets it in their own
-- morning, no matter where they live. That's why the cron is hourly.
--
-- Replace <PROJECT_REF> with your Supabase project ref.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Top of every hour.
select cron.schedule(
  'nudge-daily-digest',
  '0 * * * *',
  $$
  select net.http_post(
    url     := 'https://<PROJECT_REF>.functions.supabase.co/daily-digest',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body    := '{}'::jsonb
  );
  $$
);

-- To change the schedule, unschedule then re-create:
--   select cron.unschedule('nudge-daily-digest');
