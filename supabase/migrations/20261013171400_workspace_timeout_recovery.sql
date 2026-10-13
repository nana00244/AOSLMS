-- One consistent snapshot per load, with a cheap revision-only polling path.
-- Only the Edge API service role can read this private document. Browser users
-- continue to receive the role-scoped projection produced by the workspace API.
create function public.read_workspace_snapshot(known_revision bigint default null)
returns jsonb language sql stable security invoker
set search_path = '' set statement_timeout = '20s' as $$
  select case when w.revision = known_revision then
    jsonb_build_object('unchanged', true, 'revision', w.revision)
  else jsonb_build_object(
    'revision', w.revision,
    'document', w.document,
    'profiles', (select coalesce(jsonb_agg(to_jsonb(p)), '[]'::jsonb) from public.profiles p)
  ) end
  from public.school_workspace w where w.id;
$$;
revoke all on function public.read_workspace_snapshot(bigint) from public, anon, authenticated;
grant execute on function public.read_workspace_snapshot(bigint) to service_role;

-- Bound lock waits separately from real work. A busy writer should return a
-- retryable error, while a legitimate large document gets a finite work budget.
alter function public.commit_workspace(bigint,jsonb,uuid,text)
  set statement_timeout = '20s';
alter function public.commit_workspace(bigint,jsonb,uuid,text)
  set lock_timeout = '3s';
alter function public.commit_workspace_once(bigint,jsonb,uuid,text,uuid)
  set statement_timeout = '20s';
alter function public.commit_workspace_once(bigint,jsonb,uuid,text,uuid)
  set lock_timeout = '3s';
notify pgrst, 'reload schema';
