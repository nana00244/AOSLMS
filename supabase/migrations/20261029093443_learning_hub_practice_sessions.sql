create table public.learning_hub_sessions (
  id uuid primary key,
  student_id text not null,
  lesson_id text not null,
  assignment_id uuid references public.learning_hub_assignments(id) on delete cascade,
  kind text not null check (kind in ('practice','quiz','unit-test')),
  questions jsonb not null check (jsonb_typeof(questions)='array'),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now()+interval '1 day'),
  submitted_at timestamptz
);
create index learning_hub_session_student_idx on public.learning_hub_sessions(student_id,created_at);
alter table public.learning_hub_sessions enable row level security;
revoke all on public.learning_hub_sessions from public,anon,authenticated;
grant all on public.learning_hub_sessions to service_role;
alter table public.learning_hub_attempts add column kind text not null default 'legacy'
  check (kind in ('legacy','practice','quiz','unit-test'));
alter table public.learning_hub_attempts add column question_results jsonb not null default '[]'::jsonb;

-- Service-only invoker RPC. One row lock makes retries/concurrent submissions idempotent.
create function public.finish_learning_hub_session(session_key uuid, learner_key text, answers jsonb)
returns jsonb language plpgsql security invoker set search_path = public, pg_temp as $$
declare
  session_row public.learning_hub_sessions%rowtype;
  saved public.learning_hub_attempts%rowtype;
  question jsonb;
  results jsonb := '[]'::jsonb;
  answer_value jsonb;
  position integer := 0;
  correct_count integer := 0;
  question_count integer;
begin
  select * into session_row from public.learning_hub_sessions where id=session_key and student_id=learner_key for update;
  if not found then raise exception 'Practice session unavailable'; end if;
  select * into saved from public.learning_hub_attempts where id=session_key;
  if found then return to_jsonb(saved); end if;
  if session_row.expires_at<now() then raise exception 'This practice session expired. Start a fresh set.'; end if;
  question_count := jsonb_array_length(session_row.questions);
  if answers is null or jsonb_typeof(answers) is distinct from 'array' then raise exception 'Answer every question'; end if;
  if jsonb_array_length(answers)<>question_count then raise exception 'Answer every question'; end if;
  for question in select value from jsonb_array_elements(session_row.questions) loop
    answer_value := answers->position;
    if jsonb_typeof(answer_value)<>'number' or (answer_value::text)::numeric<>trunc((answer_value::text)::numeric)
      or (answer_value::text)::integer<0 or (answer_value::text)::integer>=jsonb_array_length(question->'options')
      then raise exception 'Choose a valid answer'; end if;
    if answer_value=question->'answer' then correct_count:=correct_count+1; end if;
    results := results || jsonb_build_array(jsonb_build_object('questionId',question->>'id','lessonId',question->>'lessonId',
      'correct',answer_value=question->'answer','answer',question->'answer','explanation',question->>'explanation'));
    position:=position+1;
  end loop;
  insert into public.learning_hub_attempts(id,lesson_id,student_id,assignment_id,score,correct,total,kind,question_results)
    values(session_key,session_row.lesson_id,learner_key,session_row.assignment_id,
      round(100.0*correct_count/question_count),correct_count,question_count,session_row.kind,results) returning * into saved;
  update public.learning_hub_sessions set submitted_at=now() where id=session_key;
  return to_jsonb(saved);
end;
$$;
revoke all on function public.finish_learning_hub_session(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.finish_learning_hub_session(uuid,text,jsonb) to service_role;
