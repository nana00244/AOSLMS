-- Publish only an invalidation counter, never the private workspace document.
create table public.workspace_revisions (
  id boolean primary key default true check (id),
  revision bigint not null
);
alter table public.workspace_revisions enable row level security;
revoke all on public.workspace_revisions from public, anon, authenticated;
grant select on public.workspace_revisions to authenticated;
grant all on public.workspace_revisions to service_role;
create policy active_users_read_revision on public.workspace_revisions for select to authenticated
using (exists (select 1 from public.profiles where id = (select auth.uid()) and active));
insert into public.workspace_revisions select id, revision from public.school_workspace;
create function private.publish_workspace_revision() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  update public.workspace_revisions set revision = new.revision where id = new.id;
  return new;
end;
$$;
revoke all on function private.publish_workspace_revision() from public, anon, authenticated;
grant execute on function private.publish_workspace_revision() to service_role;
create trigger workspace_revision_changed after update of revision on public.school_workspace
for each row execute function private.publish_workspace_revision();
alter publication supabase_realtime add table public.workspace_revisions;
