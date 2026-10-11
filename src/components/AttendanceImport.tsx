import { useState } from 'react';
import { useStore } from '../store';
import { Modal, Button, Field } from './ui';
import {
  parseAttendanceFile,
  matchAttendanceClass,
  matchAttendanceStudents,
  attendanceImportEntries,
  type AttendanceFile,
} from '../attendanceImport';

export function AttendanceImport({
  onClose,
  onImported,
}: {
  onClose: () => void;
  onImported: (classId: string, month: string, term: number) => void;
}) {
  const { data, allowedClasses, update, notify } = useStore();
  const [file, setFile] = useState<AttendanceFile>();
  const [classId, setClassId] = useState('');
  const [term, setTerm] = useState(data.settings.term);
  const [error, setError] = useState('');
  const [reading, setReading] = useState(false);
  const matches = file ? matchAttendanceStudents(file, data.students, classId) : [];
  const entries = file ? attendanceImportEntries(file, data.students, classId, term) : {};
  const changed = Object.entries(entries).filter(([key, value]) => data.attendance[key] !== value);
  const replaced = changed.filter(([key]) => data.attendance[key]).length;
  const matched = matches.filter((m) => m.student).length;
  return (
    <Modal title="Import monthly attendance" onClose={onClose} wide>
      <p>
        Upload a CSV monthly register with a class/month heading, Student Name and daily columns
        such as Sep 08. Unmatched or ambiguous students are skipped. Only recognised daily marks are
        imported.
      </p>
      <Field label="Attendance CSV file">
        <input
          type="file"
          accept=".csv,text/csv"
          disabled={reading}
          onChange={async (e) => {
            const selected = e.target.files?.[0];
            setFile(undefined);
            setError('');
            setClassId('');
            if (!selected) return;
            if (selected.size > 5 * 1024 * 1024) {
              setError('Choose a CSV smaller than 5 MB.');
              return;
            }
            setReading(true);
            try {
              const parsed = parseAttendanceFile(await selected.text(), selected.name);
              setFile(parsed);
              setClassId(matchAttendanceClass(parsed.className, allowedClasses));
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Could not read the CSV.');
            } finally {
              setReading(false);
            }
          }}
        />
      </Field>
      {error && <p role="alert">{error}</p>}
      {file && (
        <>
          <p>
            File class: <strong>{file.className || 'Not specified'}</strong> · Month:{' '}
            <strong>{file.month}</strong>
          </p>
          <div className="form-grid">
            <Field label="Import into class">
              <select value={classId} onChange={(e) => setClassId(e.target.value)}>
                <option value="">Choose the matching class</option>
                {allowedClasses.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>
            <Field label="Attendance term">
              <select value={term} onChange={(e) => setTerm(Number(e.target.value))}>
                {[1, 2, 3].map((t) => (
                  <option key={t} value={t}>
                    Term {t}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          {!classId && <p>Select a class to resolve the missing or ambiguous class match.</p>}
          <p>
            {matched} matched students · {matches.length - matched} skipped rows · {changed.length}{' '}
            attendance updates ({replaced} replace existing marks). {file.ignoredCells} unrecognised
            cells skipped; blanks leave existing marks unchanged.
          </p>
          <p>
            Check the class, month, term and matches below before importing. Students missing from
            this file keep their existing attendance.
          </p>
          <div className="table-scroll" style={{ maxHeight: 320, overflow: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>File student</th>
                  <th>Matched student</th>
                  <th>Match</th>
                  <th>Daily marks</th>
                </tr>
              </thead>
              <tbody>
                {matches.map((m, i) => (
                  <tr key={i}>
                    <td>{m.row.name}</td>
                    <td>{m.student ? `${m.student.name} (${m.student.id})` : 'Skipped'}</td>
                    <td>{m.method}</td>
                    <td>{Object.keys(m.row.marks).length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="modal-actions">
            <Button
              disabled={!classId || !allowedClasses.includes(classId) || !changed.length}
              onClick={() => {
                update(
                  (d) => ({
                    ...d,
                    attendance: {
                      ...d.attendance,
                      ...attendanceImportEntries(file, d.students, classId, term),
                    },
                  }),
                  `Attendance CSV imported: ${classId}, ${file.month}, term ${term}`,
                );
                notify('Attendance import submitted.');
                onImported(classId, file.month, term);
                onClose();
              }}
            >
              Import {changed.length} attendance records
            </Button>
          </div>
        </>
      )}
    </Modal>
  );
}
