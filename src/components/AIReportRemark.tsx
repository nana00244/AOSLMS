import { useRef, useState } from 'react';
import { invokeBackend } from '../backend';
import { reportRemarkScores } from '../reportRemarks';
import { useStore } from '../store';
import type { Student } from '../data';
import { Button, Field, Modal } from './ui';

export function AIReportRemark({
  student,
  term,
  onClose,
}: {
  student: Student;
  term: number;
  onClose: () => void;
}) {
  const { data, user, update, pendingCount, notify } = useStore();
  const [remark, setRemark] = useState('');
  const [source, setSource] = useState('');
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const [error, setError] = useState('');
  const key = `${student.id}|${term}`;
  const [original] = useState(data.remarks[key] || '');
  let current = '';
  try {
    if (user) current = JSON.stringify(reportRemarkScores(data, user, student.id, term));
  } catch {}
  const stale = !!source && source !== current;
  const changed = (data.remarks[key] || '') !== original;
  async function generate() {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError('');
    try {
      const result = await invokeBackend('generate-report-remark', {
        studentId: student.id,
        term,
        provider: 'gemini',
      });
      setRemark(result.remark);
      setSource(JSON.stringify(result.scores));
    } catch (error) {
      setError((error as Error).message);
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  async function save() {
    if (locked.current || stale || changed || !remark.trim() || pendingCount) return;
    locked.current = true;
    setBusy(true);
    try {
      if (
        await update(
          (d) => ({
            ...d,
            remarks: { ...d.remarks, [key]: remark.trim() },
            verified: d.verified.filter((entry) => entry !== key),
          }),
          'Teacher reviewed and saved AI report remark',
        )
      ) {
        notify('Teacher remark saved.');
        onClose();
      }
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  return (
    <Modal
      title="AI teacher remark"
      onClose={() => {
        if (!locked.current) onClose();
      }}
      wide
    >
      <p>
        <strong>
          {student.name} · {student.classId} · Term {term}
        </strong>
      </p>
      <p>
        Generate a draft from saved scores in subjects you can access. Only subject names and scores
        are sent to DeepSeek through Dahl, with Gemini as backup if DeepSeek cannot generate a
        draft. Review and edit the wording before saving it to the report card.
      </p>
      {original && <p>Current remark: {original}</p>}
      <Button onClick={() => void generate()} disabled={busy || pendingCount > 0 || !current}>
        {busy ? 'Please wait…' : source ? 'Regenerate draft' : 'Generate draft'}
      </Button>
      {!current && <p>Save at least one accessible subject score first.</p>}
      {pendingCount > 0 && <p>Wait for pending saves to finish before generating or saving.</p>}
      {error && <p role="alert">{error}</p>}
      {source && (
        <Field label="Review teacher remark">
          <textarea
            rows={5}
            maxLength={1200}
            value={remark}
            disabled={busy}
            onChange={(e) => setRemark(e.target.value)}
          />
        </Field>
      )}
      {stale && <p role="alert">Scores have changed. Regenerate the draft before saving.</p>}
      {changed && (
        <p role="alert">
          The saved remark changed elsewhere. Close and reopen this window to review it.
        </p>
      )}
      <div className="form-actions">
        <Button variant="secondary" disabled={busy} onClick={onClose}>
          Cancel
        </Button>
        <Button
          disabled={busy || !source || !remark.trim() || stale || changed || pendingCount > 0}
          onClick={() => void save()}
        >
          Save teacher remark
        </Button>
      </div>
    </Modal>
  );
}
