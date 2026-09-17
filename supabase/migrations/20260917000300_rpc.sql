-- Remote procedures (PLAN.md §7).
--
-- These are the only places where one user's data informs another's screen, and
-- the only places where a row is reached without a matching RLS policy. Each one
-- checks membership itself and returns a fixed, narrow column set.

-- ------------------------------------------------------------- streak --

-- How many planned sessions in a row the athlete has completed, walking back
-- from today in their own time zone.
--
-- Only days that carry a planned training session count. A rest day in the plan
-- neither extends nor breaks the run, and a day with no plan at all is skipped
-- rather than treated as a miss — otherwise every rest day would reset a streak
-- that a 4-day-a-week athlete can never keep. Today is excluded while it is
-- still unfinished, so an evening session does not appear to have been missed.
create or replace function public.training_streak(p_user_id uuid)
returns integer
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  v_zone text;
  v_today date;
  v_cursor date;
  v_streak integer := 0;
  v_planned boolean;
  v_done boolean;
  v_guard integer := 0;
begin
  select p.timezone into v_zone
  from public.profiles p
  where p.user_id = p_user_id;

  if v_zone is null then
    return 0;
  end if;

  v_today := (now() at time zone v_zone)::date;
  v_cursor := v_today;

  -- A year back is further than any streak worth showing, and bounds the walk
  -- for an account with no sessions at all.
  while v_guard < 366 loop
    v_guard := v_guard + 1;

    select exists (
      select 1 from public.planned_sessions ps
      where ps.user_id = p_user_id and ps.date = v_cursor and ps.type <> 'rest'
    ) into v_planned;

    if v_planned then
      select exists (
        select 1 from public.session_logs sl
        where sl.user_id = p_user_id and sl.date = v_cursor and sl.done
      ) into v_done;

      if v_done then
        v_streak := v_streak + 1;
      elsif v_cursor < v_today then
        -- A planned session that was never completed ends the run.
        exit;
      end if;
    end if;

    v_cursor := v_cursor - 1;
  end loop;

  return v_streak;
end;
$$;

-- --------------------------------------------------- group weekly summary --

-- The entire cross-user surface of the product. Three columns: who, how many
-- sessions this week, how long their streak is. No weights, no body data, no
-- logs, no health flags — and no way to ask for them.
create or replace function public.group_weekly_summary(p_group_id uuid)
returns table (
  member_id uuid,
  display_name text,
  sessions_done_this_week integer,
  streak_days integer
)
language plpgsql
security definer
stable
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.is_group_member(p_group_id, auth.uid()) then
    raise exception 'not a member of this group' using errcode = '42501';
  end if;

  return query
  select
    p.user_id,
    p.display_name,
    (
      select count(*)::integer
      from public.session_logs sl
      where sl.user_id = p.user_id
        and sl.done
        -- date_trunc('week') is Monday-based, matching the plan week.
        and sl.date >= (date_trunc('week', (now() at time zone p.timezone)))::date
    ),
    public.training_streak(p.user_id)
  from public.group_members gm
  join public.profiles p on p.user_id = gm.user_id
  where gm.group_id = p_group_id
  order by p.display_name;
end;
$$;

-- ------------------------------------------------------- join by code --

-- Joining needs to resolve an invite the caller cannot yet read, so the lookup
-- happens here rather than through a policy that would expose every invite.
create or replace function public.join_group_with_code(p_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_group_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  select gi.group_id into v_group_id
  from public.group_invites gi
  where upper(gi.code) = upper(p_code)
    and (gi.expires_at is null or gi.expires_at > now());

  if v_group_id is null then
    raise exception 'invalid or expired invite code' using errcode = '22023';
  end if;

  insert into public.group_members (group_id, user_id, role)
  values (v_group_id, auth.uid(), 'member')
  on conflict (group_id, user_id) do nothing;

  return v_group_id;
end;
$$;

-- ------------------------------------------------------------- export --

-- "Export my data as JSON" (PLAN.md §1). Runs as the caller, so RLS applies and
-- it can only ever return the caller's own rows.
create or replace function public.export_my_data()
returns jsonb
language sql
security invoker
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'exported_at', now(),
    'profile', (select to_jsonb(p) from public.profiles p where p.user_id = auth.uid()),
    'body_measurements', coalesce((select jsonb_agg(to_jsonb(b)) from public.body_measurements b where b.user_id = auth.uid()), '[]'::jsonb),
    'questionnaire_answers', coalesce((select jsonb_agg(to_jsonb(q)) from public.questionnaire_answers q where q.user_id = auth.uid()), '[]'::jsonb),
    'plans', coalesce((select jsonb_agg(to_jsonb(pl)) from public.plans pl where pl.user_id = auth.uid()), '[]'::jsonb),
    'planned_sessions', coalesce((select jsonb_agg(to_jsonb(ps)) from public.planned_sessions ps where ps.user_id = auth.uid()), '[]'::jsonb),
    'session_logs', coalesce((select jsonb_agg(to_jsonb(sl)) from public.session_logs sl where sl.user_id = auth.uid()), '[]'::jsonb),
    'set_logs', coalesce((select jsonb_agg(to_jsonb(st)) from public.set_logs st where st.user_id = auth.uid()), '[]'::jsonb),
    'run_logs', coalesce((select jsonb_agg(to_jsonb(r)) from public.run_logs r where r.user_id = auth.uid()), '[]'::jsonb),
    'exercise_preferences', coalesce((select jsonb_agg(to_jsonb(e)) from public.exercise_preferences e where e.user_id = auth.uid()), '[]'::jsonb)
  );
$$;

-- ------------------------------------------------------------- delete --

-- "Delete account" (PLAN.md §1). Removing the auth user cascades to every table
-- in the schema, so there is no per-table delete list to keep in sync.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  -- Hand groups this user owns to another member, or drop them outright, so a
  -- departing owner never strands a group nobody can administer.
  update public.groups g
  set owner_id = (
    select gm.user_id
    from public.group_members gm
    where gm.group_id = g.id and gm.user_id <> v_uid
    order by gm.joined_at
    limit 1
  )
  where g.owner_id = v_uid
    and exists (
      select 1 from public.group_members gm
      where gm.group_id = g.id and gm.user_id <> v_uid
    );

  delete from public.groups g where g.owner_id = v_uid;
  delete from auth.users u where u.id = v_uid;
end;
$$;

revoke execute on function public.training_streak(uuid) from public;
revoke execute on function public.group_weekly_summary(uuid) from public;
revoke execute on function public.join_group_with_code(text) from public;
revoke execute on function public.export_my_data() from public;
revoke execute on function public.delete_my_account() from public;

grant execute on function public.group_weekly_summary(uuid) to authenticated;
grant execute on function public.join_group_with_code(text) to authenticated;
grant execute on function public.export_my_data() to authenticated;
grant execute on function public.delete_my_account() to authenticated;
