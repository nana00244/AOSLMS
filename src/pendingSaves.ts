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
export async function readPendingSaves(owner: string): Promise<PendingSave[]> {
  const all = (await transact('readonly', (s) => s.getAll())) as PendingSave[];
  return all
    .filter((s) => s.owner === owner)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}
