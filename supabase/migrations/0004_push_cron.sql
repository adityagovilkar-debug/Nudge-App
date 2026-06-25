-- Schedule the Web Push send job.
-- Run this AFTER deploying the app to Vercel with the push env vars set
-- (NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT,
--  CRON_SECRET, SUPABASE_SERVICE_ROLE_KEY).
--
-- It calls the Vercel API route /api/push/send every minute. That route:
--   * sends a notification at each errand's due time, and
--   * sends a morning summary at REMINDER_HOUR in each user's timezone.
-- The route is protected by CRON_SECRET, sent here as a bearer token.
--
-- Replace <CRON_SECRET> below with the same value you set in Vercel, and
-- confirm the site URL matches your deployment.

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'nudge-push-send',
  '* * * * *',            -- every minute (gives ~1-minute due-time accuracy)
  $$
  select net.http_post(
    url     := 'https://nudge-app-zeta.vercel.app/api/push/send',
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'Authorization', 'Bearer <CRON_SECRET>'
               ),
    body    := '{}'::jsonb
  );
  $$
);

-- To change or remove later:
--   select cron.unschedule('nudge-push-send');
