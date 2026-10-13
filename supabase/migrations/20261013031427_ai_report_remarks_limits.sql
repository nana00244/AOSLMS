-- Service-only, bounded counters; no pupil data or generated text is retained here.
create table public.report_remark_limits (
  bucket text primary key,
  window_start timestamptz not null,
  requests integer not null default 0
);
alter table public.report_remark_limits enable row level security;
revoke all on public.report_remark_limits from anon, authenticated;

create function public.reserve_report_remark(actor uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  minute_start timestamptz := date_trunc('minute', now());
  day_start timestamptz := date_trunc('day', now() at time zone 'UTC') at time zone 'UTC';
  entry record;
  used integer;
begin
  if not exists (select 1 from public.profiles where id = actor and active and role in ('Administrator', 'Teacher')) then
    return false;
  end if;
  -- A single lock makes the three reservations atomic across concurrent Edge workers.
  perform pg_advisory_xact_lock(67392014);
  for entry in select * from (values
    ('global:day', day_start, 1000),
    (actor::text || ':day', day_start, 200),
    (actor::text || ':minute', minute_start, 20)
  ) as limits(bucket, starts, maximum) loop
    select requests into used from public.report_remark_limits
      where bucket = entry.bucket and window_start = entry.starts;
    if coalesce(used, 0) >= entry.maximum then return false; end if;
  end loop;
  for entry in select * from (values
    ('global:day', day_start), (actor::text || ':day', day_start),
    (actor::text || ':minute', minute_start)
  ) as limits(bucket, starts) loop
    insert into public.report_remark_limits as counters (bucket, window_start, requests)
    values (entry.bucket, entry.starts, 1)
    on conflict (bucket) do update set window_start = excluded.window_start,
      requests = case when counters.window_start = excluded.window_start then counters.requests + 1 else 1 end;
  end loop;
  return true;
end;
$$;
revoke all on function public.reserve_report_remark(uuid) from public, anon, authenticated;
grant execute on function public.reserve_report_remark(uuid) to service_role;
