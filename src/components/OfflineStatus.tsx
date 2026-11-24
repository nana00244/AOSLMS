import { useEffect, useState } from 'react';
import { useOfflineApp } from '../offlineApp';
import { backup, useStore } from '../store';
import './offline-status.css';

export function OfflineStatus() {
  const { connected, workspaceCached, cacheError, pendingCount, data } = useStore();
  const shell = useOfflineApp();
  const [persistent, setPersistent] = useState(false);
  const [storageMessage, setStorageMessage] = useState('');
  useEffect(() => {
    void navigator.storage
      ?.persisted?.()
      .then(setPersistent)
      .catch(() => {});
  }, []);
  const prepared = shell.status === 'ready' && workspaceCached && !cacheError;
  return (
    <details className="offline-status">
      <summary>
        <span role="status" aria-live="polite">
          {!connected
            ? 'Offline — working on this device'
            : pendingCount
              ? `${pendingCount} save${pendingCount === 1 ? '' : 's'} waiting to sync`
              : prepared
                ? 'Ready for offline use'
                : 'Offline preparation incomplete'}
        </span>
      </summary>
      <div>
        <p>
          {prepared
            ? 'This app and your account’s workspace are saved on this device. Reopen the same link in this browser while signed in. Keep the app open after reconnecting until pending saves clear.'
            : 'Stay online and sign in until the app and workspace finish saving on this device. Offline access is available from the published HTTPS app.'}
        </p>
        <p>
          Attendance, coursework, reports, and school ledger edits are saved locally first. Account
          changes, AI, new file uploads, and server-graded activities need internet. Conflicting
          changes remain pending for review.
        </p>
        {cacheError && <p role="alert">{cacheError}</p>}
        {shell.updateAvailable && (
          <p>
            An app update is ready. Finish editing, then close all app tabs and reopen while online
            to install it.
          </p>
        )}
        <p>
          {persistent
            ? 'Persistent browser storage is enabled.'
            : 'Browser storage may be cleared automatically. Request persistent storage and keep a separate backup.'}{' '}
          Clearing site data, private browsing, or losing this device can remove unsynced work.
        </p>
        {!persistent && (
          <button
            type="button"
            onClick={async () => {
              try {
                const granted = await navigator.storage?.persist?.();
                setPersistent(Boolean(granted));
                setStorageMessage(
                  granted
                    ? 'Persistent storage enabled.'
                    : 'The browser did not grant persistent storage. Keep a separate backup.',
                );
              } catch {
                setStorageMessage('Persistent storage is unavailable in this browser.');
              }
            }}
          >
            Protect offline storage
          </button>
        )}
        <button type="button" onClick={() => void backup(data)}>
          Download workspace backup
        </button>
        {storageMessage && <p role="status">{storageMessage}</p>}
      </div>
    </details>
  );
}
