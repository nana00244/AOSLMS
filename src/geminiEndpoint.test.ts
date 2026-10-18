import { beforeAll, afterAll, beforeEach, expect, test, vi } from 'vitest';
import { seed } from './data';
const mocks = vi.hoisted(() => ({ authenticate: vi.fn(), dahlKey: false }));
vi.mock('../supabase/functions/_shared/http.ts', () => ({
  authenticate: mocks.authenticate,
  json: (body: unknown, status = 200) => Response.json(body, { status }),
}));
let handler: (request: Request) => Promise<Response>;
beforeAll(async () => {
  vi.stubGlobal('Deno', {
    serve: (callback: typeof handler) => (handler = callback),
    env: {
      get: (name: string) =>
        name === 'GEMINI_API_KEY'
          ? 'synthetic-test-key'
          : name === 'DAHL_API_KEY' && mocks.dahlKey
            ? 'synthetic-dahl-key'
            : undefined,
    },
  });
  const endpoint = '../supabase/functions/generate-report-remark/index.ts';
  await import(/* @vite-ignore */ endpoint);
});
afterAll(() => vi.unstubAllGlobals());
beforeEach(() => {
  vi.clearAllMocks();
  mocks.dahlKey = false;
});
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

test('DeepSeek is first choice and Gemini is not called on success', async () => {
  const { fetch, request, state } = setup();
  mocks.dahlKey = true;
  fetch.mockResolvedValueOnce(
    Response.json({
      choices: [{ finish_reason: 'stop', message: { content: ' A DeepSeek draft. ' } }],
    }),
  );
  const response = await handler(request);
  expect(await response.json()).toMatchObject({
    remark: 'A DeepSeek draft.',
    provider: 'deepseek',
  });
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(fetch.mock.calls[0][0]).toBe('https://inference.dahl.global/v1/chat/completions');
  const body = JSON.parse(fetch.mock.calls[0][1].body);
  expect(Object.keys(JSON.parse(body.messages[1].content))).toEqual(['scores']);
  expect(body.messages[1].content).not.toContain(state.students[0].name);
});

test.each(['capacity', 'balance', 'timeout', 'invalid-json', 'empty', 'truncated', 'oversized'])(
  'DeepSeek %s falls back to Gemini',
  async (failure) => {
    const { fetch, request } = setup();
    mocks.dahlKey = true;
    if (failure === 'timeout')
      fetch.mockRejectedValueOnce(new DOMException('Timed out', 'TimeoutError'));
    else if (failure === 'capacity' || failure === 'balance')
      fetch.mockResolvedValueOnce(
        Response.json({}, { status: failure === 'capacity' ? 429 : 402 }),
      );
    else if (failure === 'invalid-json') fetch.mockResolvedValueOnce(new Response('invalid'));
    else
      fetch.mockResolvedValueOnce(
        Response.json({
          choices: [
            {
              finish_reason: failure === 'truncated' ? 'length' : 'stop',
              message: {
                content:
                  failure === 'oversized'
                    ? 'x'.repeat(1201)
                    : failure === 'empty'
                      ? ' '
                      : 'partial',
              },
            },
          ],
        }),
      );
    const response = await handler(request);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      remark: 'A useful teacher remark.',
      provider: 'gemini',
    });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls[1][0]).toContain('generativelanguage.googleapis.com');
  },
);
