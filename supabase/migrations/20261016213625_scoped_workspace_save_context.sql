create function public.read_workspace_save_context(changes jsonb) returns jsonb
language sql stable security invoker set search_path='' set statement_timeout='10s' as $$
 select jsonb_build_object('revision',h.revision,
  'profiles',(select coalesce(jsonb_agg(to_jsonb(p)),'[]') from public.profiles p),
  'document',jsonb_build_object(
   'students',(select coalesce(jsonb_agg(e.value-'photo' order by e.ordinal),'[]') from public.workspace_entries e where section='students'),
   'settings',(select coalesce(jsonb_object_agg(substr(entry_key,3),value),'{}') from public.workspace_entries where section='settings'),
   'classes',(select coalesce(jsonb_agg(value order by ordinal),'[]') from public.workspace_entries where section='classes'))
   || coalesce((select jsonb_object_agg(collection,items) from (
     select collection,jsonb_object_agg(id,e.value) filter(where e.entry_key is not null) items
     from (select distinct c->>'collection' collection,c->>'id' id from jsonb_array_elements(changes) c
       where c->>'collection'=any(array['attendance','grades','remarks','conduct','fees','studentConcessions','studentBills'])) requested
     left join public.workspace_entries e on e.section=requested.collection and e.entry_key='o:'||requested.id
     group by collection) grouped),'{}'))
 from public.workspace_head h where h.id;
$$;
revoke all on function public.read_workspace_save_context(jsonb) from public,anon,authenticated;
grant execute on function public.read_workspace_save_context(jsonb) to service_role;
notify pgrst,'reload schema';
