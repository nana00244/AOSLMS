-- Report cards are JSON records, not relational report-card rows. The nullable
-- attitudes member lives in the existing conduct value and commits atomically
-- with grades/remarks through the existing workspace transaction.
-- No existing rows or columns are rewritten. Word/key validation is shared TS.
alter table public.workspace_entries
  add constraint report_attitudes_object check (
    section <> 'conduct' or value -> 'attitudes' is null
    or jsonb_typeof(value -> 'attitudes') in ('null', 'object')
  ) not valid;

-- Rollback: alter table public.workspace_entries drop constraint report_attitudes_object;
-- Keep JSON members intact on rollback so stored choices are never deleted.
