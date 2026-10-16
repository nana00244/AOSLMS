import type { Change } from './backendAccess.ts';
export const photoReference = /^photo:[a-f0-9]{64}\.(png|jpg)$/;
export const photoBucket = 'student-photos';
export function photoPath(ref: string) {
  if (!photoReference.test(ref)) throw Error('Invalid student photo reference');
  return ref.slice(6);
}
export async function decodePhoto(value: string) {
  const match = /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/=]+)$/.exec(value);
  if (!match || value.length > 800000) throw Error('Invalid student photograph');
  const bytes = Uint8Array.from(atob(match[2]), (c) => c.charCodeAt(0));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const hash = Array.from(new Uint8Array(digest), (v) => v.toString(16).padStart(2, '0')).join('');
  return {
    bytes,
    contentType: `image/${match[1]}`,
    ref: `photo:${hash}.${match[1] === 'png' ? 'png' : 'jpg'}`,
  };
}
// A migration only changes representation. Match old pending before/after values
// to the current reference without dropping a genuinely competing photo edit.
export async function normalizePhotoChanges(
  students: { id: string; photo?: string }[],
  changes: Change[],
) {
  return Promise.all(
    changes.map(async (change) => {
      if (change.collection !== 'students') return change;
      const current = students.find((s) => s.id === change.id)?.photo;
      if (!current || !photoReference.test(current)) return change;
      const normalize = async (value: any) => {
        if (!value?.photo?.startsWith('data:image/')) return value;
        const decoded = await decodePhoto(value.photo);
        return decoded.ref === current ? { ...value, photo: current } : value;
      };
      return {
        ...change,
        before: await normalize(change.before),
        after: await normalize(change.after),
      };
    }),
  );
}

// Call only AFTER schema and edit authorization. Upload before committing a reference.
export async function storeStudentPhotos(client: any, students: any[], previous: any[] = []) {
  const result = [];
  const uploaded = new Set<string>();
  for (const student of students) {
    if (
      !student.photo?.startsWith('data:image/') ||
      previous.some((s) => s.id === student.id && s.photo === student.photo)
    ) {
      result.push(student);
      continue;
    }
    const photo = await decodePhoto(student.photo);
    if (!uploaded.has(photo.ref)) {
      const { error } = await client.storage
        .from(photoBucket)
        .upload(photoPath(photo.ref), photo.bytes, {
          contentType: photo.contentType,
          upsert: true,
          cacheControl: '3600',
        });
      if (error) throw error;
      uploaded.add(photo.ref);
    }
    result.push({ ...student, photo: photo.ref });
  }
  return result;
}
