insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('student-photos','student-photos',false,600000,array['image/png','image/jpeg']);
-- No client policies: authenticated Edge handlers authorize each signed read.
create function public.read_student_photo_context(refs jsonb) returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object(
  'profiles',(select coalesce(jsonb_agg(to_jsonb(p)),'[]') from public.profiles p),
  'students',(select coalesce(jsonb_agg(jsonb_build_object('id',value->>'id',
    'classId',value->>'classId','photo',value->>'photo')),'[]')
    from public.workspace_entries where section='students' and refs ? (value->>'photo')));
$$;
-- Replace only the exact original photo after Storage upload and verification.
create function public.migrate_student_photo(record_key text, expected_photo text, reference text)
returns boolean language plpgsql security invoker set search_path='' set lock_timeout='3s' as $$
begin
 if reference !~ '^photo:[a-f0-9]{64}\.(png|jpg)$' or not exists(
  select 1 from storage.objects where bucket_id='student-photos' and name=substr(reference,7)) then
  raise exception 'Verified storage photo is required';
 end if;
 perform 1 from public.workspace_head where id for update;
 update public.workspace_entries set value=jsonb_set(value,'{photo}',to_jsonb(reference))
 where section='students' and entry_key=record_key and value->>'photo'=expected_photo;
 if not found then return false; end if;
 update public.workspace_head set revision=revision+1,updated_at=now() where id;
 return true;
end;
$$;
revoke all on function public.read_student_photo_context(jsonb),public.migrate_student_photo(text,text,text) from public,anon,authenticated;
grant execute on function public.read_student_photo_context(jsonb),public.migrate_student_photo(text,text,text) to service_role;
notify pgrst,'reload schema';
