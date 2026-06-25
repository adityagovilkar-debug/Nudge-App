-- =====================================================================
-- Nudge — Web Push notifications (Android/PWA + desktop)
--
-- Stores each device's push subscription (owner-only RLS) and adds the
-- bookkeeping columns the send job uses to avoid sending duplicates:
--  * errands.reminded_at      — set when a due-time push has been sent
--  * profiles.last_morning_push_on — the local date the morning push was sent
-- =====================================================================

create table if not exists push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  user_agent  text,
  created_at  timestamptz not null default now()
);

create index if not exists idx_push_user on push_subscriptions(user_id);

alter table push_subscriptions enable row level security;

drop policy if exists push_owner on push_subscriptions;
create policy push_owner on push_subscriptions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Bookkeeping columns for the send job.
alter table errands  add column if not exists reminded_at timestamptz;
alter table profiles add column if not exists last_morning_push_on date;
