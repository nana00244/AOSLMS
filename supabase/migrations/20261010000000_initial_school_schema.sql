create extension if not exists pgcrypto with schema extensions;

create type public.app_role as enum ('Administrator', 'Teacher', 'Student', 'Accountant');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role public.app_role not null default 'Student',
  active boolean not null default true,
  student_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.school_classes (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table public.students (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  class_id uuid references public.school_classes(id) on delete set null,
  gender text,
  date_of_birth date,
  guardian_name text,
  guardian_phone text,
  status text not null default 'Active' check (status in ('Active', 'Inactive', 'Graduated')),
  enrolled_on date,
  photo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles add constraint profiles_student_fk foreign key (student_id) references public.students(id) on delete set null;

create table public.teacher_class_assignments (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  class_id uuid not null references public.school_classes(id) on delete cascade,
  subject text,
  is_class_teacher boolean not null default false,
  created_at timestamptz not null default now(),
  unique (teacher_id, class_id, subject)
);

create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  attendance_date date not null,
  status text not null check (status in ('Present', 'Late', 'Absent', 'Excused')),
  recorded_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (student_id, attendance_date)
);

create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subject text not null,
  class_id uuid not null references public.school_classes(id),
  points numeric(7,2) not null default 0 check (points >= 0),
  due_at timestamptz,
  description text not null default '',
  category text not null default 'Homework',
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  body text not null default '',
  link text,
  submitted_at timestamptz not null default now(),
  score numeric(7,2),
  feedback text,
  unique (assignment_id, student_id)
);

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id),
  title text not null,
  body text not null,
  class_id uuid references public.school_classes(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity text,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.current_app_role()
returns public.app_role language sql stable security definer set search_path = '' as $$
  select role from public.profiles where id = (select auth.uid()) and active
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(public.current_app_role() = 'Administrator'::public.app_role, false)
$$;

create or replace function public.teaches_class(target_class_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.teacher_class_assignments a
    where a.teacher_id = (select auth.uid()) and a.class_id = target_class_id
  )
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)), 'Student');
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.school_classes enable row level security;
alter table public.students enable row level security;
alter table public.teacher_class_assignments enable row level security;
alter table public.attendance enable row level security;
alter table public.assignments enable row level security;
alter table public.submissions enable row level security;
alter table public.announcements enable row level security;
alter table public.audit_log enable row level security;

create policy "profiles visible to self or admin" on public.profiles for select to authenticated using (id = (select auth.uid()) or public.is_admin());
create policy "admins manage profiles" on public.profiles for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "authenticated users read classes" on public.school_classes for select to authenticated using (true);
create policy "admins manage classes" on public.school_classes for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "students read assigned class, own record, or admin" on public.students for select to authenticated using (public.is_admin() or id = (select student_id from public.profiles where id = (select auth.uid())) or (class_id is not null and public.teaches_class(class_id)));
create policy "admins manage students" on public.students for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "assignment records readable by signed-in users" on public.teacher_class_assignments for select to authenticated using (public.is_admin() or teacher_id = (select auth.uid()));
create policy "admins manage teacher assignments" on public.teacher_class_assignments for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins and assigned teachers read attendance" on public.attendance for select to authenticated using (public.is_admin() or student_id = (select student_id from public.profiles where id = (select auth.uid())) or exists (select 1 from public.students s where s.id = student_id and s.class_id is not null and public.teaches_class(s.class_id)));
create policy "admins and assigned teachers record attendance" on public.attendance for insert to authenticated with check (public.is_admin() or (recorded_by = (select auth.uid()) and exists (select 1 from public.students s where s.id = student_id and s.class_id is not null and public.teaches_class(s.class_id))));
create policy "admins and assigned teachers update attendance" on public.attendance for update to authenticated using (public.is_admin() or exists (select 1 from public.students s where s.id = student_id and s.class_id is not null and public.teaches_class(s.class_id))) with check (public.is_admin() or exists (select 1 from public.students s where s.id = student_id and s.class_id is not null and public.teaches_class(s.class_id)));
create policy "users read assigned class assignments" on public.assignments for select to authenticated using (public.is_admin() or public.teaches_class(class_id) or exists (select 1 from public.profiles p join public.students s on s.id = p.student_id where p.id = (select auth.uid()) and s.class_id = assignments.class_id));
create policy "admins and assigned teachers create assignments" on public.assignments for insert to authenticated with check (public.is_admin() or (created_by = (select auth.uid()) and public.teaches_class(class_id)));
create policy "admins and assigned teachers manage assignments" on public.assignments for update to authenticated using (public.is_admin() or (created_by = (select auth.uid()) and public.teaches_class(class_id))) with check (public.is_admin() or (created_by = (select auth.uid()) and public.teaches_class(class_id)));
create policy "users read own or assigned class submissions" on public.submissions for select to authenticated using (public.is_admin() or student_id = (select student_id from public.profiles where id = (select auth.uid())) or exists (select 1 from public.assignments a join public.students s on s.id = submissions.student_id where a.id = submissions.assignment_id and s.class_id = a.class_id and public.teaches_class(a.class_id)));
create policy "students submit for own record" on public.submissions for insert to authenticated with check (student_id = (select student_id from public.profiles where id = (select auth.uid())));
create policy "students edit own submissions and assigned staff grade" on public.submissions for update to authenticated using (student_id = (select student_id from public.profiles where id = (select auth.uid())) or public.is_admin() or exists (select 1 from public.assignments a join public.students s on s.id = submissions.student_id where a.id = submissions.assignment_id and s.class_id = a.class_id and public.teaches_class(a.class_id))) with check (student_id = (select student_id from public.profiles where id = (select auth.uid())) or public.is_admin() or exists (select 1 from public.assignments a join public.students s on s.id = submissions.student_id where a.id = submissions.assignment_id and s.class_id = a.class_id and public.teaches_class(a.class_id)));
create policy "announcements visible to target class" on public.announcements for select to authenticated using (public.is_admin() or class_id is null or public.teaches_class(class_id) or exists (select 1 from public.profiles p join public.students s on s.id = p.student_id where p.id = (select auth.uid()) and s.class_id = announcements.class_id));
create policy "admins and assigned teachers create announcements" on public.announcements for insert to authenticated with check (author_id = (select auth.uid()) and (public.is_admin() or ((select public.current_app_role()) = 'Teacher' and (class_id is null or public.teaches_class(class_id)))));
create policy "admins and assigned teachers update announcements" on public.announcements for update to authenticated using (public.is_admin() or (author_id = (select auth.uid()) and ((class_id is null) or public.teaches_class(class_id)))) with check (public.is_admin() or (author_id = (select auth.uid()) and ((class_id is null) or public.teaches_class(class_id))));
create policy "admins read audit log" on public.audit_log for select to authenticated using (public.is_admin());
create policy "authenticated users record audit events" on public.audit_log for insert to authenticated with check (actor_id = (select auth.uid()));

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.profiles, public.school_classes, public.students, public.teacher_class_assignments, public.attendance, public.assignments, public.submissions, public.announcements, public.audit_log to authenticated;
grant usage, select on sequence public.audit_log_id_seq to authenticated;
