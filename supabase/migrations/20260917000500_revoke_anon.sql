-- On a hosted Supabase project, default privileges grant EXECUTE on every new
-- function in `public` to anon, authenticated and service_role directly. The
-- earlier `revoke ... from public` therefore left anon able to call each RPC.
-- Every RPC guards on auth.uid(), so an anonymous call fails, but the two
-- membership helpers and training_streak have no such guard and would let an
-- anonymous caller probe by user id. Revoke from anon explicitly.

revoke execute on function public.is_group_member(uuid, uuid) from anon;
revoke execute on function public.is_group_owner(uuid, uuid) from anon;
revoke execute on function public.training_streak(uuid) from anon;
revoke execute on function public.group_weekly_summary(uuid) from anon;
revoke execute on function public.join_group_with_code(text) from anon;
revoke execute on function public.export_my_data() from anon;
revoke execute on function public.delete_my_account() from anon;
revoke execute on function public.create_group(text) from anon;
revoke execute on function public.touch_updated_at() from anon;
-- touch_updated_at was never revoked from PUBLIC, which is where anon's access
-- actually came from. Keep it for authenticated, whose updates fire the trigger.
revoke execute on function public.touch_updated_at() from public;
grant execute on function public.touch_updated_at() to authenticated;

-- training_streak is only ever called from inside group_weekly_summary, which
-- runs as the function owner, so no client role needs it at all.
revoke execute on function public.training_streak(uuid) from authenticated;

-- The linter also flags touch_updated_at for a role-mutable search_path. It
-- references nothing by name, but pinning it costs nothing.
alter function public.touch_updated_at() set search_path = '';
