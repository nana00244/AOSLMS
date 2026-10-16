-- Serialize each stored record once instead of rebuilding large nested JSONB
-- objects repeatedly. Keep one MVCC statement for revision, records and profiles.
create function public.read_workspace_snapshot_json(known_revision bigint default null)
returns json language sql stable security invoker
set search_path='' set statement_timeout='20s' set work_mem='32MB' as $$
 select case when h.revision=known_revision then
   json_build_object('unchanged',true,'revision',h.revision)
 else json_build_object('revision',h.revision,
   'document',(select coalesce(json_object_agg(root.key,case jsonb_typeof(root.value)
     when 'array' then (select coalesce(json_agg(e.value order by e.ordinal),'[]'::json)
       from public.workspace_entries e where e.section=root.key)
     when 'object' then (select coalesce(json_object_agg(substr(e.entry_key,3),e.value),'{}'::json)
       from public.workspace_entries e where e.section=root.key)
     else root.value::json end),'{}'::json) from jsonb_each(h.document) root),
   'profiles',(select coalesce(json_agg(p),'[]'::json) from public.profiles p)) end
 from public.workspace_head h where h.id;
$$;
revoke all on function public.read_workspace_snapshot_json(bigint) from public,anon,authenticated;
grant execute on function public.read_workspace_snapshot_json(bigint) to service_role;
notify pgrst,'reload schema';
