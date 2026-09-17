-- Plates & Pace — core schema (PLAN.md §7).
--
-- Two invariants run through every table here:
--   1. A training day is a calendar date in the athlete's own time zone, so
--      every day-scoped column is `date`, never `timestamptz`. Timestamps are
--      only ever used for "when did this row change".
--   2. Every row is owned by exactly one user, via `user_id`, so the RLS
--      policies in the next migration can be uniform and auditable.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- profiles --

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (length(trim(display_name)) between 1 and 60),
  locale text not null default 'en' check (locale in ('en', 'es')),
  timezone text not null default 'UTC',
  units text not null default 'metric' check (units in ('metric', 'imperial')),
  sex text check (sex in ('female', 'male', 'unspecified')),
  birth_date date,
  height_cm numeric(5, 1) check (height_cm between 100 and 260),
  -- PAR-Q answers, e.g. {"heart_condition": false, "pregnancy": false, ...}
  health_flags jsonb not null default '{}'::jsonb,
  -- Set when any PAR-Q answer is yes: starting loads drop 15% (PLAN.md §6.5).
  conservative_mode boolean not null default false,
  onboarded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.profiles.timezone is
  'IANA zone. The only source of truth for what day it is for this athlete.';

-- ------------------------------------------------------- body measurements --

create table public.body_measurements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  weight_kg numeric(5, 2) check (weight_kg between 25 and 400),
  waist_cm numeric(5, 1) check (waist_cm between 40 and 250),
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

create index body_measurements_user_date_idx
  on public.body_measurements (user_id, date desc);

-- ---------------------------------------------------- questionnaire answers --

create table public.questionnaire_answers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  version integer not null check (version >= 1),
  answers jsonb not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (user_id, version)
);

-- Editing the questionnaire writes a new version and deactivates the old one,
-- so history survives while exactly one version drives generation.
create unique index questionnaire_answers_single_active_idx
  on public.questionnaire_answers (user_id)
  where active;

-- ------------------------------------------------------------------- plans --

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  block integer not null check (block >= 1),
  start_date date not null,
  weeks integer not null check (weeks in (4, 6, 8, 12)),
  -- Snapshot of the athlete model the block was generated from, so a plan can
  -- always be explained even after the questionnaire changes.
  settings jsonb not null,
  created_at timestamptz not null default now(),
  unique (user_id, block)
);

-- -------------------------------------------------------- planned sessions --

create table public.planned_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  plan_id uuid not null references public.plans (id) on delete cascade,
  date date not null,
  type text not null check (type in ('gym', 'run', 'gym_run', 'rest')),
  content jsonb not null,
  created_at timestamptz not null default now(),
  -- One session per calendar day: the Today screen and the offline cache both
  -- rely on this. Hybrid days carry both blocks inside `content`.
  unique (user_id, date)
);

create index planned_sessions_user_date_idx
  on public.planned_sessions (user_id, date);

-- ------------------------------------------------------------ session logs --

create table public.session_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  planned_session_id uuid references public.planned_sessions (id) on delete set null,
  date date not null,
  -- {"sleep": 1-5, "soreness": 1-5, "energy": 1-5} (PLAN.md §6.5)
  readiness jsonb,
  done boolean not null default false,
  notes text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, date)
);

create index session_logs_user_date_idx on public.session_logs (user_id, date desc);
create index session_logs_user_done_idx on public.session_logs (user_id, date) where done;

-- ---------------------------------------------------------------- set logs --

create table public.set_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  session_log_id uuid not null references public.session_logs (id) on delete cascade,
  exercise_id text not null,
  set_index integer not null check (set_index >= 0),
  kg numeric(6, 2) check (kg >= 0),
  reps integer check (reps >= 0 and reps <= 100),
  rpe numeric(3, 1) check (rpe >= 1 and rpe <= 10),
  done boolean not null default false,
  logged_at timestamptz not null default now(),
  -- The offline outbox resolves conflicts last-write-wins per this key.
  unique (session_log_id, exercise_id, set_index)
);

create index set_logs_user_exercise_idx on public.set_logs (user_id, exercise_id);

-- ---------------------------------------------------------------- run logs --

create table public.run_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  session_log_id uuid references public.session_logs (id) on delete cascade,
  date date not null,
  planned_type text check (
    planned_type in ('easy', 'long', 'threshold', 'interval', 'run_walk', 'race', 'time_trial')
  ),
  minutes numeric(6, 2) check (minutes > 0),
  km numeric(6, 3) check (km > 0),
  avg_pace_s_per_km integer check (avg_pace_s_per_km between 120 and 1800),
  created_at timestamptz not null default now()
);

create index run_logs_user_date_idx on public.run_logs (user_id, date desc);

-- ------------------------------------------------------ exercise preferences --

create table public.exercise_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  slot_key text,
  from_exercise_id text not null,
  -- Null means "never show this exercise again" rather than "swap it for that".
  to_exercise_id text,
  scope text not null check (scope in ('session', 'global')),
  -- Required for a one-day swap, meaningless for a permanent one.
  date date,
  created_at timestamptz not null default now(),
  constraint exercise_preferences_session_needs_date
    check (scope <> 'session' or date is not null)
);

create index exercise_preferences_user_idx on public.exercise_preferences (user_id, scope);

-- ------------------------------------------------------------------ groups --

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 60),
  owner_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.group_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  -- Opt-in only. Off means the group sees name, weekly sessions and streak.
  share_details boolean not null default false,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create index group_members_user_idx on public.group_members (user_id);

create table public.group_invites (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  code char(6) not null unique,
  created_by uuid not null references auth.users (id) on delete cascade,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------- updated_at triggers --

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

create trigger session_logs_touch_updated_at
  before update on public.session_logs
  for each row execute function public.touch_updated_at();
