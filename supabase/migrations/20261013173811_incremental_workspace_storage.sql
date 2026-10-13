-- Keep the service API document shape, but never rewrite all photos for a small edit.
-- The migration is transactional; reconstruction must equal the original before
-- replacing the original document with its small structural skeleton.
set local lock_timeout = '3s';
lock table public.school_workspace in access exclusive mode;
alter table public.school_workspace rename to workspace_head;

create table public.workspace_entries (
  section text not null,
  entry_key text not null,
  ordinal bigint not null,
  value jsonb not null,
  primary key (section, entry_key)
);
alter table public.workspace_entries enable row level security;
revoke all on public.workspace_entries from public, anon, authenticated;
grant all on public.workspace_entries to service_role;

create function public.workspace_structure(document jsonb) returns jsonb
language sql immutable security invoker set search_path = '' as $$
  select coalesce(jsonb_object_agg(key, case jsonb_typeof(value)
    when 'array' then '[]'::jsonb when 'object' then '{}'::jsonb else value end), '{}'::jsonb)
  from jsonb_each(document);
$$;

create function public.split_workspace(document jsonb)
returns table(section text, entry_key text, ordinal bigint, value jsonb)
language sql immutable security invoker set search_path = '' as $$
  select root.key, 'o:' || item.key, 0::bigint, item.value
  from jsonb_each(document) root
  cross join lateral jsonb_each(case when jsonb_typeof(root.value)='object'
    then root.value else '{}'::jsonb end) item
  union all
  select root.key,
    case when jsonb_typeof(item.value)='object' and item.value->>'id' is not null
      then 'i:' || (item.value->>'id') || ':' ||
        row_number() over (partition by root.key, item.value->>'id' order by item.ordinality)::text
      else 'p:' || item.ordinality::text end,
    item.ordinality, item.value
  from jsonb_each(document) root
  cross join lateral jsonb_array_elements(case when jsonb_typeof(root.value)='array'
    then root.value else '[]'::jsonb end) with ordinality item(value, ordinality);
$$;
revoke all on function public.workspace_structure(jsonb), public.split_workspace(jsonb) from public, anon, authenticated;
grant execute on function public.workspace_structure(jsonb), public.split_workspace(jsonb) to service_role;

insert into public.workspace_entries
select parts.* from public.workspace_head h cross join lateral public.split_workspace(h.document) parts;

create view public.school_workspace with (security_invoker = true) as
select h.id, h.revision,
  (select coalesce(jsonb_object_agg(root.key, case jsonb_typeof(root.value)
    when 'array' then (select coalesce(jsonb_agg(e.value order by e.ordinal), '[]'::jsonb)
      from public.workspace_entries e where e.section=root.key)
    when 'object' then (select coalesce(jsonb_object_agg(substr(e.entry_key,3),e.value), '{}'::jsonb)
      from public.workspace_entries e where e.section=root.key)
    else root.value end), '{}'::jsonb) from jsonb_each(h.document) root) as document,
  h.updated_at
from public.workspace_head h;
revoke all on public.school_workspace from public, anon, authenticated;
grant select on public.school_workspace to service_role;

do $$
begin
  if exists(select 1 from public.workspace_head h join public.school_workspace w using(id)
    where h.document is distinct from w.document) then
    raise exception 'Workspace reconstruction mismatch; migration aborted';
  end if;
end;
$$;
update public.workspace_head set document=public.workspace_structure(document);

