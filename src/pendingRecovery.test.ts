import { expect, test } from 'vitest';
import { seed } from './data';
import { parsePendingRecovery, previewPendingRecovery } from './pendingRecovery';
import type { PendingSave } from './pendingSaves';
const state = seed();
const user = state.users.find((u) => u.role === 'Administrator')!;
const key = `${state.students[0].id}|1`;
const save = (n: number, before: unknown, after: string): PendingSave => ({
  id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
  owner: user.id,
  createdAt: new Date(2026, 9, 15, 0, n).toISOString(),
  changes: [{ collection: 'remarks', id: key, before, after }],
});
test('accepts original download format and rejects ownership, duplicate IDs and workspace backups', () => {
  const entry = save(1, state.remarks[key], 'Draft');
  expect(parsePendingRecovery(JSON.stringify([entry]), user.id)[0].id).toBe(entry.id);
  expect(() => parsePendingRecovery(JSON.stringify([entry]), 'other')).toThrow('another account');
  expect(() => parsePendingRecovery(JSON.stringify([entry, entry]), user.id)).toThrow('duplicate');
  expect(() => parsePendingRecovery(JSON.stringify({ format: 'aos-backup-v1' }), user.id)).toThrow(
    'workspace backup',
  );
  expect(() => parsePendingRecovery('[{"__proto__":{}}]', user.id)).toThrow('Unsafe');
});
test('preview skips receipts, merges ordered edits, flags conflicts and does not mutate data', () => {
  const original = JSON.stringify(state);
  const saves = [
    save(1, 'old', 'confirmed'),
    save(2, state.remarks[key], 'First'),
    save(3, 'First', 'Second'),
    save(4, 'competing', 'Third'),
    save(5, 'Third', 'Fourth'),
  ];
  expect(
    previewPendingRecovery(state, user, saves, new Set([saves[0].id])).map((r) => r.status),
  ).toEqual(['confirmed', 'ready', 'ready', 'conflict', 'blocked']);
  expect(JSON.stringify(state)).toBe(original);
});
test('preview enforces current role and class permissions', () => {
  const teacher = { ...user, role: 'Teacher' as const, classes: [] };
  expect(
    previewPendingRecovery(state, teacher, [save(1, state.remarks[key], 'Draft')], new Set())[0]
      .status,
  ).toBe('blocked');
});
