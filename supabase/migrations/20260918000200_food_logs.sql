-- What the athlete actually ate, against the targets the engine already sets.
--
-- Entries are the athlete's own: a name and the macros they enter. The brief
-- named USDA FoodData Central and Open Food Facts as sources, and neither is
-- reachable from this environment, so there is no food database behind this
-- and nothing here is looked up. Inventing macro values for named foods would
-- be fabricating a nutritional claim (CLAUDE.md, rule 9), so the app asks
-- rather than guesses. A dataset can be joined onto `name` later without
-- changing what is stored.
create table public.food_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- A calendar date in the athlete's own time zone, like every day-scoped
  -- column in this schema.
  date date not null,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  -- Whole kilocalories; the rest in whole grams. Nobody eats to a decigram and
  -- integers keep the sums exact.
  kcal integer not null check (kcal between 0 and 10000),
  protein_g integer not null default 0 check (protein_g between 0 and 1000),
  carbs_g integer not null default 0 check (carbs_g between 0 and 1000),
  fat_g integer not null default 0 check (fat_g between 0 and 1000),
  logged_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index food_logs_user_date_idx on public.food_logs (user_id, date desc);

alter table public.food_logs enable row level security;

create policy food_logs_select_own on public.food_logs
  for select to authenticated using (auth.uid() = user_id);
create policy food_logs_insert_own on public.food_logs
  for insert to authenticated with check (auth.uid() = user_id);
create policy food_logs_update_own on public.food_logs
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy food_logs_delete_own on public.food_logs
  for delete to authenticated using (auth.uid() = user_id);
