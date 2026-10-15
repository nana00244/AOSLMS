import type { Change } from './backendAccess';
import type { ScoreImportRequest } from './scoreImport';
export interface PendingSave {
  id: string;
  owner: string;
  createdAt: string;
  changes: Change[];
  event?: string;
  scoreRequest?: ScoreImportRequest;
  conflict?: string;
}
function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('aos-pending-saves', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('saves', { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function transact<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('saves', mode);
    const request = fn(tx.objectStore('saves'));
    tx.oncomplete = () => {
      db.close();
      resolve(request.result);
    };
    tx.onerror = tx.onabort = () => {
      db.close();
      reject(tx.error || new Error('Could not retain this save on this device'));
    };
  });
}
export const retainSave = (save: PendingSave) => transact('readwrite', (s) => s.put(save));
export const removeSave = (id: string) => transact('readwrite', (s) => s.delete(id));
/** Atomically add recovery entries without replacing a newer local copy. */
export async function retainRecoveredSaves(saves: PendingSave[]): Promise<number> {
  const db = await open();
  return new Promise((resolve, reject) => {
    let added = 0;
    let failure: Error | undefined;
    const tx = db.transaction('saves', 'readwrite');
    const store = tx.objectStore('saves');
    for (const save of saves) {
      const existing = store.get(save.id);
      existing.onsuccess = () => {
        if (existing.result && existing.result.owner !== save.owner) {
          failure = Error(
            'A save identifier belongs to another local account. No entries were imported.',
          );
          tx.abort();
          return;
        }
        if (!existing.result) {
          store.add(save);
          added++;
        }
      };
    }
    tx.oncomplete = () => {
      db.close();
      resolve(added);
    };
    tx.onerror = tx.onabort = () => {
      db.close();
      reject(failure || tx.error || Error('Could not retain recovered entries.'));
    };
  });
}
export async function readPendingSaves(owner: string): Promise<PendingSave[]> {
  const all = (await transact('readonly', (s) => s.getAll())) as PendingSave[];
  return all
    .filter((s) => s.owner === owner)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}
