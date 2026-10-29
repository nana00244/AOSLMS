-- Learning Hub writes are authorized and scored by the learning-hub Edge Function.
-- Browser roles have no direct access, including to answer keys.
create table public.learning_hub_lessons (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references auth.users(id) on delete set null,
  document jsonb not null check (jsonb_typeof(document) = 'object'),
  created_at timestamptz not null default now()
);
create table public.learning_hub_assignments (
  id uuid primary key default gen_random_uuid(),
  lesson_id text not null,
  class_id text not null,
  student_ids text[] not null check (cardinality(student_ids) > 0),
  due_date date not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create table public.learning_hub_attempts (
  id uuid primary key default gen_random_uuid(),
  lesson_id text not null,
  student_id text not null,
  assignment_id uuid references public.learning_hub_assignments(id) on delete cascade,
  score integer not null check (score between 0 and 100),
  correct integer not null check (correct >= 0),
  total integer not null check (total > 0 and correct <= total),
  created_at timestamptz not null default now()
);
create table public.learning_hub_readings (
  id uuid primary key default gen_random_uuid(),
  lesson_id text not null,
  student_id text not null,
  assignment_id uuid references public.learning_hub_assignments(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique nulls not distinct (student_id, lesson_id, assignment_id)
);
create index learning_hub_assignment_class_idx on public.learning_hub_assignments(class_id);
create index learning_hub_assignment_student_idx on public.learning_hub_assignments using gin(student_ids);
create index learning_hub_attempt_student_idx on public.learning_hub_attempts(student_id, created_at);
create index learning_hub_attempt_assignment_idx on public.learning_hub_attempts(assignment_id);
create index learning_hub_reading_assignment_idx on public.learning_hub_readings(assignment_id);
create index learning_hub_lesson_creator_idx on public.learning_hub_lessons(created_by);
create index learning_hub_assignment_creator_idx on public.learning_hub_assignments(created_by);
alter table public.learning_hub_lessons enable row level security;
alter table public.learning_hub_assignments enable row level security;
alter table public.learning_hub_attempts enable row level security;
alter table public.learning_hub_readings enable row level security;
revoke all on public.learning_hub_lessons, public.learning_hub_assignments,
  public.learning_hub_attempts, public.learning_hub_readings from public, anon, authenticated;
grant all on public.learning_hub_lessons, public.learning_hub_assignments,
  public.learning_hub_attempts, public.learning_hub_readings to service_role;
