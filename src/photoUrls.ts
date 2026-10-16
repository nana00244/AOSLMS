import { invokeBackend } from './backend';
import { supabase } from './supabase';
import { photoReference } from './studentPhotos';
const cache = new Map<string, { url: string; expires: number }>();
let generation = 0;
supabase?.auth.onAuthStateChange((event) => {
  if (['SIGNED_OUT', 'SIGNED_IN', 'USER_UPDATED'].includes(event)) {
    cache.clear();
    generation++;
  }
});
export function cachedPhotoUrl(photo?: string) {
  if (!photo || !photoReference.test(photo)) return photo;
  const value = cache.get(photo);
  return value && value.expires > Date.now() ? value.url : undefined;
}
export async function preparePhotoUrls(photos: (string | undefined)[]) {
  const refs = [
    ...new Set(
      photos.filter((p): p is string => !!p && photoReference.test(p) && !cachedPhotoUrl(p)),
    ),
  ];
  const current = generation;
  for (let i = 0; i < refs.length; i += 100) {
    const { urls } = await invokeBackend('workspace', {
      action: 'photo-urls',
      photos: refs.slice(i, i + 100),
    });
    if (current !== generation) throw Error('Account changed while loading photos');
    for (const [ref, url] of Object.entries(urls as Record<string, string>))
      cache.set(ref, { url, expires: Date.now() + 14 * 60 * 1000 });
    if (refs.slice(i, i + 100).some((ref) => !cachedPhotoUrl(ref)))
      throw Error('A student photo is unavailable');
  }
}
let queued = new Map<string, { resolve: (url?: string) => void; reject: (e: unknown) => void }[]>();
let timer: ReturnType<typeof setTimeout> | undefined;
export function resolvePhotoUrl(photo: string, refresh = false): Promise<string | undefined> {
  if (refresh) cache.delete(photo);
  const existing = cachedPhotoUrl(photo);
  if (existing) return Promise.resolve(existing);
  return new Promise((resolve, reject) => {
    queued.set(photo, [...(queued.get(photo) || []), { resolve, reject }]);
    if (timer) return;
    timer = setTimeout(async () => {
      const batch = queued;
      queued = new Map();
      timer = undefined;
      try {
        await preparePhotoUrls([...batch.keys()]);
        for (const [ref, list] of batch) for (const item of list) item.resolve(cachedPhotoUrl(ref));
      } catch (error) {
        for (const list of batch.values()) for (const item of list) item.reject(error);
      }
    }, 15);
  });
}
