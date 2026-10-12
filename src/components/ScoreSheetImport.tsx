import { useState } from 'react';
import { useStore } from '../store';
import { classSubjects } from '../data';
import { canTeach } from '../backendAccess';
import { matchAttendanceClass } from '../attendanceImport';
import { matchScoreStudent, matchScoreSubject, type ScoreSheet } from '../scoreImport';
import { parseScoreCsv, parseScoreRows } from '../scoreSheetParser';
import { Button, Field, Modal } from './ui';

export function ScoreSheetImport({ onClose }: { onClose: () => void }) {
  const { data, user, allowedClasses, importScores } = useStore();
  const [sheet, setSheet] = useState<ScoreSheet | null>(null);
  const [classId, setClassId] = useState('');
  const [subject, setSubject] = useState('');
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const options = (cls: string) =>
    classSubjects(cls).filter(
      (s) => user?.role === 'Administrator' || (user && canTeach(user, cls, s)),
    );
  const pupils = data.students.filter((s) => s.classId === classId);
  const plan =
    sheet?.rows.map((row, index) => {
      const match = matchScoreStudent(row, data.students, classId);
      return { row, index, ...match, id: overrides[String(index)] ?? match.id };
    }) || [];
  const scored = plan.filter((p) => p.row.cells.length);
  const duplicates =
    new Set(scored.map((p) => p.id).filter(Boolean)).size !== scored.filter((p) => p.id).length;
  const unresolved = scored.some((p) => !p.id || !pupils.some((s) => s.id === p.id));
  const wrongTerm = sheet && sheet.term !== data.settings.term;
  return (
    <Modal
      title="Upload assessment score sheet"
      onClose={() => {
        if (!busy) onClose();
      }}
      wide
    >
      <p>
        Upload an exported CSV or a single-sheet Excel workbook. Review the matches, then save to
        update subject cards and report cards together. Blank cells keep existing marks; entered
        marks replace the same slots.
      </p>
      <Field label="Assessment score sheet (.csv or .xlsx)">
        <input
          type="file"
          accept=".csv,.xlsx"
          disabled={busy}
          onChange={async (event) => {
            const file = event.target.files?.[0];
            setSheet(null);
            setError('');
            setOverrides({});
            if (!file) return;
            setBusy(true);
            try {
              if (file.size > 5 * 1024 * 1024) throw new Error('Choose a file smaller than 5 MB');
              let parsed: ScoreSheet;
              if (file.name.toLowerCase().endsWith('.csv'))
                parsed = parseScoreCsv(await file.text());
              else if (file.name.toLowerCase().endsWith('.xlsx')) {
                const { default: read } = await import('read-excel-file/browser');
                const sheets = await read(file);
                if (sheets.length !== 1)
                  throw new Error(
                    'Upload one assessment sheet at a time; save each worksheet as a separate file',
                  );
                parsed = parseScoreRows(sheets[0].data);
              } else throw new Error('Choose a CSV or XLSX score sheet');
              const cls = matchAttendanceClass(parsed.className, allowedClasses) || '';
              setSheet(parsed);
              setClassId(cls);
              setSubject(matchScoreSubject(parsed.subject, options(cls)));
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Could not read score sheet');
            } finally {
              setBusy(false);
            }
          }}
        />
      </Field>
      {error && <p role="alert">{error}</p>}
      {sheet && (
        <>
          <p>
            <strong>File:</strong> {sheet.className} · {sheet.subject} · Term {sheet.term} ·{' '}
            {sheet.category}
          </p>
          <p>
            Saving to academic year {data.settings.year}, term {data.settings.term}.
          </p>
          {wrongTerm && (
            <p role="alert">
              This file is for a different term. Select the correct active term in school settings
              before uploading.
            </p>
          )}
          <div className="form-grid">
            <Field label="Matched class">
              <select
                value={classId}
                disabled={busy}
                onChange={(e) => {
                  setClassId(e.target.value);
                  setOverrides({});
                  setSubject(matchScoreSubject(sheet.subject, options(e.target.value)));
                }}
              >
                <option value="">Choose class</option>
                {allowedClasses.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>
            <Field label="Matched subject">
              <select value={subject} disabled={busy} onChange={(e) => setSubject(e.target.value)}>
                <option value="">Choose subject</option>
                {options(classId).map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </Field>
          </div>
          <p>
            {scored.length} students with marks or feedback · {plan.length - scored.length} blank
            rows left unchanged · {scored.reduce((n, p) => n + p.row.cells.length, 0)} assessment
            entries.
          </p>
          <div className="table-wrap" style={{ maxHeight: 380, overflow: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Student in file</th>
                  <th>Matched student</th>
                  <th>Match details</th>
                  <th>Entries</th>
                </tr>
              </thead>
              <tbody>
                {plan.map((p) => (
                  <tr key={p.index}>
                    <td>
                      {p.row.name}
                      <small className="muted"> {p.row.admission}</small>
                    </td>
                    <td>
                      {p.row.cells.length ? (
                        <select
                          aria-label={`Student match for row ${p.index + 1}`}
                          value={p.id}
                          disabled={busy || !classId}
                          onChange={(e) =>
                            setOverrides({ ...overrides, [p.index]: e.target.value })
                          }
                        >
                          <option value="">Choose student</option>
                          {pupils.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name} — {s.id}
                              {p.suggestion === s.id ? ' (suggested)' : ''}
                            </option>
                          ))}
                        </select>
                      ) : (
                        'Unchanged'
                      )}
                    </td>
                    <td>
                      {p.row.cells.length
                        ? overrides[String(p.index)]
                          ? 'Manually selected'
                          : p.reason
                        : 'Blank row'}
                    </td>
                    <td>{p.row.cells.length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {duplicates && (
            <p role="alert">
              Two rows match the same student. Correct the duplicate before saving.
            </p>
          )}
          {unresolved && <p role="alert">Resolve every student with marks before saving.</p>}
          <div className="modal-actions">
            <Button variant="ghost" disabled={busy} onClick={onClose}>
              Cancel
            </Button>
            <Button
              disabled={busy || !classId || !subject || unresolved || duplicates || !!wrongTerm}
              onClick={async () => {
                setBusy(true);
                setError('');
                try {
                  const saved = await importScores({
                    sheet,
                    classId,
                    subject,
                    studentOverrides: overrides,
                  });
                  if (saved) onClose();
                  else
                    setError(
                      'Upload was not saved. Review the save error, refresh records if needed, and try again.',
                    );
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? 'Saving…' : 'Save scores and update report cards'}
            </Button>
          </div>
        </>
      )}
    </Modal>
  );
}
