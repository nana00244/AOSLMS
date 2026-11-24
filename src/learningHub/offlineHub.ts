import type { HubReading, HubSnapshot } from './types';

export interface PendingReading extends HubReading {
  owner: string;
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('aos-offline-learning', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('entries');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function transaction<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>) {
  const db = await open();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction('entries', mode);
    const request = run(tx.objectStore('entries'));
    tx.oncomplete = () => {
      db.close();
      resolve(request.result);
    };
    tx.onabort = tx.onerror = () => {
      db.close();
      reject(tx.error || Error('Learning progress could not be saved on this device.'));
    };
  });
}

const key = (...parts: string[]) => JSON.stringify(parts);
export const cacheHub = (owner: string, snapshot: HubSnapshot) =>
  transaction('readwrite', (s) => s.put(snapshot, key('snapshot', owner)));
export const readCachedHub = (owner: string): Promise<HubSnapshot | undefined> =>
  transaction('readonly', (s) => s.get(key('snapshot', owner)));
/** Sign-out/access revocation clears the downloaded projection, never unsynced work. */
export const forgetCachedHub = (owner: string) =>
  transaction('readwrite', (s) => s.delete(key('snapshot', owner)));

export const retainReading = (reading: PendingReading) =>
  transaction('readwrite', (s) => s.put(reading, key('reading', reading.owner, reading.id)));
/** Cache the confirmed reading before retiring its local operation, in one commit. */
export async function acknowledgeReading(owner: string, pendingId: string, reading: HubReading) {
  const db = await open();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction('entries', 'readwrite');
    const store = tx.objectStore('entries');
    const cached = store.get(key('snapshot', owner));
    cached.onsuccess = () => {
      const snapshot = cached.result as HubSnapshot | undefined;
      if (snapshot)
        store.put(
          {
            ...snapshot,
            readings: [
              ...snapshot.readings.filter(
                (r) =>
                  !(
                    r.studentId === reading.studentId &&
                    r.lessonId === reading.lessonId &&
                    r.assignmentId === reading.assignmentId
                  ),
              ),
              reading,
            ],
          },
          key('snapshot', owner),
        );
      store.delete(key('reading', owner, pendingId));
    };
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onabort = tx.onerror = () => {
      db.close();
      reject(tx.error || Error('Could not confirm the saved reading on this device.'));
    };
  });
}
export async function readPendingReadings(owner: string): Promise<PendingReading[]> {
  const records = await transaction('readonly', (s) => s.getAll());
  return records.filter(
    (r): r is PendingReading => r?.owner === owner && typeof r?.lessonId === 'string',
  );
}
export const confirmAdaptive = (owner: string, id: string) =>
  transaction('readwrite', (s) => s.put(true, key('confirmed', owner, id)));
export const isAdaptiveConfirmed = (owner: string, id: string): Promise<boolean | undefined> =>
  transaction('readonly', (s) => s.get(key('confirmed', owner, id)));
