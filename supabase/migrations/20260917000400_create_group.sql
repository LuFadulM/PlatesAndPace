-- Creating a group has to insert three rows — the group, the owner's
-- membership and the first invite — and read the new id back. Done as plain
-- inserts from the client, the read-back fails: Postgres filters RETURNING
-- through the SELECT policy, and the creator is not a member yet at that
-- instant. One SECURITY DEFINER function does all three atomically.

create or replace function public.create_group(p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_group_id uuid;
  v_code text;
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- no 0/O/1/I
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_name is null or length(trim(p_name)) not between 1 and 60 then
    raise exception 'group name must be 1–60 characters' using errcode = '22023';
  end if;

  insert into public.groups (name, owner_id)
  values (trim(p_name), v_uid)
  returning id into v_group_id;

  insert into public.group_members (group_id, user_id, role)
  values (v_group_id, v_uid, 'owner');

  -- Six characters from an unambiguous alphabet; retry on the rare collision.
  loop
    v_code := (
      select string_agg(substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1), '')
      from generate_series(1, 6)
    );
    begin
      insert into public.group_invites (group_id, code, created_by)
      values (v_group_id, v_code, v_uid);
      exit;
    exception when unique_violation then
      -- try another code
    end;
  end loop;

  return v_group_id;
end;
$$;

revoke execute on function public.create_group(text) from public;
grant execute on function public.create_group(text) to authenticated;
