select
  (select count(*) from public.school_workspace) = 1 as singleton_workspace,
  not has_table_privilege('authenticated', 'public.school_workspace', 'SELECT') as browser_cannot_read_raw_workspace,
  not has_table_privilege('authenticated', 'public.profiles', 'UPDATE') as browser_cannot_promote_accounts,
  not has_function_privilege('authenticated', 'public.commit_workspace(bigint,jsonb,uuid,text)', 'EXECUTE') as browser_cannot_bypass_api,
  (select relrowsecurity from pg_class where oid = 'public.school_workspace'::regclass) as workspace_rls_enabled,
  (select not public from storage.buckets where id = 'learning-files') as learning_files_private,
  (select count(*) from public.profiles where role = 'Administrator' and active) as active_administrators;
