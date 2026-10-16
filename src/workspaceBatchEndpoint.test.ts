import { beforeAll, afterAll, beforeEach, expect, test, vi } from 'vitest';
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
const op1 = '00000000-0000-4000-8000-000000000001';
const op2 = '00000000-0000-4000-8000-000000000002';
function setup(completed: string[] = []) {
  const state = seed();
  const profile = {
    id: 'staff',
    full_name: 'Admin',
    email: 'admin@example.test',
    role: 'Administrator',
    active: true,
    classes: [],
  };
  const rpc = vi.fn(async (name: string) => ({
    data:
      name === 'read_workspace_snapshot_json'
        ? { document: state, profiles: [profile], revision: 4 }
        : { revision: 5, alreadyApplied: false },
  }));
  const from = vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null }),
    in: vi.fn().mockResolvedValue({ data: completed.map((operation_id) => ({ operation_id })) }),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({ data: [] }),
  }));
  mocks.authenticate.mockResolvedValue({ client: { rpc, from }, profile });
  const key = `${state.students[0].id}|1`;
  const change = (before: unknown, after: string) => ({
    collection: 'remarks',
    id: key,
    before,
    after,
  });
  const saves = [
    { operationId: op1, changes: [change(state.remarks[key], 'First remark')] },
    { operationId: op2, changes: [change('First remark', 'Second remark')] },
  ];
  const request = () =>
    new Request('http://localhost/workspace', {
      method: 'POST',
      body: JSON.stringify({ action: 'save-batch', saves }),
    });
  return { rpc, state, key, saves, request, profile };
}
test('sequential same-record edits commit once with both receipt IDs and one snapshot read', async () => {
  const { rpc, key, request } = setup();
  const response = await handler(request());
  expect(response.status).toBe(200);
  expect((await response.json()).state.remarks[key]).toBe('Second remark');
  expect(rpc.mock.calls.map((c) => c[0])).toEqual([
    'read_workspace_snapshot_json',
    'commit_workspace_maps_once',
  ]);
  const payload = (rpc.mock.calls as any)[1][1];
  expect(payload.operations.map((o: any) => o.id)).toEqual([op1, op2]);
  expect(payload.changes).toHaveLength(1);
  expect(payload.changes[0].collection).toBe('remarks');
  expect(payload).not.toHaveProperty('replacement');
});
test('a committed prefix is skipped without replaying its edits or audit event', async () => {
  const { rpc, state, key, request } = setup([op1]);
  state.remarks[key] = 'First remark';
  expect((await handler(request())).status).toBe(200);
  expect((rpc.mock.calls as any)[1][1].operations.map((o: any) => o.id)).toEqual([op2]);
});
test('a conflict in a later edit does not commit an earlier edit from the batch', async () => {
  const { rpc, saves, request } = setup();
  saves[1].changes[0].before = 'Unrelated version';
  expect((await handler(request())).status).toBe(409);
  expect(rpc).toHaveBeenCalledTimes(1);
});
test('current snapshot permissions still reject unauthorized edits', async () => {
  const { rpc, profile, request } = setup();
  profile.role = 'Teacher';
  expect((await handler(request())).status).toBe(400);
  expect(rpc).toHaveBeenCalledTimes(1);
});
test('an already committed batch reuses the snapshot without another read or write', async () => {
  const { rpc, request } = setup([op1, op2]);
  expect((await handler(request())).status).toBe(200);
  expect(rpc).toHaveBeenCalledTimes(1);
});
test('recovery preview checks authenticated ownership and never invokes a write RPC', async () => {
  const { rpc, saves, profile } = setup([op1]);
  const entries = saves.map((save) => ({
    id: save.operationId,
    owner: profile.id,
    createdAt: new Date().toISOString(),
    changes: save.changes,
  }));
  const make = (items: unknown) =>
    new Request('http://localhost/workspace', {
      method: 'POST',
      body: JSON.stringify({ action: 'preview-recovery', saves: items }),
    });
  const response = await handler(make(entries));
  expect(response.status).toBe(200);
  expect((await response.json()).rows[0].status).toBe('confirmed');
  expect(rpc.mock.calls.every((call) => call[0] === 'read_workspace_snapshot_json')).toBe(true);
  const rejected = await handler(make([{ ...entries[0], owner: 'someone-else' }]));
  expect(rejected.status).toBe(400);
  expect((await rejected.json()).error).toContain('another account');
});
test('photo saves use record deltas and reuse the committed snapshot', async () => {
  const { rpc, state } = setup();
  const student = state.students[0];
  const response = await handler(
    new Request('http://localhost/workspace', {
      method: 'POST',
      body: JSON.stringify({
        action: 'save-pending',
        operationId: op1,
        changes: [
          {
            collection: 'students',
            id: student.id,
            before: student,
            after: { ...student, photo: 'data:image/png;base64,aGVsbG8=' },
          },
        ],
      }),
    }),
  );
  expect(response.status).toBe(200);
  expect(rpc.mock.calls.map((c) => c[0])).toEqual([
    'read_workspace_snapshot_json',
    'commit_workspace_delta',
  ]);
  const payload = (rpc.mock.calls as any)[1][1];
  expect(payload.delta.upserts.filter((row: any) => row.section === 'students')).toHaveLength(1);
  expect(payload).not.toHaveProperty('replacement');
});
