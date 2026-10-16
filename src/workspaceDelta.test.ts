import { expect, test, vi } from 'vitest';
import { workspaceRecordDelta, equalJson } from './workspaceDelta';
import { createSnapshotCache } from './workspaceSnapshotCache';

test('one photo edit omits all unchanged pictures despite JSON key order differences', () => {
  const before = {
    students: [
      { id: 'a', photo: 'old' },
      { photo: 'unchanged'.repeat(10000), id: 'b' },
    ],
    grades: { a: { exam: 40, sba: 30 } },
  };
  const after = {
    students: [
      { photo: 'new', id: 'a' },
      { id: 'b', photo: before.students[1].photo },
    ],
    grades: { a: { sba: 30, exam: 40 } },
  };
  const delta = workspaceRecordDelta(before, after);
  expect(delta.upserts).toEqual([
    { section: 'students', entry_key: 'i:a:1', ordinal: 1, value: after.students[0] },
  ]);
  expect(JSON.stringify(delta).length).toBeLessThan(500);
  expect(delta.studentIds).toBeNull();
});
test('preserves duplicate IDs, array ordering, removals, nulls and profile side effects', () => {
  const before = {
    students: [{ id: 'a' }, { id: 'b' }],
    verified: ['a', 'a'],
    grades: { old: 1 },
    users: [],
  };
  const after = {
    students: [{ id: 'b' }, { id: 'b' }],
    verified: ['a'],
    grades: { new: null },
    users: [{ id: 'u', classes: ['BS1'] }],
  };
  const delta = workspaceRecordDelta(before, after);
  expect(delta.removals).toContainEqual({ section: 'students', entry_key: 'i:a:1' });
  expect(delta.removals).toContainEqual({ section: 'verified', entry_key: 'p:2' });
  expect(delta.upserts).toContainEqual({
    section: 'grades',
    entry_key: 'o:new',
    ordinal: 0,
    value: null,
  });
  expect(delta.upserts.some((r) => r.entry_key === 'i:b:2')).toBe(true);
  expect(delta.studentIds).toEqual(['b', 'b']);
  expect(delta.profiles).toEqual([{ id: 'u', classes: ['BS1'], classAllowedSubjects: {} }]);
  expect(equalJson({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true);
});
test('cached snapshots are always revision-checked and refresh on external permission changes', async () => {
  const cache = createSnapshotCache();
  const first = { revision: 1, document: { students: [] }, profiles: [{ active: true }] };
  const newer = { revision: 2, document: { students: [] }, profiles: [{ active: false }] };
  const rpc = vi
    .fn()
    .mockResolvedValueOnce({ data: first })
    .mockResolvedValueOnce({ data: { unchanged: true, revision: 1 } })
    .mockResolvedValueOnce({ data: newer });
  expect(await cache.read({ rpc })).toEqual(first);
  expect(await cache.read({ rpc })).toEqual(first);
  expect(rpc.mock.calls[1][1]).toEqual({ known_revision: 1 });
  expect(await cache.read({ rpc })).toEqual(newer);
  cache.remember(first); // older concurrent response must never replace newer cache
  rpc.mockResolvedValueOnce({ data: { unchanged: true, revision: 2 } });
  expect(await cache.read({ rpc })).toEqual(newer);
});
test('cache does not return data on a failed revision check', async () => {
  const cache = createSnapshotCache();
  cache.remember({ revision: 1, document: { students: [] } });
  await expect(
    cache.read({ rpc: vi.fn().mockResolvedValue({ error: Error('offline') }) }),
  ).rejects.toThrow('offline');
});
