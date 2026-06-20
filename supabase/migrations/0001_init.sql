-- =====================================================================
-- Nudge — initial schema
-- A simple personal errands & reminders app. Single user per account.
--
-- Design notes:
--  * Everything is owned by exactly one user. RLS is owner-only:
--    every row carries user_id and policies require user_id = auth.uid().
--    A user can NEVER see another user's data.
--  * An `errand` is one to-do (title, note, category, due date/time,
--    Important star, done). It can carry a checklist of sub-items
--    (a shopping list / steps).
--  * Recurrence is "on completion": when a recurring errand is marked
--    done, the app creates the next occurrence (see lib/errands.ts). The
--    completed row stays as history.
-- =====================================================================

create extension if not exists "pgcrypto";   -- gen_random_uuid()

-- ---------------------------------------------------------------------
-- profiles — one row per auth user. Holds the reminder-email preference
-- and the user's timezone (so "today" in the morning digest matches the
-- user's local day).
-- ---------------------------------------------------------------------
create table if not exists profiles (
  id              uuid primary key references auth.users on delete cascade,
  email           text,
  full_name       text,
  email_reminders boolean not null default true,
  timezone        text not null default 'UTC',
  created_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- categories — a small, editable list of labels with a color. Seeded
-- with friendly defaults on signup; fully owned + editable by the user.
-- ---------------------------------------------------------------------
create table if not exists categories (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users on delete cascade,
  name        text not null,
  color       text not null default 'indigo',  -- a key into a fixed palette
  sort_order  int  not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists idx_categories_user on categories(user_id);

-- ---------------------------------------------------------------------
-- errands — the core to-do.
-- ---------------------------------------------------------------------
create table if not exists errands (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users on delete cascade,
  title               text not null,
  note                text,
  category_id         uuid references categories on delete set null,
  due_date            date,                -- the day it's due (optional)
  due_time            time,                -- optional time of day
  important           boolean not null default false,   -- the ★ star
  done                boolean not null default false,
  done_at             timestamptz,
  -- on-completion recurrence: null | 'daily' | 'weekly' | 'monthly' | 'yearly'
  recurrence          text check (recurrence in ('daily','weekly','monthly','yearly')),
  recurrence_interval int not null default 1,            -- every N units
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists idx_errands_user      on errands(user_id);
create index if not exists idx_errands_open       on errands(user_id, done, due_date);
create index if not exists idx_errands_done_at    on errands(user_id, done_at desc);

-- keep updated_at fresh
create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

drop trigger if exists trg_errands_updated on errands;
create trigger trg_errands_updated before update on errands
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- checklist_items — shopping / checklist sub-items belonging to an errand.
-- user_id is denormalized from the parent errand to keep RLS simple & fast.
-- ---------------------------------------------------------------------
create table if not exists checklist_items (
  id          uuid primary key default gen_random_uuid(),
  errand_id   uuid not null references errands on delete cascade,
  user_id     uuid not null references auth.users on delete cascade,
  text        text not null,
  done        boolean not null default false,
  position    int not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists idx_checklist_errand on checklist_items(errand_id, position);
create index if not exists idx_checklist_user   on checklist_items(user_id);

-- =====================================================================
-- Row Level Security — strictly owner-only on every table.
-- =====================================================================
alter table profiles        enable row level security;
alter table categories      enable row level security;
alter table errands         enable row level security;
alter table checklist_items enable row level security;

drop policy if exists profiles_owner on profiles;
create policy profiles_owner on profiles
  for all using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists categories_owner on categories;
create policy categories_owner on categories
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists errands_owner on errands;
create policy errands_owner on errands
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists checklist_owner on checklist_items;
create policy checklist_owner on checklist_items
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- =====================================================================
-- New-user bootstrap: create the profile + a handful of friendly default
-- categories so the very first screen is useful immediately.
-- =====================================================================
create or replace function handle_new_user()
returns trigger
language plpgsql security definer
set search_path = public as $$
begin
  insert into profiles (id, email, full_name)
  values (new.id, new.email,
          coalesce(new.raw_user_meta_data->>'full_name', new.email))
  on conflict (id) do nothing;

  insert into categories (user_id, name, color, sort_order) values
    (new.id, 'Errands',   'indigo', 0),
    (new.id, 'Shopping',  'emerald', 1),
    (new.id, 'Health',    'rose', 2),
    (new.id, 'Home',      'amber', 3),
    (new.id, 'Family',    'sky', 4),
    (new.id, 'Money',     'violet', 5);

  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