create or replace function private.profile_changed() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.workspace_head set revision=revision+1, updated_at=now() where id;
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.commit_workspace(expected_revision bigint, replacement jsonb, actor uuid, event text)
returns bigint language plpgsql security invoker set search_path = ''
set statement_timeout='20s' set lock_timeout='3s' as $$
declare result bigint; actor_role public.app_role; member jsonb; next_document jsonb;
begin
  select role into actor_role from public.profiles where id=actor and active;
  if actor_role is null then raise exception 'Account is inactive'; end if;
  -- Serialize all record changes and the revision, preserving the existing CAS contract.
  select revision into result from public.workspace_head where id for update;
  if result is distinct from expected_revision then
    raise exception 'Conflict: records changed. Reload and try again.' using errcode='40001';
  end if;
  next_document := replacement - 'users' - 'teacherAssignments';
  if next_document is null or jsonb_typeof(next_document) <> 'object' then
    raise exception 'Invalid workspace document';
  end if;
  with incoming as materialized (select * from public.split_workspace(next_document)),
  removed as (
    delete from public.workspace_entries e where not exists (
      select 1 from incoming i where i.section=e.section and i.entry_key=e.entry_key)
  )
  insert into public.workspace_entries as existing(section,entry_key,ordinal,value)
  select i.section,i.entry_key,i.ordinal,i.value from incoming i
  left join public.workspace_entries e using(section,entry_key)
  where e.section is null or e.ordinal is distinct from i.ordinal or e.value is distinct from i.value
  on conflict(section,entry_key) do update set ordinal=excluded.ordinal,
    -- Reordering records must reuse unchanged TOAST values rather than rewrite photos.
    value=case when existing.value=excluded.value then existing.value else excluded.value end;
  update public.workspace_head set document=public.workspace_structure(next_document),
    revision=revision+1,updated_at=now() where id;
  if actor_role='Administrator' then
    for member in select value from jsonb_array_elements(coalesce(replacement->'users','[]')) loop
      update public.profiles set classes=member->'classes',
        class_allowed_subjects=coalesce(member->'classAllowedSubjects','{}')
      where id=(member->>'id')::uuid and (classes is distinct from member->'classes'
        or class_allowed_subjects is distinct from coalesce(member->'classAllowedSubjects','{}'));
    end loop;
    update public.profiles p set active=false,student_id=null
      where p.student_id is not null and not exists (
        select 1 from jsonb_array_elements(replacement->'students') s where s->>'id'=p.student_id);
  end if;
  insert into public.audit_log(actor_id,action,entity) values(actor,left(event,1000),'workspace');
  select revision into result from public.workspace_head where id;
  return result;
end;
$$;

create or replace function public.commit_workspace_once(expected_revision bigint, replacement jsonb, actor uuid, event text, operation_id uuid)
returns bigint language plpgsql security invoker set search_path = ''
set statement_timeout='20s' set lock_timeout='3s' as $$
declare result bigint;
begin
  perform 1 from public.workspace_head where id for update;
  select r.revision into result from public.workspace_save_receipts r
    where r.actor=commit_workspace_once.actor and r.operation_id=commit_workspace_once.operation_id;
  if result is not null then return result; end if;
  result := public.commit_workspace(expected_revision,replacement,actor,event);
  insert into public.workspace_save_receipts(actor,operation_id,revision) values(actor,operation_id,result);
  return result;
end;
$$;

-- One SQL statement keeps revision, records and profiles in the same MVCC snapshot.
create or replace function public.read_workspace_snapshot(known_revision bigint default null)
returns jsonb language sql stable security invoker
set search_path='' set statement_timeout='20s' as $$
  select case when h.revision=known_revision then
    jsonb_build_object('unchanged',true,'revision',h.revision)
  else jsonb_build_object('revision',h.revision,
    'document',(select w.document from public.school_workspace w where w.id=h.id),
    'profiles',(select coalesce(jsonb_agg(to_jsonb(p)),'[]'::jsonb) from public.profiles p)) end
  from public.workspace_head h where h.id;
$$;
-- Existing function ACLs survive CREATE OR REPLACE; make the private boundary explicit.
revoke all on public.workspace_head from public, anon, authenticated;
revoke all on function public.commit_workspace(bigint,jsonb,uuid,text),
  public.commit_workspace_once(bigint,jsonb,uuid,text,uuid), public.read_workspace_snapshot(bigint)
  from public, anon, authenticated;
grant execute on function public.commit_workspace(bigint,jsonb,uuid,text),
  public.commit_workspace_once(bigint,jsonb,uuid,text,uuid), public.read_workspace_snapshot(bigint)
  to service_role;
notify pgrst, 'reload schema';


