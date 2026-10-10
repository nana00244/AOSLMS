// CLI-authorized live verification without changing any existing account's password.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { randomBytes, randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
const shell = process.platform === 'win32' ? 'cmd.exe' : 'sh';
const run = (command, options = {}) =>
  execFileSync(
    shell,
    process.platform === 'win32' ? ['/d', '/s', '/c', command] : ['-c', command],
    options,
  );
const project = JSON.parse(readFileSync('src/supabase-project.json', 'utf8'));
const keys = JSON.parse(
  run(
    'npx --yes supabase projects api-keys --project-ref itqfnzqksuacbeemrqok --output json --agent no',
    { encoding: 'utf8' },
  ),
);
const key = (Array.isArray(keys) ? keys : keys.api_keys).find(
  (k) => k.name === 'service_role',
).api_key;
const client = createClient(project.url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const credentials = {
  email: `verification-${randomUUID()}@example.com`,
  password: `${randomBytes(24).toString('base64url')}!aA7`,
};
const { data, error } = await client.auth.admin.createUser({ ...credentials, email_confirm: true });
if (error) throw error;
const path = `.temp/verification-${data.user.id}.json`;
try {
  const result = await client
    .from('profiles')
    .update({
      role: 'Administrator',
      active: true,
      full_name: 'Temporary verification administrator',
    })
    .eq('id', data.user.id);
  if (result.error) throw result.error;
  writeFileSync(path, JSON.stringify(credentials), { mode: 0o600 });
  const env = {
    ...process.env,
    AOS_TEST_CREDENTIALS: path,
    AOS_CLOUD_TESTS: '1',
    AOS_TEST_SERVICE_KEY: key,
  };
  if (!process.argv.includes('--browser-only'))
    run('node scripts/verify-backend-workflows.mjs', { stdio: 'inherit', env });
  run('npm run test:e2e', { stdio: 'inherit', env });
} finally {
  const result = await client.auth.admin.deleteUser(data.user.id);
  try {
    unlinkSync(path);
  } catch {}
  if (result.error) throw result.error;
  console.log('Temporary verification administrator removed.');
}
