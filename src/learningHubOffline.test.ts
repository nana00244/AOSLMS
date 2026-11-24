import { beforeEach, afterEach, expect, it, vi } from 'vitest';
const mocked = vi.hoisted(() => ({
  invoke: vi.fn(),
  getSession: vi.fn(),
  readings: new Map<string, any>(),
  cache: new Map<string, any>(),
  confirmed: new Set<string>(),
  history: [] as any[],
}));
vi.mock('./supabase', () => ({
  supabase: { auth: { getSession: mocked.getSession }, functions: { invoke: mocked.invoke } },
}));
vi.mock('./learningHub/catalog', () => ({ hubLessons: [] }));
vi.mock('./learningHub/naccaBank', () => ({ naccaHubLessons: [] }));
vi.mock('./nacca/practiceHistory', () => ({ loadPracticeHistory: () => mocked.history }));
vi.mock('./learningHub/offlineHub', () => ({
  cacheHub: async (owner: string, snapshot: any) => mocked.cache.set(owner, snapshot),
  readCachedHub: async (owner: string) => mocked.cache.get(owner),
  forgetCachedHub: async (owner: string) => mocked.cache.delete(owner),
  retainReading: async (reading: any) => mocked.readings.set(reading.id, reading),
  readPendingReadings: async (owner: string) =>
    [...mocked.readings.values()].filter((r) => r.owner === owner),
  acknowledgeReading: async (_owner: string, id: string) => mocked.readings.delete(id),
  confirmAdaptive: async (owner: string, id: string) => mocked.confirmed.add(`${owner}/${id}`),
  isAdaptiveConfirmed: async (owner: string, id: string) => mocked.confirmed.has(`${owner}/${id}`),
}));
import { completeHubReading, loadHub, syncHubOffline } from './learningHub/api';
const snapshot = {
  lessons: [],
  assignments: [{ id: 'private-assignment' }],
  readings: [],
  attempts: [],
};
beforeEach(() => {
  mocked.invoke.mockReset();
  mocked.getSession.mockReset();
  mocked.readings.clear();
  mocked.cache.clear();
  mocked.confirmed.clear();
  mocked.history = [];
  vi.stubGlobal('navigator', { onLine: true });
  mocked.getSession.mockResolvedValue({
    data: { session: { user: { id: 'owner-a' }, access_token: 'token-a' } },
  });
});
afterEach(() => vi.unstubAllGlobals());

it('saves a reading offline without attempting session refresh or network', async () => {
  vi.stubGlobal('navigator', { onLine: false });
  const reading = await completeHubReading('lesson', undefined, 'owner-a', 'pupil');
  expect(reading.pending).toBe(true);
  expect(mocked.readings.size).toBe(1);
  expect(mocked.getSession).not.toHaveBeenCalled();
  expect(mocked.invoke).not.toHaveBeenCalled();
});

it('reads only the selected owner’s downloaded snapshot when offline', async () => {
  vi.stubGlobal('navigator', { onLine: false });
  mocked.cache.set('owner-a', snapshot);
  expect((await loadHub(undefined, false, 'owner-a')).assignments).toHaveLength(1);
  expect((await loadHub(undefined, false, 'owner-b')).assignments).toEqual([]);
  expect(mocked.getSession).not.toHaveBeenCalled();
});

it('clears stale downloaded data when online authorization is denied', async () => {
  mocked.cache.set('owner-a', snapshot);
  mocked.invoke.mockResolvedValue({
    error: {
      context: new Response(JSON.stringify({ error: 'Account inactive' }), { status: 403 }),
    },
  });
  await expect(loadHub(undefined, false, 'owner-a')).rejects.toThrow('Account inactive');
  expect(mocked.cache.has('owner-a')).toBe(false);
});

it('retains rejected readings while syncing later readings and adaptive attempts', async () => {
  mocked.readings.set('bad', {
    id: 'bad',
    owner: 'owner-a',
    studentId: 'pupil',
    lessonId: 'deleted',
  });
  mocked.readings.set('good', {
    id: 'good',
    owner: 'owner-a',
    studentId: 'pupil',
    lessonId: 'available',
  });
  mocked.history = [
    {
      id: 'attempt',
      studentId: 'pupil',
      category: 'auto',
      subject: 'Mathematics',
      indicatorCode: 'B1.1.1.1.1',
      questions: [{ questionId: 'q', response: { selectedOption: 1 } }],
    },
  ];
  mocked.invoke.mockImplementation(async (_name, { body }) =>
    body.lessonId === 'deleted'
      ? {
          error: {
            context: new Response(JSON.stringify({ error: 'Lesson unavailable' }), { status: 404 }),
          },
        }
      : { data: { id: body.attemptId ?? 'reading-confirmed' } },
  );
  await expect(syncHubOffline('owner-a', 'pupil')).rejects.toThrow('Lesson unavailable');
  expect([...mocked.readings.keys()]).toEqual(['bad']);
  expect(mocked.confirmed.has('owner-a/attempt')).toBe(true);
  expect(mocked.invoke).toHaveBeenCalledTimes(3);
  expect(
    mocked.invoke.mock.calls.every(([, args]) => args.headers.Authorization === 'Bearer token-a'),
  ).toBe(true);
});

it('does not send the original account’s queue with another account’s session', async () => {
  mocked.readings.set('pending', {
    id: 'pending',
    owner: 'owner-a',
    studentId: 'pupil',
    lessonId: 'lesson',
  });
  mocked.getSession.mockResolvedValue({
    data: { session: { user: { id: 'owner-b' }, access_token: 'token-b' } },
  });
  await expect(syncHubOffline('owner-a', 'pupil')).rejects.toThrow('original account');
  expect(mocked.invoke).not.toHaveBeenCalled();
  expect(mocked.readings.size).toBe(1);
});
