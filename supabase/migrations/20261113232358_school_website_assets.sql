insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('school-website-assets','school-website-assets',true,1048576,array['image/webp'])
on conflict(id) do nothing;

-- School pages are public, so assets use a public bucket. Only active LMS
-- administrators can upload, replace, or remove files; each admin can manage
-- only files in their own user-id folder.
create policy "School administrators upload website assets"
on storage.objects for insert to authenticated
with check (
  bucket_id='school-website-assets'
  and (select private.is_admin())
  and (storage.foldername(name))[1]=(select auth.uid())::text
);

create policy "School administrators update website assets"
on storage.objects for update to authenticated
using (
  bucket_id='school-website-assets'
  and (select private.is_admin())
  and (storage.foldername(name))[1]=(select auth.uid())::text
)
with check (
  bucket_id='school-website-assets'
  and (select private.is_admin())
  and (storage.foldername(name))[1]=(select auth.uid())::text
);

create policy "School administrators delete website assets"
on storage.objects for delete to authenticated
using (
  bucket_id='school-website-assets'
  and (select private.is_admin())
  and (storage.foldername(name))[1]=(select auth.uid())::text
);