import { supabase } from './supabase';

const bucket = 'school-website-assets';
export const websiteMediaAccept = 'image/*,video/mp4,video/webm,.mp4,.webm';
export const isWebsiteVideo = (url: string) => /\.(mp4|webm)(?:[?#]|$)/i.test(url);

async function webpImage(file: File) {
  if (!file.type.startsWith('image/')) throw new Error('Choose an image file.');
  if (file.size > 15 * 1024 * 1024) throw new Error('Choose an image smaller than 15 MB.');
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1800 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('This browser cannot process the selected image.');
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  for (const quality of [0.82, 0.72, 0.62]) {
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/webp', quality),
    );
    if (blob && blob.size <= 550_000) return blob;
  }
  throw new Error('Could not compress the image enough. Choose a smaller image.');
}

/** Website images are uploaded separately so page saves only store compact public URLs. */
export async function uploadSchoolWebsiteImage(file: File) {
  return storeWebsiteFile(await webpImage(file), 'webp');
}

export async function uploadSchoolWebsiteMedia(file: File) {
  if (file.type.startsWith('image/')) return uploadSchoolWebsiteImage(file);
  const extension = file.name.split('.').pop()?.toLowerCase();
  const type =
    file.type || (extension === 'mp4' || extension === 'webm' ? 'video/' + extension : '');
  if (type !== 'video/mp4' && type !== 'video/webm')
    throw new Error('Choose an image, MP4, or WebM video.');
  if (file.size > 50 * 1024 * 1024) throw new Error('Choose a video of 50 MB or less.');
  if (!file.size) throw new Error('The selected video is empty.');
  return storeWebsiteFile(
    file.type === type ? file : file.slice(0, file.size, type),
    type === 'video/mp4' ? 'mp4' : 'webm',
  );
}

async function storeWebsiteFile(blob: Blob, extension: string) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) throw new Error('Sign in as an administrator before uploading images.');
  const path = `${user.id}/${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from(bucket).upload(path, blob, {
    contentType: blob.type,
    upsert: false,
    cacheControl: '31536000',
  });
  if (error) throw error;
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

/** Convert a retained legacy data URL to the same optimized Storage object as a new upload. */
export async function migrateSchoolWebsiteImage(value: string) {
  const response = await fetch(value);
  const blob = await response.blob();
  const extension = blob.type.split('/')[1] || 'png';
  return uploadSchoolWebsiteImage(
    new File([blob], `website-image.${extension}`, { type: blob.type }),
  );
}
