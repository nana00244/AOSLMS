import { expect, test } from 'vitest';
import { pendingSaveBatch, isFastSave } from './saveBatch';
import type { PendingSave } from './pendingSaves';

const save = (id: string, collection = 'grades'): PendingSave => ({
  id,
  owner: 'teacher',
  createdAt: id,
  changes: [{ collection, id: 'pupil', after: 1 }],
});
test('batches only the contiguous compatible prefix and keeps each retry identity', () => {
  const pending = [save('a'), save('b', 'conduct'), save('c', 'students'), save('d')];
  expect(pendingSaveBatch(pending).map((s) => s.id)).toEqual(['a', 'b']);
  expect(pendingSaveBatch(pending.slice(2)).map((s) => s.id)).toEqual(['c']);
  expect(pendingSaveBatch([])).toEqual([]);
  expect(pendingSaveBatch(Array.from({ length: 20 }, (_, i) => save(String(i))))).toHaveLength(10);
});
test('does not cross owners, conflicts, imports or bounded payloads', () => {
  for (const next of [
    { ...save('b'), owner: 'other' },
    { ...save('b'), conflict: 'Conflict' },
    { ...save('b'), scoreRequest: {} as any },
    { ...save('b'), changes: [{ collection: 'remarks', id: 'p', after: 'x'.repeat(256001) }] },
  ])
    expect(pendingSaveBatch([save('a'), next])).toHaveLength(1);
  expect(isFastSave(save('a', 'users'))).toBe(false);
});
