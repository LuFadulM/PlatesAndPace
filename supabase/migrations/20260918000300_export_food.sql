-- The export promises every row the account owns (settings, "Export my data"),
-- so a new table has to be added here the day it is added to the schema.
-- `food_logs` arrived in 20260918000200 and was missing from the list.
--
-- Still `security invoker`: RLS decides what each subquery can see, so this can
-- only ever return the caller's own rows.
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
    'food_logs', coalesce((select jsonb_agg(to_jsonb(f)) from public.food_logs f where f.user_id = auth.uid()), '[]'::jsonb),
    'exercise_preferences', coalesce((select jsonb_agg(to_jsonb(e)) from public.exercise_preferences e where e.user_id = auth.uid()), '[]'::jsonb)
  );
$$;
