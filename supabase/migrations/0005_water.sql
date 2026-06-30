-- =====================================================================
-- Nudge — Water tracker
--
-- Lets a user log how much water they drink (via configurable containers
-- like Glass / Mug), see the daily total, and get reminder notifications
-- spread evenly across a daily time window. Owner-only RLS throughout.
-- =====================================================================

-- Per-user water settings (one row).
create table if not exists water_settings (
  user_id                 uuid primary key references auth.users on delete cascade,
  daily_goal_ml           int,                              -- null = no goal
  reminders_enabled       boolean not null default true,
  reminders_per_day       int not null default 8,
  window_start            time not null default '08:00',
  window_end              time not null default '21:00',
  last_water_reminder_key text,                             -- "YYYY-MM-DD#slot" dedup
  created_at              timestamptz not null default now()
);

-- Configurable containers (Glass = 250 ml, Mug = 350 ml, …).
create table if not exists water_containers (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users on delete cascade,
  name        text not null,
  volume_ml   int not null,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists idx_water_containers_user on water_containers(user_id, sort_order);

-- Each logged drink.
create table if not exists water_logs (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users on delete cascade,
  amount_ml    int not null,
  container_id uuid references water_containers on delete set null,
  logged_at    timestamptz not null default now(),
  created_at   timestamptz not null default now()
);

create index if not exists idx_water_logs_user on water_logs(user_id, logged_at desc);

-- ---------------------------------------------------------------------
-- Owner-only RLS
-- ---------------------------------------------------------------------
alter table water_settings   enable row level security;
alter table water_containers enable row level security;
alter table water_logs       enable row level security;

drop policy if exists water_settings_owner on water_settings;
create policy water_settings_owner on water_settings
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists water_containers_owner on water_containers;
create policy water_containers_owner on water_containers
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists water_logs_owner on water_logs;
create policy water_logs_owner on water_logs
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
