-- Row Level Security (PLAN.md §7, §12).
--
-- The privacy guarantee is structural, not procedural: body data, health flags,
-- measurements and logs have no policy and no view that exposes them to anyone
-- but their owner. What a group can see comes from one SECURITY DEFINER RPC
-- that returns three columns and nothing else, so there is no query another
-- member can write that reaches further.

-- Helpers are SECURITY DEFINER so that group policies can consult membership
-- without the group_members policy consulting itself. `search_path = ''` forces
-- every reference to be schema-qualified, which is what stops a caller from
-- shadowing a table name and redirecting the function.

create or replace function public.is_group_member(p_group_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.group_members gm
    where gm.group_id = p_group_id
      and gm.user_id = p_user_id
  );
$$;

create or replace function public.is_group_owner(p_group_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.groups g
    where g.id = p_group_id
      and g.owner_id = p_user_id
  );
$$;

revoke execute on function public.is_group_member(uuid, uuid) from public;
revoke execute on function public.is_group_owner(uuid, uuid) from public;
grant execute on function public.is_group_member(uuid, uuid) to authenticated;
grant execute on function public.is_group_owner(uuid, uuid) to authenticated;

-- ------------------------------------------------- per-user owned tables --

alter table public.profiles enable row level security;
alter table public.body_measurements enable row level security;
alter table public.questionnaire_answers enable row level security;
alter table public.plans enable row level security;
alter table public.planned_sessions enable row level security;
alter table public.session_logs enable row level security;
alter table public.set_logs enable row level security;
alter table public.run_logs enable row level security;
alter table public.exercise_preferences enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.group_invites enable row level security;

-- Every one of these tables gets the identical four policies keyed on user_id.
-- Generating them in a loop keeps them provably uniform: a table cannot be
-- added to the list and accidentally given a weaker rule.
do $$
declare
  t text;
  owned_tables text[] := array[
    'body_measurements',
    'questionnaire_answers',
    'plans',
    'planned_sessions',
    'session_logs',
    'set_logs',
    'run_logs',
    'exercise_preferences'
  ];
begin
  foreach t in array owned_tables loop
    execute format(
      'create policy %I on public.%I for select to authenticated using (auth.uid() = user_id)',
      t || '_select_own', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (auth.uid() = user_id)',
      t || '_insert_own', t);
    execute format(
      'create policy %I on public.%I for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)',
      t || '_update_own', t);
    execute format(
      'create policy %I on public.%I for delete to authenticated using (auth.uid() = user_id)',
      t || '_delete_own', t);
  end loop;
end;
$$;

-- profiles keys on user_id too, but has no delete policy: a profile goes away
-- only by deleting the account, which cascades from auth.users.
create policy profiles_select_own on public.profiles
  for select to authenticated using (auth.uid() = user_id);
create policy profiles_insert_own on public.profiles
  for insert to authenticated with check (auth.uid() = user_id);
create policy profiles_update_own on public.profiles
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ------------------------------------------------------------- groups --

create policy groups_select_member on public.groups
  for select to authenticated
  using (public.is_group_member(id, auth.uid()));

create policy groups_insert_own on public.groups
  for insert to authenticated
  with check (auth.uid() = owner_id);

create policy groups_update_owner on public.groups
  for update to authenticated
  using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy groups_delete_owner on public.groups
  for delete to authenticated
  using (auth.uid() = owner_id);

-- Members see who else is in the group. That is the membership row only —
-- names come from the summary RPC, which is the single window onto profiles.
create policy group_members_select_member on public.group_members
  for select to authenticated
  using (public.is_group_member(group_id, auth.uid()));

create policy group_members_insert_self on public.group_members
  for insert to authenticated
  with check (auth.uid() = user_id);

create policy group_members_update_self on public.group_members
  for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Leave a group yourself, or be removed by the owner (PLAN.md §1).
create policy group_members_delete_self_or_owner on public.group_members
  for delete to authenticated
  using (auth.uid() = user_id or public.is_group_owner(group_id, auth.uid()));

create policy group_invites_select_member on public.group_invites
  for select to authenticated
  using (public.is_group_member(group_id, auth.uid()));

create policy group_invites_insert_owner on public.group_invites
  for insert to authenticated
  with check (public.is_group_owner(group_id, auth.uid()) and auth.uid() = created_by);

create policy group_invites_delete_owner on public.group_invites
  for delete to authenticated
  using (public.is_group_owner(group_id, auth.uid()));
