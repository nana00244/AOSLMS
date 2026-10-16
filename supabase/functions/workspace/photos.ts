import { canTeach } from '../../../src/backendAccess.ts';
import { photoReference, photoPath, photoBucket } from '../../../src/studentPhotos.ts';
export async function signStudentPhotos(client: any, profile: any, refs: unknown) {
  if (
    !Array.isArray(refs) ||
    refs.length > 100 ||
    refs.some((r) => typeof r !== 'string' || !photoReference.test(r))
  )
    throw Error('Invalid photo request');
  const { data, error } = await client.rpc('read_student_photo_context', { refs });
  if (error) throw error;
  const current = data.profiles.find((p: any) => p.id === profile.id);
  if (!current?.active) throw Error('Account is inactive');
  const visible = new Set(
    data.students
      .filter(
        (s: any) =>
          ['Administrator', 'Accountant'].includes(current.role) ||
          (current.role === 'Student' && current.student_id === s.id) ||
          (current.role === 'Teacher' &&
            canTeach(
              { ...current, classAllowedSubjects: current.class_allowed_subjects },
              s.classId,
            )),
      )
      .map((s: any) => s.photo),
  );
  const allowed = [...new Set(refs)].filter((r) => visible.has(r));
  if (!allowed.length) return { urls: {} };
  const signed = await client.storage
    .from(photoBucket)
    .createSignedUrls(allowed.map(photoPath), 900);
  if (signed.error) throw signed.error;
  const urls: Record<string, string> = {};
  for (const item of signed.data || [])
    if (!item.error && item.signedUrl && item.path) urls[`photo:${item.path}`] = item.signedUrl;
  return { urls };
}
