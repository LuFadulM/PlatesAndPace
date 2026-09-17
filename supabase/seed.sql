-- Local development seed (PLAN.md §7).
--
-- Creates one demo athlete matching the worked example in PLAN.md §1: a hybrid
-- lifter in Bogotá training Monday–Friday with three runs a week, currently
-- running 3 km in 20:00. Signing in as this user and letting the engine
-- generate a block is the fastest way to see a populated Today screen.
--
-- Runs only against the local stack (`supabase start` / `supabase db reset`).

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data
)
values (
  '00000000-0000-0000-0000-000000000000',
  'd0000000-0000-4000-8000-000000000001',
  'authenticated',
  'authenticated',
  'demo@platesandpace.local',
  crypt('demo-password', gen_salt('bf')),
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb
)
on conflict (id) do nothing;

insert into public.profiles (
  user_id, display_name, locale, timezone, units,
  sex, birth_date, height_cm, health_flags, conservative_mode, onboarded_at
)
values (
  'd0000000-0000-4000-8000-000000000001',
  'Demo',
  'es',
  'America/Bogota',
  'metric',
  'unspecified',
  '1996-05-14',
  172.0,
  '{"heart_condition":false,"chest_pain":false,"dizziness":false,"joint_problem":false,"blood_pressure_medication":false,"pregnancy":false,"other":false}'::jsonb,
  false,
  now()
)
on conflict (user_id) do nothing;

insert into public.body_measurements (user_id, date, weight_kg, waist_cm)
values (
  'd0000000-0000-4000-8000-000000000001',
  (now() at time zone 'America/Bogota')::date,
  70.0,
  78.0
)
on conflict (user_id, date) do nothing;

insert into public.questionnaire_answers (user_id, version, answers, active)
values (
  'd0000000-0000-4000-8000-000000000001',
  1,
  jsonb_build_object(
    'basics', jsonb_build_object(
      'displayName', 'Demo', 'locale', 'es', 'timezone', 'America/Bogota', 'units', 'metric'),
    'body', jsonb_build_object(
      'sex', 'unspecified', 'birthDate', '1996-05-14', 'heightCm', 172, 'weightKg', 70),
    'health', jsonb_build_object('anyYes', false),
    'goals', jsonb_build_object(
      'primary', 'hybrid', 'runTargetDistanceKm', 10),
    'experience', jsonb_build_object(
      'lifting', '1_to_3_years',
      'knowsBigLifts', true,
      'recentRun', jsonb_build_object('km', 3, 'minutes', 20)),
    'schedule', jsonb_build_object(
      'gymDays', jsonb_build_array(1, 2, 3, 4, 5),
      'runDays', jsonb_build_array(2, 4, 6),
      'longRunDay', 6,
      'sessionMinutes', 60),
    'equipment', jsonb_build_object('setting', 'full_gym', 'unavailableMachines', jsonb_build_array()),
    'injuries', jsonb_build_object('areas', jsonb_build_array(), 'note', ''),
    'preferences', jsonb_build_object(
      'focusAreas', jsonb_build_array('back', 'legs'),
      'intensity', 'hard',
      'avoid', jsonb_build_array())
  ),
  true
)
on conflict (user_id, version) do nothing;
