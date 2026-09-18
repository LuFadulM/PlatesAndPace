-- Joint pain per movement, so the engine can act on it (CLAUDE.md, rule 2).
--
-- Pain belongs to a session and a movement, not to a single set: an athlete
-- reports that squats hurt their knee, not that the third rep of set two did.
-- A jsonb map on the session log keeps it beside readiness, which it is
-- closest to in meaning, and inherits that table's row level security rather
-- than needing policies of its own.
--
-- Shape: {"back_squat": 2, "bench_press": 1} where the value is 1 (twinge),
-- 2 (hurts) or 3 (stop). Absent means nothing was reported, which is not the
-- same as "no pain" and is never counted as evidence either way.
alter table public.session_logs
  add column if not exists pain jsonb;

comment on column public.session_logs.pain is
  'Per-exercise joint pain for the session: {"<exercise_id>": 1|2|3}. Absent means unreported.';
