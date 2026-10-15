import type { PendingSave } from './pendingSaves.ts';

// Only independent map collections: no student deletion, profile changes, uploads,
// ordering changes or score-import commands with derived side effects.
export const fastSaveCollections = new Set([
  'attendance',
  'grades',
  'remarks',
  'conduct',
  'fees',
  'studentConcessions',
  'studentBills',
]);
export function isFastSave(save: Pick<PendingSave, 'changes' | 'scoreRequest' | 'conflict'>) {
  return (
    !save.scoreRequest &&
    !save.conflict &&
    Array.isArray(save.changes) &&
    save.changes.every((change) => fastSaveCollections.has(change.collection))
  );
}
export function pendingSaveBatch(pending: PendingSave[]): PendingSave[] {
  const batch: PendingSave[] = [];
  let bytes = 0,
    changes = 0;
  for (const save of pending.slice(0, 10)) {
    if (!isFastSave(save) || save.owner !== pending[0].owner) break;
    bytes += JSON.stringify(save).length;
    changes += save.changes.length;
    if (bytes > 256000 || changes > 2000) break;
    batch.push(save);
  }
  return batch.length ? batch : pending.slice(0, 1);
}
