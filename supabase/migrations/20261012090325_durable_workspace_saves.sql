-- Idempotency receipts survive a dropped response, so retrying cannot duplicate a save.
create table public.workspace_save_receipts (
  actor uuid not null references public.profiles(id) on delete cascade,
  operation_id uuid not null,
  revision bigint not null,
  created_at timestamptz not null default now(),
  primary key (actor, operation_id)
);
alter table public.workspace_save_receipts enable row level security;
revoke all on public.workspace_save_receipts from public, anon, authenticated;
grant all on public.workspace_save_receipts to service_role;
create function public.commit_workspace_once(expected_revision bigint, replacement jsonb, actor uuid, event text, operation_id uuid)
returns bigint language plpgsql security invoker set search_path = '' as $$
declare result bigint;
begin
  perform 1 from public.school_workspace where id for update;
  select r.revision into result from public.workspace_save_receipts r
    where r.actor = commit_workspace_once.actor and r.operation_id = commit_workspace_once.operation_id;
  if result is not null then return result; end if;
  result := public.commit_workspace(expected_revision, replacement, actor, event);
  insert into public.workspace_save_receipts(actor, operation_id, revision) values(actor, operation_id, result);
  return result;
end;
$$;
revoke all on function public.commit_workspace_once(bigint,jsonb,uuid,text,uuid) from public, anon, authenticated;
grant execute on function public.commit_workspace_once(bigint,jsonb,uuid,text,uuid) to service_role;
