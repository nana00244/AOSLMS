import { expect, test, vi } from 'vitest';
import { decodePhoto, normalizePhotoChanges, storeStudentPhotos, photoPath } from './studentPhotos';
import { mergeSaveResult } from './saveAcknowledgement';
import { emptyState } from './emptyState';
const image = 'data:image/png;base64,aGVsbG8=';
test('migration-aware merge preserves unchanged old photos but leaves competing edits detectable', async () => {
  const { ref } = await decodePhoto(image);
  const before = { id: 's', photo: image, name: 'Old' };
  const [change] = await normalizePhotoChanges(
    [{ id: 's', photo: ref }],
    [{ collection: 'students', id: 's', before, after: { ...before, name: 'New' } }],
  );
  expect(change.before.photo).toBe(ref);
  expect(change.after.photo).toBe(ref);
  const [different] = await normalizePhotoChanges(
    [{ id: 's', photo: ref }],
    [
      {
        collection: 'students',
        id: 's',
        before,
        after: { ...before, photo: 'data:image/png;base64,d29ybGQ=' },
      },
    ],
  );
  expect(different.after.photo).not.toBe(ref);
  expect(() => photoPath('../other-bucket')).toThrow();
});
test('upload failure never produces a database reference; unchanged legacy photos are untouched', async () => {
  const upload = vi.fn().mockResolvedValue({ error: Error('offline') });
  const client = { storage: { from: () => ({ upload }) } };
  const students = [{ id: 's', photo: image }];
  await expect(storeStudentPhotos(client, students)).rejects.toThrow('offline');
  expect(students[0].photo).toBe(image);
  upload.mockClear();
  await storeStudentPhotos(client, students, students);
  expect(upload).not.toHaveBeenCalled();
});
test('partial confirmations never hide missed external changes behind an advanced revision', () => {
  const current = { state: emptyState(), revision: 2 };
  const ack = {
    confirmed: true as const,
    baseRevision: 3,
    revision: 4,
    changes: [{ collection: 'remarks', id: 's|1', after: 'Saved' }],
  };
  expect(mergeSaveResult(current, ack).revision).toBe(2);
  expect(mergeSaveResult(current, ack).state.remarks['s|1']).toBe('Saved');
  expect(mergeSaveResult({ ...current, revision: 3 }, ack).revision).toBe(4);
});
