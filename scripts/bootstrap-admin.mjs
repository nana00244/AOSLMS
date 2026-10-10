import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const project = 'itqfnzqksuacbeemrqok';
const email = process.argv[2];
if (!email || !email.includes('@'))
  throw new Error('Usage: node scripts/bootstrap-admin.mjs ADMIN_EMAIL');
const command = `npx --yes supabase projects api-keys --project-ref ${project} --output json --agent no`;
const output =
  process.platform === 'win32'
    ? execFileSync('cmd.exe', ['/d', '/s', '/c', command], { encoding: 'utf8' })
    : execFileSync('sh', ['-c', command], { encoding: 'utf8' });
const parsed = JSON.parse(output);
const keys = Array.isArray(parsed) ? parsed : parsed.api_keys;
const service = keys.find((k) => k.name === 'service_role')?.api_key;
const publishable =
  keys.find((k) => k.type === 'publishable')?.api_key ||
  keys.find((k) => k.name === 'anon')?.api_key;
if (!service || !publishable) throw new Error('CLI did not return the required project keys');
const url = `https://${project}.supabase.co`;
const client = createClient(url, service, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const { data: admins, error: queryError } = await client
  .from('profiles')
  .select('id')
  .eq('role', 'Administrator')
  .eq('active', true);
if (queryError) throw queryError;
writeFileSync('.env.local', `VITE_SUPABASE_URL=${url}\nVITE_SUPABASE_ANON_KEY=${publishable}\n`);
if (admins.length) {
  console.log('Frontend configured. An administrator already exists; no credentials were changed.');
} else {
  const password = `${randomBytes(24).toString('base64url')}!aA7`;
  const { data, error } = await client.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: 'School Administrator' },
  });
  if (error) throw error;
  const { error: profileError } = await client
    .from('profiles')
    .update({ role: 'Administrator', active: true })
    .eq('id', data.user.id);
  if (profileError) {
    await client.auth.admin.deleteUser(data.user.id);
    throw profileError;
  }
  mkdirSync('.temp', { recursive: true });
  writeFileSync('.temp/admin-credentials.json', JSON.stringify({ email, password }, null, 2), {
    mode: 0o600,
  });
  console.log(
    'Administrator created. Credentials saved locally to .temp/admin-credentials.json (Git ignored).',
  );
}
