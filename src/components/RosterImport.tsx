import { useState } from 'react';
import { useStore } from '../store';
import { Modal, Button, Field } from './ui';
import {
  parseRosterSheets,
  initialRosterClasses,
  planRoster,
  applyRoster,
  type RosterRow,
} from '../rosterImport';
export function ImportStudents({ onClose }: { onClose: () => void }) {
  const { data, update, notify } = useStore();
  const [rows, setRows] = useState<RosterRow[]>([]),
    [mapping, setMapping] = useState<Record<string, string>>({}),
    [error, setError] = useState(''),
    [reading, setReading] = useState(false);
  const plan = planRoster(rows, data.students, mapping);
  const count = (action: string) => plan.filter((p) => p.action === action).length;
  return (
    <Modal title="Import student roster" onClose={onClose} wide>
      <p>
        Upload an Excel workbook with multiple class sheets or a CSV with Full Name and Class
        columns. New students will be created; existing students will be moved only if their class
        differs. Students absent from the file remain unchanged. Repeated master/class-sheet entries
        are counted once.
      </p>
      <Field label="Roster file (.xlsx or .csv)">
        <input
          type="file"
          accept=".xlsx,.csv"
          disabled={reading}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            setRows([]);
            setError('');
            if (!file) return;
            setReading(true);
            try {
              if (file.size > 10 * 1024 * 1024)
                throw new Error('Choose a file smaller than 10 MB.');
              let sheets;
              if (file.name.toLowerCase().endsWith('.csv')) {
                const { default: Papa } = await import('papaparse');
                const parsed = Papa.parse<string[]>(await file.text(), {
                  skipEmptyLines: 'greedy',
                });
                if (parsed.errors.length) throw new Error('The CSV is malformed.');
                sheets = [{ sheet: 'CSV', data: parsed.data }];
              } else if (file.name.toLowerCase().endsWith('.xlsx')) {
                const { default: read } = await import('read-excel-file/browser');
                sheets = await read(file);
              } else throw new Error('Use an .xlsx workbook or CSV file.');
              const parsed = parseRosterSheets(sheets);
              setRows(parsed);
              setMapping(initialRosterClasses(parsed, data.classes));
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Could not read file.');
            } finally {
              setReading(false);
            }
          }}
        />
      </Field>
      {error && <p role="alert">{error}</p>}
      {!!rows.length && (
        <>
          <h3>Class matches</h3>
          <div className="form-grid">
            {Object.keys(mapping).map((source) => (
              <Field key={source} label={`Class for ${source}`}>
                <select
                  value={mapping[source]}
                  onChange={(e) => setMapping({ ...mapping, [source]: e.target.value })}
                >
                  <option value="">Skip / choose class</option>
                  {[...new Set([...data.classes,...rows.map(r=>r.className),...Object.values(mapping).filter(Boolean)])].map(c=><option key={c} value={c}>{data.classes.includes(c)?c:`Create class: ${c}`}</option>)}
                </select>
              </Field>
            ))}
          </div>
          <p>
            {count('create')} new students · {count('move')} class changes · {count('unchanged')}{' '}
            already in class · {count('skip')} skipped
          </p>
          <p>
            Review close name matches and class changes before saving. No fees or login accounts are
            created by this import.
          </p>
          <div className="table-scroll" style={{ maxHeight: 340, overflow: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>File student</th>
                  <th>Existing student</th>
                  <th>Target class</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {plan.map((p, i) => (
                  <tr key={i}>
                    <td>{p.row.name}</td>
                    <td>{p.student?.name || '—'}</td>
                    <td>{p.classId || '—'}</td>
                    <td>
                      {p.action} · {p.reason}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="modal-actions">
            <Button
              disabled={!count('create') && !count('move')}
              onClick={() => {
                update(
                  (d) => applyRoster(d, rows, mapping),
                  'Class rosters imported from workbook',
                );
                notify('Roster update submitted.');
                onClose();
              }}
            >
              Apply roster updates
            </Button>
          </div>
        </>
      )}
    </Modal>
  );
}

