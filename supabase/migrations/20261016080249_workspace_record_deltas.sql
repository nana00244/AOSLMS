-- Only the authenticated Edge Function can submit these validated record deltas.
-- Preserve the revision lock, profile side effects, receipts and realtime trigger.
create function public.commit_workspace_delta(
 expected_revision bigint, delta jsonb, actor uuid, event text, operation_id uuid default null
) returns jsonb language plpgsql security invoker set search_path=''
set lock_timeout='3s' set statement_timeout='20s' as $$
declare result bigint; actor_role public.app_role; member jsonb;
begin
 select role into actor_role from public.profiles where id=actor and active;
 if actor_role is null then raise exception 'Account is inactive'; end if;
 if jsonb_typeof(delta->'upserts') is distinct from 'array'
   or jsonb_typeof(delta->'removals') is distinct from 'array'
   or jsonb_typeof(delta->'structure') is distinct from 'object' then
   raise exception 'Invalid record delta';
 end if;
 select revision into result from public.workspace_head where id for update;
 if operation_id is not null and exists(select 1 from public.workspace_save_receipts r
   where r.actor=commit_workspace_delta.actor and r.operation_id=commit_workspace_delta.operation_id) then
   return jsonb_build_object('revision',result,'alreadyApplied',true);
 end if;
 if result is distinct from expected_revision then
   raise exception 'Conflict: records changed. Reload and try again.' using errcode='40001';
 end if;
 delete from public.workspace_entries e using jsonb_to_recordset(delta->'removals') r(section text,entry_key text)
   where e.section=r.section and e.entry_key=r.entry_key;
 insert into public.workspace_entries as existing(section,entry_key,ordinal,value)
 select r.section,r.entry_key,r.ordinal,coalesce(r.value,'null'::jsonb)
 from jsonb_to_recordset(delta->'upserts') r(section text,entry_key text,ordinal bigint,value jsonb)
 on conflict(section,entry_key) do update set ordinal=excluded.ordinal,
   value=case when existing.value=excluded.value then existing.value else excluded.value end
 where existing.ordinal is distinct from excluded.ordinal or existing.value is distinct from excluded.value;
 update public.workspace_head set document=delta->'structure',revision=revision+1,updated_at=now() where id;
 if actor_role='Administrator' then
   if jsonb_typeof(delta->'profiles')='array' then
     for member in select value from jsonb_array_elements(delta->'profiles') loop
       update public.profiles set classes=member->'classes',class_allowed_subjects=coalesce(member->'classAllowedSubjects','{}')
       where id=(member->>'id')::uuid and (classes is distinct from member->'classes'
         or class_allowed_subjects is distinct from coalesce(member->'classAllowedSubjects','{}'));
     end loop;
   end if;
   if jsonb_typeof(delta->'studentIds')='array' then
     update public.profiles p set active=false,student_id=null
       where p.student_id is not null and not (delta->'studentIds' ? p.student_id);
   end if;
 end if;
 select revision into result from public.workspace_head where id;
 if operation_id is not null then
   insert into public.workspace_save_receipts(actor,operation_id,revision) values(actor,operation_id,result);
 end if;
 insert into public.audit_log(actor_id,action,entity) values(actor,left(event,1000),'workspace');
 return jsonb_build_object('revision',result,'alreadyApplied',false);
end;
$$;
revoke all on function public.commit_workspace_delta(bigint,jsonb,uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.commit_workspace_delta(bigint,jsonb,uuid,text,uuid) to service_role;
notify pgrst,'reload schema';

