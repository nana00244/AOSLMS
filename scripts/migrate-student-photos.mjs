// Resumable photo extraction. No source photo is removed until its stored bytes
// have been downloaded and verified. CAS preserves concurrent edits.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { decodePhoto, photoPath, photoBucket } from '../src/studentPhotos.ts';
const project = JSON.parse(readFileSync('src/supabase-project.json', 'utf8'));
const raw = execFileSync(
  'cmd.exe',
  [
    '/d',
    '/s',
    '/c',
    'npx supabase projects api-keys --project-ref itqfnzqksuacbeemrqok --output json --agent no',
  ],
  { encoding: 'utf8' },
);
const keys = JSON.parse(raw);
const key = (Array.isArray(keys) ? keys : keys.api_keys).find(
  (k) => k.name === 'service_role',
).api_key;
const client = createClient(project.url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const { data: rows, error } = await client
  .from('workspace_entries')
  .select('entry_key,photo:value->>photo')
  .eq('section', 'students')
  .like('value->>photo', 'data:image/%');
if (error) throw error;
console.log(
  JSON.stringify({ pendingPhotos: rows.length, apply: process.argv.includes('--apply') }),
);
if (process.argv.includes('--apply')) {
  let next = 0,
    migrated = 0,
    concurrent = 0,
    failed = 0;
  const worker = async () => {
    while (next < rows.length) {
      const row = rows[next++];
      try {
        const photo = await decodePhoto(row.photo),
          path = photoPath(photo.ref);
        const bucket = client.storage.from(photoBucket);
        const uploaded = await bucket.upload(path, photo.bytes, {
          contentType: photo.contentType,
          upsert: true,
          cacheControl: '3600',
        });
        if (uploaded.error) throw uploaded.error;
        const downloaded = await bucket.download(path);
        if (downloaded.error) throw downloaded.error;
        const hash = createHash('sha256')
          .update(new Uint8Array(await downloaded.data.arrayBuffer()))
          .digest('hex');
        if (hash !== path.split('.')[0]) throw Error('Photo verification failed');
        const saved = await client.rpc('migrate_student_photo', {
          record_key: row.entry_key,
          expected_photo: row.photo,
          reference: photo.ref,
        });
        if (saved.error) throw saved.error;
        if (saved.data) migrated++;
        else concurrent++;
      } catch {
        failed++;
      }
      if ((migrated + concurrent + failed) % 10 === 0)
        console.log(JSON.stringify({ migrated, concurrent, failed }));
    }
  };
  await Promise.all([worker(), worker(), worker()]);
  console.log(JSON.stringify({ complete: true, migrated, concurrent, failed }));
  if (failed) process.exitCode = 1;
}
