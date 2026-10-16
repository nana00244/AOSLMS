// Live no-op batch verification. No pupil records are changed.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { randomBytes, randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
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
const credentials = {
  email: `batch-verification-${randomUUID()}@example.com`,
  password: `${randomBytes(24).toString('base64url')}!aA7`,
};
const created = await client.auth.admin.createUser({ ...credentials, email_confirm: true });
if (created.error) throw created.error;
const id = created.data.user.id;
try {
  const profile = await client
    .from('profiles')
    .update({
      role: 'Teacher',
      active: true,
      classes: [],
      full_name: 'Temporary batch verification',
    })
    .eq('id', id);
  if (profile.error) throw profile.error;
  const signed = await client.auth.signInWithPassword(credentials);
  if (signed.error) throw signed.error;
  const operations = [randomUUID(), randomUUID()];
  const body = {
    action: 'save-batch',
    ...(process.argv.includes('--ack') ? { response: 'ack' } : {}),
    saves: operations.map((operationId) => ({
      operationId,
      changes: [],
      event: 'Synthetic no-op batch verification',
    })),
  };
  const recoveryEntries = operations.map((idValue) => ({
    id: idValue,
    owner: id,
    createdAt: new Date().toISOString(),
    changes: [],
  }));
  const preview = async (entries) => {
    const response = await fetch(project.url + '/functions/v1/workspace', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${signed.data.session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action: 'preview-recovery', saves: entries }),
      signal: AbortSignal.timeout(60000),
    });
    return { status: response.status, data: await response.json() };
  };
  const before = await preview(recoveryEntries);
  assert.equal(before.status, 200);
  assert.deepEqual(
    before.data.rows.map((r) => r.status),
    ['ready', 'ready'],
  );
  const wrongOwner = await preview([{ ...recoveryEntries[0], owner: randomUUID() }]);
  assert.equal(wrongOwner.status, 400);
  console.log(
    'PASS: live recovery preview marks unconfirmed saves ready and rejects another owner.',
  );
  let revision;
  for (const mode of ['batch', 'retry']) {
    const start = Date.now();
    const response = await fetch(project.url + '/functions/v1/workspace', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${signed.data.session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60000),
    });
    const data = await response.json();
    assert.equal(response.status, 200, data.error || 'Expected successful save');
    if (process.argv.includes('--ack')) {
      assert.equal(data.confirmed, true);
      assert.equal(Object.hasOwn(data, 'state'), false);
    }
    if (mode === 'retry') assert.equal(data.revision, revision, 'retry must not commit again');
    revision = data.revision;
    console.log(
      JSON.stringify({
        mode,
        status: response.status,
        elapsedMs: Date.now() - start,
        responseBytes: Buffer.byteLength(JSON.stringify(data)),
      }),
    );
  }
  const after = await preview(recoveryEntries);
  assert.equal(after.status, 200);
  assert.deepEqual(
    after.data.rows.map((r) => r.status),
    ['confirmed', 'confirmed'],
  );
  console.log('PASS: live recovery preview skips already-confirmed saves.');
  // Use a separate service client: sign-in above changes the first client's auth header.
  const service = createClient(project.url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const receipts = await service
    .from('workspace_save_receipts')
    .select('operation_id')
    .eq('actor', id);
  if (receipts.error) throw receipts.error;
  assert.equal(receipts.data.length, 2);
  console.log('PASS: two original operation receipts; retry did not duplicate the commit.');
} finally {
  const service = createClient(project.url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  await client.auth.signOut();
  const logs = await service.from('audit_log').delete().eq('actor_id', id);
  const removed = await service.auth.admin.deleteUser(id);
  if (logs.error || removed.error) throw logs.error || removed.error;
  console.log('Temporary test account, receipts and test audit entries removed.');
}
