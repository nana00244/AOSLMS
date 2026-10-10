insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values('learning-files','learning-files',false,5242880,array[
 'application/pdf','text/plain','image/png','image/jpeg','application/msword',
 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
 'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
 'application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation'
]);
create policy "Active school users upload into their own folder" on storage.objects
for insert to authenticated with check (
 bucket_id = 'learning-files' and (storage.foldername(name))[1] = (select auth.uid())::text
 and (select private.current_app_role()) in ('Administrator','Teacher','Student')
);
-- Downloads are signed by the Edge API only after checking current record visibility.
