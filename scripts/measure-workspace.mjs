// Read-only live RPC timing. Never retain credentials or school record contents.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const project = JSON.parse(readFileSync('src/supabase-project.json', 'utf8'));
const raw = execFileSync(
  process.platform === 'win32' ? 'cmd.exe' : 'sh',
  process.platform === 'win32'
    ? [
        '/d',
        '/s',
        '/c',
        'npx supabase projects api-keys --project-ref itqfnzqksuacbeemrqok --output json --agent no',
      ]
    : [
        '-c',
        'npx supabase projects api-keys --project-ref itqfnzqksuacbeemrqok --output json --agent no',
      ],
  { encoding: 'utf8' },
);
const keys = JSON.parse(raw);
const key = (Array.isArray(keys) ? keys : keys.api_keys).find(
  (k) => k.name === 'service_role',
).api_key;
const entries = [];
let revision = null;
for (const mode of ['full', 'unchanged']) {
  const url = project.url + '/rest/v1/rpc/read_workspace_snapshot';
  const body = JSON.stringify({ known_revision: revision });
  const start = new Date();
  const response = await fetch(url, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body,
    signal: AbortSignal.timeout(60000),
  });
  const text = await response.text();
  const elapsed = Date.now() - start.getTime();
  const data = JSON.parse(text);
  if (!response.ok) throw new Error(`Read measurement failed: HTTP ${response.status}`);
  revision = data.revision;
  entries.push({
    startedDateTime: start.toISOString(),
    time: elapsed,
    request: {
      method: 'POST',
      url,
      httpVersion: 'HTTP/1.1',
      headers: [],
      queryString: [],
      cookies: [],
      headersSize: -1,
      bodySize: Buffer.byteLength(body),
      postData: { mimeType: 'application/json', text: body },
    },
    response: {
      status: response.status,
      statusText: response.statusText,
      httpVersion: 'HTTP/1.1',
      headers: [],
      cookies: [],
      content: {
        size: Buffer.byteLength(text),
        mimeType: 'application/json',
        comment: 'School record contents deliberately omitted.',
      },
      redirectURL: '',
      headersSize: -1,
      bodySize: Buffer.byteLength(text),
    },
    cache: {},
    timings: { send: 0, wait: elapsed, receive: 0 },
    comment: mode,
  });
  console.log(
    JSON.stringify({
      mode,
      status: response.status,
      elapsedMs: elapsed,
      responseBytes: Buffer.byteLength(text),
      unchanged: data.unchanged === true,
    }),
  );
}
mkdirSync('.temp', { recursive: true });
writeFileSync(
  '.temp/workspace-read-timings.har',
  JSON.stringify({
    log: { version: '1.2', creator: { name: 'AOS read measurement', version: '1' }, entries },
  }),
);
