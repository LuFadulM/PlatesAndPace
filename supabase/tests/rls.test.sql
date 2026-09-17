-- RLS and RPC behaviour (PLAN.md §11.4 spec 5, §12).
--
-- Run against a database with the migrations applied. Any failure raises, so
-- the script exits non-zero under `psql -v ON_ERROR_STOP=1`.

\o /dev/null

create or replace function public.assert(cond boolean, msg text)
returns void language plpgsql as $$
begin
  if cond is not true then
    raise exception 'ASSERTION FAILED: %', msg;
  end if;
end;
$$;

-- ------------------------------------------------------------- fixtures --

delete from auth.users;

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'ana@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'beto@example.com'),
  ('33333333-3333-3333-3333-333333333333', 'carla@example.com');

insert into public.profiles (user_id, display_name, locale, timezone, sex, birth_date, height_cm)
values
  ('11111111-1111-1111-1111-111111111111', 'Ana', 'es', 'America/Bogota', 'female', '1998-04-02', 166),
  ('22222222-2222-2222-2222-222222222222', 'Beto', 'es', 'America/Bogota', 'male', '1986-01-20', 178),
  ('33333333-3333-3333-3333-333333333333', 'Carla', 'en', 'Europe/Madrid', 'female', '2000-11-11', 171);

insert into public.body_measurements (user_id, date, weight_kg, waist_cm)
values ('11111111-1111-1111-1111-111111111111', current_date, 61.5, 72.0);

insert into public.plans (id, user_id, block, start_date, weeks, settings)
values ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
        1, current_date, 8, '{"goal":"hybrid"}'::jsonb);

insert into public.session_logs (id, user_id, date, done)
values ('bbbbbbbb-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
        current_date, true);

insert into public.set_logs (user_id, session_log_id, exercise_id, set_index, kg, reps, rpe, done)
values ('11111111-1111-1111-1111-111111111111', 'bbbbbbbb-0000-0000-0000-000000000001',
        'back_squat', 0, 60.0, 8, 8.0, true);

-- --------------------------------------------- a user sees their own rows --

set role authenticated;
do $become$ begin perform set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false); end $become$;

select public.assert((select count(*) from public.set_logs) = 1, 'Ana should see her own set log');
select public.assert((select count(*) from public.profiles) = 1, 'Ana should see exactly one profile, her own');
select public.assert((select count(*) from public.body_measurements) = 1, 'Ana should see her own measurement');

-- ------------------------------------- another user sees none of them --

do $become$ begin perform set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false); end $become$;

select public.assert((select count(*) from public.set_logs) = 0, 'Beto must not read Ana''s set logs');
select public.assert((select count(*) from public.session_logs) = 0, 'Beto must not read Ana''s session logs');
select public.assert((select count(*) from public.body_measurements) = 0, 'Beto must not read Ana''s body measurements');
select public.assert((select count(*) from public.plans) = 0, 'Beto must not read Ana''s plans');
select public.assert(
  (select count(*) from public.profiles where user_id <> '22222222-2222-2222-2222-222222222222') = 0,
  'Beto must not read anyone else''s profile');

-- A targeted read by primary key is no different from a scan.
select public.assert(
  (select count(*) from public.set_logs where session_log_id = 'bbbbbbbb-0000-0000-0000-000000000001') = 0,
  'Beto must not read Ana''s set logs even by id');

-- Nor may he write into her rows.
do $$
begin
  begin
    insert into public.set_logs (user_id, session_log_id, exercise_id, set_index, kg, reps, rpe, done)
    values ('11111111-1111-1111-1111-111111111111', 'bbbbbbbb-0000-0000-0000-000000000001',
            'bench_press', 0, 40, 8, 8, true);
    raise exception 'ASSERTION FAILED: Beto must not insert rows owned by Ana';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;

reset role;

-- ------------------------------------------------------------- groups --

set role authenticated;
do $become$ begin perform set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false); end $become$;

-- Creating a group goes through the RPC: three rows, atomically, as the
-- signed-in user. The plain-insert route cannot read the new id back
-- (RETURNING is filtered by the SELECT policy before membership exists).
do $$
declare v_id uuid;
begin
  v_id := public.create_group('Bogotá crew');
  perform public.assert(v_id is not null, 'create_group should return the new id');
  perform public.assert(
    (select count(*) from public.groups where id = v_id and owner_id = '11111111-1111-1111-1111-111111111111') = 1,
    'the creator should own the new group');
  perform public.assert(
    (select role from public.group_members where group_id = v_id and user_id = '11111111-1111-1111-1111-111111111111') = 'owner',
    'the creator should be a member with the owner role');
  perform public.assert(
    (select count(*) from public.group_invites where group_id = v_id and code ~ '^[A-HJ-NP-Z2-9]{6}$') = 1,
    'a six-character invite from the unambiguous alphabet should exist');
  -- Carry the generated code to the statements below. (An UPDATE here would
  -- silently touch zero rows: group_invites has no update policy, by design.)
  perform set_config('test.invite_code',
    (select code from public.group_invites where group_id = v_id), false);
  -- And the id: a subquery on groups would run under Beto's RLS below, inside
  -- the same statement that first makes him a member, and see nothing.
  perform set_config('test.group_id', v_id::text, false);
end;
$$;

-- Beto joins with the code, which he could not have read directly.
do $become$ begin perform set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false); end $become$;

select public.assert(
  (select count(*) from public.group_invites) = 0,
  'a non-member must not be able to read invites');

select public.assert(
  public.join_group_with_code(lower(current_setting('test.invite_code'))) = current_setting('test.group_id')::uuid,
  'joining by code should be case-insensitive and return the group');

