-- Preserve existing current-year/term balances once; future enrollment never creates bills.
update public.school_workspace w set document = jsonb_set(document, '{studentBills}',
  coalesce((select jsonb_object_agg(
    (s->>'id') || '|' || (w.document#>>'{settings,year}') || '|' || (w.document#>>'{settings,term}'),
    jsonb_build_object('studentId',s->>'id','year',w.document#>>'{settings,year}',
      'term',(w.document#>>'{settings,term}')::int,
      'items',coalesce(w.document->'fees'->(s->>'classId'),'{}'::jsonb),
      'concession',coalesce(w.document->'studentConcessions'->(s->>'id'),'0'::jsonb),
      'updatedAt',now()))
    from jsonb_array_elements(w.document->'students') s),'{}'::jsonb)), revision=revision+1, updated_at=now()
  where not (document ? 'studentBills');

-- Stamp legacy receipts with the year they previously belonged to.
update public.school_workspace w set document=jsonb_set(document,'{payments}',
  coalesce((select jsonb_agg(case when p ? 'year' then p else p || jsonb_build_object('year',w.document#>>'{settings,year}') end)
  from jsonb_array_elements(w.document->'payments') p),'[]'::jsonb)),revision=revision+1,updated_at=now();

create or replace function public.commit_workspace(expected_revision bigint, replacement jsonb, actor uuid, event text)
returns bigint language plpgsql security invoker set search_path = '' as $$
declare result bigint; actor_role public.app_role; member jsonb;
begin
  select role into actor_role from public.profiles where id = actor and active;
  if actor_role is null then raise exception 'Account is inactive'; end if;
  update public.school_workspace set document = replacement - 'users' - 'teacherAssignments',
    revision = revision + 1, updated_at = now()
    where id and revision = expected_revision returning revision into result;
  if result is null then raise exception 'Conflict: records changed. Reload and try again.' using errcode='40001'; end if;
  if actor_role = 'Administrator' then
    for member in select value from jsonb_array_elements(coalesce(replacement->'users','[]')) loop
      update public.profiles set classes = member->'classes', class_allowed_subjects = coalesce(member->'classAllowedSubjects','{}')
        where id = (member->>'id')::uuid and
          (classes is distinct from member->'classes' or class_allowed_subjects is distinct from coalesce(member->'classAllowedSubjects','{}'));
    end loop;
    -- Check the live profile on every request: old JWTs cannot restore access after deletion.
    update public.profiles p set active=false, student_id=null
      where p.student_id is not null and not exists (
        select 1 from jsonb_array_elements(replacement->'students') s where s->>'id'=p.student_id);
  end if;
  insert into public.audit_log(actor_id, action, entity) values(actor, left(event,1000), 'workspace');
  select revision into result from public.school_workspace where id;
  return result;
end;
$$;
revoke all on function public.commit_workspace(bigint,jsonb,uuid,text) from public, anon, authenticated;
grant execute on function public.commit_workspace(bigint,jsonb,uuid,text) to service_role;

