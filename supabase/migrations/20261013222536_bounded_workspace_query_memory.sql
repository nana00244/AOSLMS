-- The ~7 MB current document exceeds the project's ~2 MB per-query default.
-- Scope additional sort/tuplestore memory to workspace work, never globally.
-- Writers are serialized on workspace_head before constructing the record diff.
alter function public.commit_workspace(bigint,jsonb,uuid,text) set work_mem='32MB';
alter function public.split_workspace(jsonb) set work_mem='32MB';
alter function public.read_workspace_snapshot(bigint) set work_mem='32MB';

-- Also bound compatibility readers (admin creation and report remarks), which
-- read the view directly rather than going through read_workspace_snapshot.
create function public.assemble_workspace(structure jsonb) returns jsonb
language sql stable security invoker set search_path='' set work_mem='32MB' as $$
  select coalesce(jsonb_object_agg(root.key, case jsonb_typeof(root.value)
    when 'array' then (select coalesce(jsonb_agg(e.value order by e.ordinal), '[]'::jsonb)
      from public.workspace_entries e where e.section=root.key)
    when 'object' then (select coalesce(jsonb_object_agg(substr(e.entry_key,3),e.value), '{}'::jsonb)
      from public.workspace_entries e where e.section=root.key)
    else root.value end), '{}'::jsonb) from jsonb_each(structure) root;
$$;
revoke all on function public.assemble_workspace(jsonb) from public,anon,authenticated;
grant execute on function public.assemble_workspace(jsonb) to service_role;
create or replace view public.school_workspace with (security_invoker=true) as
select id,revision,public.assemble_workspace(document) document,updated_at from public.workspace_head;
notify pgrst,'reload schema';
