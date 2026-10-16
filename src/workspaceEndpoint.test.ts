import { beforeAll, beforeEach, afterAll, expect, test, vi } from 'vitest';
import { seed } from './data';

const mocks = vi.hoisted(() => ({ authenticate: vi.fn() }));
vi.mock('../supabase/functions/_shared/http.ts', () => ({
  authenticate: mocks.authenticate,
  json: (body: unknown, status = 200) => Response.json(body, { status }),
}));
let handler: (request: Request) => Promise<Response>;
beforeAll(async () => {
  vi.stubGlobal('Deno', { serve: (callback: typeof handler) => (handler = callback) });
  const endpoint = '../supabase/functions/workspace/index.ts';
  await import(/* @vite-ignore */ endpoint);
});
afterAll(() => vi.unstubAllGlobals());
beforeEach(() => vi.clearAllMocks());
const request = (body: unknown) =>
  new Request('http://localhost/workspace', { method: 'POST', body: JSON.stringify(body) });
function fixture() {
  const state = seed();
  const admin = state.users.find((u) => u.role === 'Administrator')!;
  const profile = {
    id: admin.id,
    full_name: admin.name,
    email: admin.email,
    role: admin.role,
    active: true,
    classes: [],
    class_allowed_subjects: {},
  };
  const rpc = vi
    .fn()
    .mockResolvedValue({ data: { document: state, revision: 9, profiles: [profile] } });
  const logs = {
    select: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({ data: [] }),
  };
  const from = vi.fn().mockReturnValue(logs);
  mocks.authenticate.mockResolvedValue({ client: { rpc, from }, profile });
  return { rpc, from };
}
test('initial load reads one consistent snapshot without rereading the large document', async () => {
  const { rpc, from } = fixture();
  const response = await handler(request({ action: 'load' }));
  expect(response.status).toBe(200);
  expect((await response.json()).state.students.length).toBeGreaterThan(0);
  expect(rpc.mock.calls).toEqual([['read_workspace_snapshot_json', { known_revision: null }]]);
  expect(from.mock.calls).toEqual([['audit_log']]);
});
test('unchanged polling does not load profiles, audit rows or the document again', async () => {
  const { rpc, from } = fixture();
  rpc.mockResolvedValue({ data: { unchanged: true, revision: 9 } });
  const response = await handler(request({ action: 'load', knownRevision: 9 }));
  expect(await response.json()).toEqual({ unchanged: true, revision: 9 });
  expect(rpc).toHaveBeenCalledWith('read_workspace_snapshot_json', { known_revision: 9 });
  expect(from).not.toHaveBeenCalled();
});
test('unknown actions are rejected before reading the workspace', async () => {
  const { rpc } = fixture();
  expect((await handler(request({ action: 'unknown' }))).status).toBe(400);
  expect(rpc).not.toHaveBeenCalled();
});
test('database timeout is a retryable service error with its database code', async () => {
  const { rpc } = fixture();
  rpc.mockResolvedValue({
    error: { code: '57014', message: 'canceling statement due to statement timeout' },
  });
  const response = await handler(request({ action: 'load' }));
  expect(response.status).toBe(503);
  expect((await response.json()).code).toBe('57014');
});
