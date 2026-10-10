-- The app's rich academic model is persisted as a versioned document. Only the
-- authenticated Edge API can access it; clients receive a role-scoped projection.
-- The starter relational tables are retained, but are no longer exposed to clients.
revoke all on public.school_classes, public.students, public.teacher_class_assignments,
  public.attendance, public.assignments, public.submissions, public.announcements,
  public.audit_log from anon, authenticated;
revoke insert, update, delete on public.profiles from anon, authenticated;
revoke all on function public.current_app_role(), public.is_admin(), public.teaches_class(uuid),
  public.handle_new_user() from public, anon;
grant execute on function public.current_app_role(), public.is_admin() to authenticated;

do $$ declare policy record;
begin
  for policy in select tablename, policyname from pg_policies where schemaname = 'public' and tablename <> 'profiles'
  loop execute format('drop policy %I on public.%I', policy.policyname, policy.tablename); end loop;
end $$;

alter table public.profiles drop constraint profiles_student_fk;
alter table public.profiles alter column student_id type text using student_id::text;
alter table public.profiles add column email text not null default '';
alter table public.profiles add column classes jsonb not null default '[]';
alter table public.profiles add column class_allowed_subjects jsonb not null default '{}';
alter table public.profiles alter column active set default false;
create unique index profiles_student_account on public.profiles(student_id) where student_id is not null;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id, full_name, email, role, active)
  values(new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)), new.email, 'Student', false);
  return new;
end;
$$;
revoke all on function public.handle_new_user() from public, anon, authenticated;

create table public.school_workspace (
  id boolean primary key default true check(id),
  revision bigint not null default 0,
  document jsonb not null check(jsonb_typeof(document) = 'object'),
  updated_at timestamptz not null default now()
);
alter table public.school_workspace enable row level security;
revoke all on public.school_workspace from public, anon, authenticated;
grant all on public.school_workspace to service_role;
insert into public.school_workspace(document) values ('{
  "version":1,"classes":[],"students":[],"assignments":[],"submissions":[],"attendance":{},
  "grades":{},"remarks":{},"conduct":{},"verified":[],"resources":[],"periods":[],"payments":[],
  "expenses":[],"payroll":[],"fees":{},"studentConcessions":{},"users":[],"teacherAssignments":[],
  "certificates":[],"messages":[],"logs":[],
  "settings":{"name":"Ayisatu Owen Schools","motto":"","address":"","phone":"","email":"",
  "year":"2026/2027","term":1,"vacation":"","reopening":""}
}');

-- Account changes also invalidate workspace snapshots, preventing stale permissions
-- from winning a race with an administrator revoking access.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;
alter function public.current_app_role() set schema private;
alter function public.is_admin() set schema private;
alter function public.teaches_class(uuid) set schema private;
create or replace function private.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and coalesce(private.current_app_role() = 'Administrator'::public.app_role, false)
$$;
revoke all on function private.teaches_class(uuid) from public, anon, authenticated;
create function private.profile_changed() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.school_workspace set revision = revision + 1, updated_at = now() where id;
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function private.profile_changed() from public, anon, authenticated;
create trigger profile_revision before insert or update on public.profiles
for each row execute function private.profile_changed();

-- Service-only compare-and-swap: a stale save fails atomically instead of losing data.
create function public.commit_workspace(expected_revision bigint, replacement jsonb, actor uuid, event text)
returns bigint language plpgsql security invoker set search_path = '' as $$
declare result bigint;
begin
  if not exists(select 1 from public.profiles where id = actor and active) then
    raise exception 'Account is inactive';
  end if;
  update public.school_workspace set document = replacement - 'users' - 'teacherAssignments',
    revision = revision + 1, updated_at = now()
    where id and revision = expected_revision returning revision into result;
  if result is null then raise exception 'Conflict: records changed. Reload and try again.' using errcode='40001'; end if;
  insert into public.audit_log(actor_id, action, entity) values(actor, left(event, 1000), 'workspace');
  return result;
end;
$$;
revoke all on function public.commit_workspace(bigint,jsonb,uuid,text) from public, anon, authenticated;
grant execute on function public.commit_workspace(bigint,jsonb,uuid,text) to service_role;
create index audit_log_actor_idx on public.audit_log(actor_id);
create index audit_log_created_idx on public.audit_log(created_at desc);
create index profiles_student_idx on public.profiles(student_id);
create index students_class_idx on public.students(class_id);
create index teacher_assignments_class_idx on public.teacher_class_assignments(class_id);
create index assignments_class_idx on public.assignments(class_id);
create index assignments_author_idx on public.assignments(created_by);
create index attendance_author_idx on public.attendance(recorded_by);
create index submissions_student_idx on public.submissions(student_id);
create index announcements_author_idx on public.announcements(author_id);
create index announcements_class_idx on public.announcements(class_id);
