import { useEffect, useState } from 'react';
import { useStore } from '../store';
import { invokeBackend } from '../backend';
import { parsePendingRecovery, recoveryFileLimit, type RecoveryRow } from '../pendingRecovery';
import type { PendingSave } from '../pendingSaves';
import { Button, Modal } from './ui';

function describe(value: unknown) {
  if (value === undefined) return '(not present)';
  const text = JSON.stringify(value);
  return text.length > 300 ? text.slice(0, 300) + '… (preview shortened)' : text;
}
export function RecoverPendingEntries() {
  const { user, recoverPendingEntries, pendingCount } = useStore();
  const [open, setOpen] = useState(false);
  const [saves, setSaves] = useState<PendingSave[]>([]);
  const [rows, setRows] = useState<RecoveryRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    setOpen(false);
    setSaves([]);
    setRows([]);
    setMessage('');
  }, [user?.id]);
  async function preview(file?: File) {
    if (!file || !user) return;
    setBusy(true);
    setRows([]);
    setSaves([]);
    setMessage('');
    try {
      if (file.size > recoveryFileLimit) throw Error('Choose a file smaller than 20 MB.');
      const parsed = parsePendingRecovery(await file.text(), user.id);
      const result = await invokeBackend('workspace', {
        action: 'preview-recovery',
        saves: parsed,
      });
      setSaves(parsed);
      setRows(result.rows);
      setMessage('Preview complete. No records have been written.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to preview file.');
    } finally {
      setBusy(false);
    }
  }
  async function recover() {
    setBusy(true);
    setMessage('');
    try {
      const result = await recoverPendingEntries(saves);
      setRows(result.rows);
      setMessage(
        result.remaining
          ? result.added +
              ' entries added to the recovery queue. ' +
              result.remaining +
              ' saves remain on this device; use the pending-save notice to retry or review conflicts.'
          : 'Recovery sync finished. No saves remain pending on this device. Conflicting or blocked file entries have not been imported.',
      );
      // Recheck receipts so completed rows cannot be mistaken for unsaved work.
      const checked = await invokeBackend('workspace', { action: 'preview-recovery', saves });
      setRows(checked.rows);
    } catch (error) {
      setMessage(
        (error instanceof Error ? error.message : 'Recovery could not finish.') +
          ' Any queued entries remain on this device; do not clear browser data.',
      );
    } finally {
      setBusy(false);
    }
  }
  if (!user) return null;
  const ready = rows.filter((row) => row.status === 'ready').length;
  return (
    <>
      <Button
        variant="secondary"
        onClick={() => {
          setOpen(true);
          setMessage('');
        }}
      >
        Recover pending entries
      </Button>
      {open && (
        <Modal
          title="Recover pending entries"
          onClose={() => {
            if (!busy) setOpen(false);
          }}
        >
          <p>
            Upload the downloaded <strong>pending-school-saves.json</strong> using the account that
            created it. This restores individual unsynced changes, not a full workspace backup.
          </p>
          <label>
            Pending entries file
            <input
              type="file"
              accept=".json,application/json"
              disabled={busy}
              onChange={(event) => {
                void preview(event.target.files?.[0]);
                event.target.value = '';
              }}
            />
          </label>
          <p>
            Up to 100 saves and 20 MB per file. Already-confirmed saves are skipped. Existing local
            entries are never overwritten.
          </p>
          {pendingCount > 0 && (
            <p>
              {pendingCount} saves are already queued on this device. They remain in the normal sync
              queue.
            </p>
          )}
          {message && <p role="status">{message}</p>}
          {busy && <p role="status">Checking or syncing entries. Please keep this window open…</p>}
          {rows.length > 0 && (
            <>
              <p>
                <strong>{ready} ready</strong> ·{' '}
                {rows.filter((r) => r.status === 'confirmed').length} already confirmed ·{' '}
                {rows.filter((r) => ['conflict', 'blocked'].includes(r.status)).length} need review
              </p>
              <div style={{ maxHeight: '45vh', overflowY: 'auto', overflowWrap: 'anywhere' }}>
                {rows.map((row) => {
                  const save = saves.find((s) => s.id === row.id)!;
                  return (
                    <details
                      key={row.id}
                      style={{ padding: '12px 0', borderBottom: '1px solid currentColor' }}
                    >
                      <summary>
                        <strong>{row.status.toUpperCase()}</strong> —{' '}
                        {save.event || 'School record update'} · {save.changes.length} changes
                      </summary>
                      <p>
                        {new Date(save.createdAt).toLocaleString()} · {row.reason}
                      </p>
                      {save.changes.map((change, index) => (
                        <div key={index}>
                          <strong>
                            {change.collection} / {change.id}
                          </strong>
                          <p>Previous: {describe(change.before)}</p>
                          <p>Proposed: {describe(change.after)}</p>
                        </div>
                      ))}
                      {save.scoreRequest && (
                        <p>
                          This save also contains score-import instructions, which are validated
                          before replay.
                        </p>
                      )}
                    </details>
                  );
                })}
              </div>
              <p>
                Conflicting and blocked entries stay in your file. Review the affected records
                before previewing again; this tool will not overwrite competing database changes.
              </p>
            </>
          )}
          <div className="modal-actions">
            <Button variant="secondary" disabled={busy} onClick={() => setOpen(false)}>
              Close
            </Button>
            <Button disabled={busy || !ready} onClick={() => void recover()}>
              Recover {ready || ''} ready entries and sync
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
