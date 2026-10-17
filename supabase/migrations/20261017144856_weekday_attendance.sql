set local lock_timeout = '5s';

create function private.is_weekday_attendance_key(record_key text) returns boolean
language plpgsql immutable strict security invoker set search_path='' as $$
declare calendar_date date; date_text text;
begin
  if record_key !~ '^o:[0-9]{4}-[0-9]{2}-[0-9]{2}\|[1-3]\|.+' then return false; end if;
  date_text := split_part(substr(record_key,3),'|',1);
  calendar_date := date_text::date;
  return to_char(calendar_date,'YYYY-MM-DD')=date_text
    and extract(isodow from calendar_date) between 1 and 5;
exception when datetime_field_overflow or invalid_datetime_format then return false;
end;
$$;
revoke all on function private.is_weekday_attendance_key(text) from public,anon,authenticated;
grant execute on function private.is_weekday_attendance_key(text) to service_role;

-- Restricted rollback copy, not active attendance and not exposed through the API.
create table private.weekend_attendance_recovery (
  section text not null, entry_key text not null, ordinal bigint not null,
  value jsonb not null, archived_at timestamptz not null default now(),
  primary key(section,entry_key)
);
alter table private.weekend_attendance_recovery enable row level security;
revoke all on private.weekend_attendance_recovery from public,anon,authenticated;

-- Serialize with queued saves and publish one revision after the cleanup.
do $$
declare removed integer;
begin
  perform 1 from public.workspace_head where id for update;
  insert into private.weekend_attendance_recovery(section,entry_key,ordinal,value)
    select section,entry_key,ordinal,value from public.workspace_entries
    where section='attendance' and not private.is_weekday_attendance_key(entry_key);
  insert into private.weekend_attendance_recovery(section,entry_key,ordinal,value)
    select c.section,c.entry_key,c.ordinal,c.value from public.workspace_entries c
    where c.section='conduct' and (c.value ? 'attendanceAttended' or c.value ? 'attendanceTotal')
    and exists(select 1 from private.weekend_attendance_recovery a
      where a.section='attendance' and c.entry_key='o:'||split_part(substr(a.entry_key,3),'|',3)||'|'||split_part(substr(a.entry_key,3),'|',2));
  update public.workspace_entries c set value=c.value-'attendanceAttended'-'attendanceTotal'
    where c.section='conduct' and exists(select 1 from private.weekend_attendance_recovery a
      where a.section='conduct' and a.entry_key=c.entry_key);
  delete from public.workspace_entries where section='attendance'
    and not private.is_weekday_attendance_key(entry_key);
  get diagnostics removed = row_count;
  if removed>0 then
    update public.workspace_head set revision=revision+1,updated_at=now() where id;
    insert into public.audit_log(actor_id,action,entity)
      values(null,format('Removed %s non-weekday attendance entries; recalculated affected report attendance totals',removed),'workspace');
  end if;
end;
$$;

alter table public.workspace_entries add constraint attendance_weekdays_only
  check (section <> 'attendance' or private.is_weekday_attendance_key(entry_key));
