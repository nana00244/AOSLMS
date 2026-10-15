-- Authorized map edits only. The Edge Function performs field-level authorization,
-- three-way merging and schema validation before invoking this service-only RPC.
-- Keep the global revision lock for CAS, but never split/compare untouched photos.
create function public.commit_workspace_maps_once(
  expected_revision bigint, changes jsonb, actor uuid, operations jsonb
) returns jsonb language plpgsql security invoker set search_path=''
set lock_timeout='3s' set statement_timeout='20s' as $$
declare result bigint; change jsonb; op jsonb; seen integer; total integer;
begin
  if jsonb_typeof(changes) is distinct from 'array' or jsonb_array_length(changes)>10000
    or jsonb_typeof(operations) is distinct from 'array'
    or jsonb_array_length(operations) not between 1 and 10 then
    raise exception 'Invalid targeted save';
  end if;
  total := jsonb_array_length(operations);
  if (select count(distinct (o->>'id')::uuid) from jsonb_array_elements(operations) o)<>total then
    raise exception 'Invalid save identifiers';
  end if;
  if not exists(select 1 from public.profiles where id=actor and active) then
    raise exception 'Account is inactive';
  end if;
  select revision into result from public.workspace_head where id for update;
  select count(*) into seen from public.workspace_save_receipts r
    where r.actor=commit_workspace_maps_once.actor
    and r.operation_id in (select (o->>'id')::uuid from jsonb_array_elements(operations) o);
  if seen=total then return jsonb_build_object('revision',result,'alreadyApplied',true); end if;
  if seen<>0 or result is distinct from expected_revision then
    raise exception 'Conflict: records changed. Reload and try again.' using errcode='40001';
  end if;
  for change in select value from jsonb_array_elements(changes) loop
    if not coalesce(change->>'collection'=any(array['attendance','grades','remarks','conduct','fees','studentConcessions','studentBills']),false)
      or jsonb_typeof(change->'id') is distinct from 'string' then
      raise exception 'Invalid targeted collection';
    end if;
    if change ? 'after' then
      insert into public.workspace_entries as existing(section,entry_key,ordinal,value)
      values(change->>'collection','o:'||(change->>'id'),0,change->'after')
      on conflict(section,entry_key) do update set value=excluded.value
      where existing.value is distinct from excluded.value;
    else
      delete from public.workspace_entries
      where section=change->>'collection' and entry_key='o:'||(change->>'id');
    end if;
  end loop;
  update public.workspace_head set revision=revision+1,updated_at=now(),
    document=document || coalesce((select jsonb_object_agg(c->>'collection','{}'::jsonb)
      from jsonb_array_elements(changes) c),'{}'::jsonb)
    where id returning revision into result;
  for op in select value from jsonb_array_elements(operations) loop
    insert into public.workspace_save_receipts(actor,operation_id,revision)
      values(actor,(op->>'id')::uuid,result);
    insert into public.audit_log(actor_id,action,entity)
      values(actor,left(coalesce(op->>'event','School records updated'),1000),'workspace');
  end loop;
  return jsonb_build_object('revision',result,'alreadyApplied',false);
end;
$$;
revoke all on function public.commit_workspace_maps_once(bigint,jsonb,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.commit_workspace_maps_once(bigint,jsonb,uuid,jsonb) to service_role;
notify pgrst,'reload schema';