select public.assert(
  (select count(*) from public.group_members where group_id = current_setting('test.group_id')::uuid) = 2,
  'the group should now have two members');

-- The summary shows names, weekly counts and streaks — and nothing more.
select public.assert(
  (select count(*) from public.group_weekly_summary(current_setting('test.group_id')::uuid)) = 2,
  'both members should appear in the summary');

select public.assert(
  (select sessions_done_this_week from public.group_weekly_summary(current_setting('test.group_id')::uuid)
   where display_name = 'Ana') = 1,
  'Ana''s completed session should be counted for the week');

-- Structural check: the RPC's shape is the whole cross-user surface.
select public.assert(
  (select array_agg(a.attname::text order by a.attnum)
   from pg_proc p
   join unnest(p.proallargtypes, p.proargnames) with ordinality as a(atttypid, attname, attnum) on true
   where p.proname = 'group_weekly_summary')
  = array['p_group_id', 'member_id', 'display_name', 'sessions_done_this_week', 'streak_days'],
  'group_weekly_summary must expose exactly member_id, display_name, sessions_done_this_week, streak_days');

-- Even inside a group, the private tables stay private.
select public.assert(
  (select count(*) from public.body_measurements) = 0,
  'a fellow group member must still not read body measurements');
select public.assert(
  (select count(*) from public.set_logs) = 0,
  'a fellow group member must still not read set logs');

-- A stranger cannot call the summary at all.
do $become$ begin perform set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', false); end $become$;
do $$
begin
  begin
    perform public.group_weekly_summary(current_setting('test.group_id')::uuid);
    raise exception 'ASSERTION FAILED: a non-member must not read the group summary';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;

reset role;

-- ------------------------------------------------------------- streak --

-- Every date here is Ana's date in America/Bogota. Using the server's
-- current_date instead would drift by a day whenever the server runs in UTC and
-- it is past 19:00 in Bogotá — exactly the class of bug the date engine exists
-- to prevent, so the fixture must not reintroduce it.
insert into public.planned_sessions (user_id, plan_id, date, type, content)
select '11111111-1111-1111-1111-111111111111',
       'aaaaaaaa-0000-0000-0000-000000000001',
       (now() at time zone 'America/Bogota')::date - offs,
       case when offs = 4 then 'rest' else 'gym' end,
       '{}'::jsonb
from generate_series(1, 4) as offs
on conflict (user_id, date) do update set type = excluded.type;

insert into public.session_logs (user_id, date, done)
select '11111111-1111-1111-1111-111111111111',
       (now() at time zone 'America/Bogota')::date - offs,
       true
from generate_series(1, 3) as offs
on conflict (user_id, date) do update set done = true;

select public.assert(
  public.training_streak('11111111-1111-1111-1111-111111111111') = 3,
  'three completed planned sessions in a row is a streak of 3, got '
    || public.training_streak('11111111-1111-1111-1111-111111111111'));

-- A rest day sits at offset 4 and a further gym day at offset 5, completed.
-- The rest day must not break the run.
insert into public.planned_sessions (user_id, plan_id, date, type, content)
values ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000001',
        (now() at time zone 'America/Bogota')::date - 5, 'gym', '{}'::jsonb)
on conflict (user_id, date) do update set type = 'gym';

insert into public.session_logs (user_id, date, done)
values ('11111111-1111-1111-1111-111111111111',
        (now() at time zone 'America/Bogota')::date - 5, true)
on conflict (user_id, date) do update set done = true;

select public.assert(
  public.training_streak('11111111-1111-1111-1111-111111111111') = 4,
  'a rest day in the plan must not break the streak, got '
    || public.training_streak('11111111-1111-1111-1111-111111111111'));

-- A planned session that was never completed does break it.
update public.session_logs
set done = false
where user_id = '11111111-1111-1111-1111-111111111111'
  and date = (now() at time zone 'America/Bogota')::date - 2;

select public.assert(
  public.training_streak('11111111-1111-1111-1111-111111111111') = 1,
  'a missed planned session ends the streak, got '
    || public.training_streak('11111111-1111-1111-1111-111111111111'));

-- An unfinished session today must not read as a miss.
--
-- The isolation fixture above logged a completed session for Ana on the
-- server's current_date, which is Bogotá's today for most of the day (and
-- Bogotá's tomorrow after 19:00). Make today explicitly unfinished so this
-- assertion means the same thing whatever the hour.
insert into public.planned_sessions (user_id, plan_id, date, type, content)
values ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000001',
        (now() at time zone 'America/Bogota')::date, 'gym', '{}'::jsonb)
on conflict (user_id, date) do update set type = 'gym';

insert into public.session_logs (user_id, date, done)
values ('11111111-1111-1111-1111-111111111111', (now() at time zone 'America/Bogota')::date, false)
on conflict (user_id, date) do update set done = false;

select public.assert(
  public.training_streak('11111111-1111-1111-1111-111111111111') = 1,
  'today being unfinished must not break yesterday''s streak, got '
    || public.training_streak('11111111-1111-1111-1111-111111111111'));

-- ------------------------------------------------------------- export --

set role authenticated;
do $become$ begin perform set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false); end $become$;

select public.assert(
  public.export_my_data() -> 'set_logs' = '[]'::jsonb,
  'Beto''s export must not contain Ana''s set logs');
select public.assert(
  public.export_my_data() -> 'profile' ->> 'display_name' = 'Beto',
  'an export should contain the caller''s own profile');

reset role;

\o
\echo 'ALL RLS ASSERTIONS PASSED'
