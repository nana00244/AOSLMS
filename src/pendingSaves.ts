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
  localOrder?: number;
}
export interface CachedWorkspaceSnapshot {
  owner: string;
  state: import('./data').State;
  revision: number;
  savedAt: string;
}
function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('aos-pending-saves', 2);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains('saves'))
        request.result.createObjectStore('saves', { keyPath: 'id' });
      if (!request.result.objectStoreNames.contains('snapshots'))
        request.result.createObjectStore('snapshots', { keyPath: 'owner' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function snapshotTransaction<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('snapshots', mode);
    const request = run(tx.objectStore('snapshots'));
    tx.oncomplete = () => {
      db.close();
      resolve(request.result);
    };
    tx.onerror = tx.onabort = () => {
      db.close();
      reject(tx.error || Error('Could not access the offline workspace copy'));
    };
  });
}
export const cacheWorkspaceSnapshot = (snapshot: CachedWorkspaceSnapshot) =>
  checkpointWorkspace(snapshot, []);
export const readWorkspaceSnapshot = (owner: string) =>
  snapshotTransaction('readonly', (store) => store.get(owner)) as Promise<
    CachedWorkspaceSnapshot | undefined
  >;
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
/** A save and the baseline needed to reopen it are committed together. */
export async function retainSave(
  save: PendingSave,
  baseline?: CachedWorkspaceSnapshot,
): Promise<void> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['saves', 'snapshots'], 'readwrite');
    const saves = tx.objectStore('saves');
    const read = saves.getAll();
    read.onsuccess = () => {
      const entries = read.result as PendingSave[];
      const existing = entries.find((entry) => entry.id === save.id);
      if (existing && existing.owner !== save.owner) {
        tx.abort();
        return;
      }
      const sameOwner = entries.filter((entry) => entry.owner === save.owner);
      saves.put({
        ...save,
        localOrder: existing
          ? existing.localOrder
          : Math.max(0, ...sameOwner.map((entry) => entry.localOrder || 0)) + 1,
      });
    };
    if (baseline) {
      if (baseline.owner !== save.owner) {
        tx.abort();
      } else putSnapshot(tx.objectStore('snapshots'), baseline);
    }
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = tx.onabort = () => {
      db.close();
      reject(tx.error || Error('Could not retain this save on this device'));
    };
  });
}

function putSnapshot(store: IDBObjectStore, snapshot: CachedWorkspaceSnapshot) {
  const current = store.get(snapshot.owner);
  current.onsuccess = () => {
    // A slow tab must not replace a newer confirmed workspace.
    if (!current.result || current.result.revision <= snapshot.revision) store.put(snapshot);
  };
}

/** Never remove receipts from the local queue before their visible result is durable. */
export async function checkpointWorkspace(
  snapshot: CachedWorkspaceSnapshot,
  ids: string[],
): Promise<void> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['saves', 'snapshots'], 'readwrite');
    putSnapshot(tx.objectStore('snapshots'), snapshot);
    const saves = tx.objectStore('saves');
    for (const id of ids) {
      const request = saves.get(id);
      request.onsuccess = () => {
        if (request.result?.owner === snapshot.owner) saves.delete(id);
      };
    }
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = tx.onabort = () => {
      db.close();
      reject(tx.error || Error('Could not retain the confirmed workspace on this device'));
    };
  });
}
export const forgetWorkspaceSnapshot = (owner: string) =>
  snapshotTransaction('readwrite', (store) => store.delete(owner));
export const removeSave = (id: string) => transact('readwrite', (s) => s.delete(id));
/** Atomically add recovery entries without replacing a newer local copy. */
export async function retainRecoveredSaves(saves: PendingSave[]): Promise<number> {
  const db = await open();
  return new Promise((resolve, reject) => {
    let added = 0;
    let failure: Error | undefined;
    const tx = db.transaction('saves', 'readwrite');
    const store = tx.objectStore('saves');
    const existing = store.getAll();
    existing.onsuccess = () => {
      const entries = new Map((existing.result as PendingSave[]).map((save) => [save.id, save]));
      const order = new Map<string, number>();
      for (const save of entries.values())
        order.set(save.owner, Math.max(order.get(save.owner) || 0, save.localOrder || 0));
      for (const save of saves) {
        const retained = entries.get(save.id);
        if (retained && retained.owner !== save.owner) {
          failure = Error(
            'A save identifier belongs to another local account. No entries were imported.',
          );
          tx.abort();
          return;
        }
        if (!retained) {
          const localOrder = (order.get(save.owner) || 0) + 1;
          const entry = { ...save, localOrder };
          order.set(save.owner, localOrder);
          entries.set(save.id, entry);
          store.add(entry);
          added++;
        }
      }
    };
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
    .sort((a, b) => {
      if (a.localOrder !== undefined && b.localOrder !== undefined)
        return a.localOrder - b.localOrder;
      if (a.localOrder !== undefined) return 1;
      if (b.localOrder !== undefined) return -1;
      return a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);
    });
}
