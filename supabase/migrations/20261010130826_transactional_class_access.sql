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
  end if;
  insert into public.audit_log(actor_id, action, entity) values(actor, left(event,1000), 'workspace');
  select revision into result from public.school_workspace where id;
  return result;
end;
$$;
revoke all on function public.commit_workspace(bigint,jsonb,uuid,text) from public, anon, authenticated;
grant execute on function public.commit_workspace(bigint,jsonb,uuid,text) to service_role;
drop policy "admins manage profiles" on public.profiles;
