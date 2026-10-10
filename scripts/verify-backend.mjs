import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .trim()
    .split(/\r?\n/)
    .map((line) => {
      const i = line.indexOf('=');
      return [line.slice(0, i), line.slice(i + 1)];
    }),
);
const credentials = JSON.parse(readFileSync('.temp/admin-credentials.json', 'utf8'));
const client = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const { data, error } = await client.auth.signInWithPassword(credentials);
if (error) throw error;
assert(data.user);
const call = async (name, body, c = client) => {
  const { data, error } = await c.functions.invoke(name, { body });
  if (error) {
    const detail = error.context instanceof Response ? await error.context.text() : error.message;
    throw new Error(`${name}: ${detail}`);
  }
  assert(!data.error, data.error);
  return data;
};
const loaded = await call('workspace', { action: 'load' });
assert.equal(loaded.state.users.find((u) => u.id === data.user.id)?.role, 'Administrator');
const direct = await client.from('school_workspace').select('*');
assert(direct.error, 'Raw workspace must not be client-readable');
const rpc = await client.rpc('commit_workspace', {
  expected_revision: 0,
  replacement: {},
  actor: data.user.id,
  event: 'forged',
});
assert(rpc.error, 'Privileged commit must not be callable by browser users');
const signup = await client.auth.signUp({
  email: 'aoslms-disabled-signup@example.com',
  password: 'NotARealAccount!38219',
});
assert(signup.error, 'Public signup must be disabled');
console.log(
  'PASS: administrator login, cloud load, raw database isolation, privileged RPC isolation, public signup disabled.',
);
await client.auth.signOut({ scope: 'local' });
