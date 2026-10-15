import { beforeAll, afterAll, beforeEach, expect, test, vi } from 'vitest';
import { seed } from './data';
const mocks = vi.hoisted(() => ({ authenticate: vi.fn() }));
vi.mock('../supabase/functions/_shared/http.ts', () => ({
  authenticate: mocks.authenticate,
  json: (body: unknown, status = 200) => Response.json(body, { status }),
}));
let handler: (request: Request) => Promise<Response>;
beforeAll(async () => {
  vi.stubGlobal('Deno', {
    serve: (callback: typeof handler) => (handler = callback),
    env: {
      get: (name: string) => (name === 'GEMINI_API_KEY' ? 'synthetic-test-key' : undefined),
    },
  });
  const endpoint = '../supabase/functions/generate-report-remark/index.ts';
  await import(/* @vite-ignore */ endpoint);
});
afterAll(() => vi.unstubAllGlobals());
beforeEach(() => vi.clearAllMocks());
function setup(status = 200) {
  const state = seed();
  const query = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: { document: state } }),
  };
  mocks.authenticate.mockResolvedValue({
    client: { from: () => query, rpc: vi.fn().mockResolvedValue({ data: true }) },
    profile: { id: 'staff', role: 'Administrator', active: true },
  });
  const fetch = vi.fn().mockResolvedValue(
    Response.json(
      status === 200
        ? {
            candidates: [
              {
                finishReason: 'STOP',
                content: { parts: [{ text: ' A useful teacher remark. ' }] },
              },
            ],
          }
        : { error: { code: 'invalid_request_error' } },
      { status },
    ),
  );
  vi.stubGlobal('fetch', fetch);
  const request = new Request('http://localhost/remark', {
    method: 'POST',
    body: JSON.stringify({
      studentId: state.students[0].id,
      term: state.settings.term,
      provider: 'gemini',
    }),
  });
  return { fetch, request, state };
}
test('Gemini receives only authorized scores and returns a reviewable draft', async () => {
  const { fetch, request, state } = setup();
  const response = await handler(request);
  expect(response.status).toBe(200);
  expect((await response.json()).remark).toBe('A useful teacher remark.');
  expect(fetch.mock.calls[0][0]).toBe(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent',
  );
  const body = JSON.parse(fetch.mock.calls[0][1].body);
  expect(fetch.mock.calls[0][1].headers['x-goog-api-key']).toBe('synthetic-test-key');
  expect(body.contents[0].parts[0].text).not.toContain(state.students[0].name);
  expect(Object.keys(JSON.parse(body.contents[0].parts[0].text))).toEqual(['scores']);
});
test.each([
  [401, 'AI_KEY_INVALID'],
  [403, 'AI_KEY_INVALID'],
  [429, 'AI_QUOTA_UNAVAILABLE'],
])('provider status %s becomes actionable error %s', async (status, code) => {
  const { request } = setup(status as number);
  const response = await handler(request);
  expect(response.status).toBe(503);
  expect((await response.json()).code).toBe(code);
});
