import { useEffect, useState } from 'react';
import { useStore } from '../store';
import { billKey, studentBill, money } from '../data';
import { Button, Modal, Field } from './ui';
export function BillingPanel() {
  const { data, update, notify, role } = useStore();
  const [open, setOpen] = useState(false),
    [mode, setMode] = useState('class'),
    [classId, setClassId] = useState(data.classes[0] || ''),
    [studentId, setStudentId] = useState(data.students[0]?.id || ''),
    [term, setTerm] = useState(data.settings.term),
    [replace, setReplace] = useState(false);
  const [items, setItems] = useState<Record<string, number>>({}),
    [concession, setConcession] = useState(0),
    [category, setCategory] = useState('');
  useEffect(() => {
    const student = data.students.find((s) => s.id === studentId);
    const bill = mode === 'student' ? studentBill(data, studentId, term) : undefined;
    setItems({
      ...(bill?.items ||
        data.fees[mode === 'class' ? classId : student?.classId || ''] || { Tuition: 0 }),
    });
    setConcession(bill?.concession || 0);
  }, [open, mode, classId, studentId, term, data]);
  if (!['Accountant', 'Administrator'].includes(role || '')) return null;
  const targets = data.students
    .filter((s) =>
      mode === 'class' ? s.classId === classId && s.status === 'Active' : s.id === studentId,
    )
    .filter((s) => mode === 'student' || replace || !studentBill(data, s.id, term));
  return (
    <>
      <div className="notice">
        <p>
          Enrollment and class transfers do not create bills. Fee templates are suggestions only.
        </p>
        <Button onClick={() => setOpen(true)}>Issue or edit student bills</Button>
      </div>
      {open && (
        <Modal title="Issue or edit student bills" onClose={() => setOpen(false)} wide>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!targets.length) return;
              update((d) => {
                const bills = { ...d.studentBills };
                for (const s of d.students.filter((s) => targets.some((t) => t.id === s.id))) {
                  const key = billKey(s.id, d.settings.year, term);
                  if (mode === 'class' && !replace && bills[key]) continue;
                  bills[key] = {
                    studentId: s.id,
                    year: d.settings.year,
                    term,
                    items: { ...items },
                    concession,
                    updatedAt: new Date().toISOString(),
                  };
                }
                return { ...d, studentBills: bills };
              }, `Student bills issued/edited: ${targets.length} student(s), ${data.settings.year}, term ${term}`);
              notify('Student billing update submitted.');
              setOpen(false);
            }}
          >
            <p>
              School year: {data.settings.year}. Bill amounts are fixed until explicitly edited,
              even if a student changes class or the fee template changes.
            </p>
            <div className="form-grid">
              <Field label="Bill by">
                <select value={mode} onChange={(e) => setMode(e.target.value)}>
                  <option value="class">Class</option>
                  <option value="student">Individual student</option>
                </select>
              </Field>
              {mode === 'class' ? (
                <Field label="Billing class">
                  <select required value={classId} onChange={(e) => setClassId(e.target.value)}>
                    <option value="">Choose class</option>
                    {data.classes.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </Field>
              ) : (
                <Field label="Billed student">
                  <select required value={studentId} onChange={(e) => setStudentId(e.target.value)}>
                    <option value="">Choose student</option>
                    {data.students.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} · {s.classId}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
              <Field label="Billing term">
                <select value={term} onChange={(e) => setTerm(Number(e.target.value))}>
                  {[1, 2, 3].map((t) => (
                    <option key={t} value={t}>
                      Term {t}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Bill concession (%)">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  required
                  value={concession}
                  onChange={(e) => setConcession(Number(e.target.value))}
                />
              </Field>
            </div>
            {mode === 'class' && (
              <label>
                <input
                  type="checkbox"
                  checked={replace}
                  onChange={(e) => setReplace(e.target.checked)}
                />{' '}
                Replace existing bills for this class and term (including individual adjustments)
              </label>
            )}
            <div className="form-grid">
              {Object.entries(items).map(([name, amount]) => (
                <Field key={name} label={`${name} billed (GH₵)`}>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={amount}
                    onChange={(e) => setItems({ ...items, [name]: Number(e.target.value) })}
                  />
                </Field>
              ))}
            </div>
            <Field label="New fee category">
              <input
                maxLength={150}
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              />
            </Field>
            <Button
              type="button"
              variant="secondary"
              disabled={!category.trim() || Object.hasOwn(items, category.trim())}
              onClick={() => {
                setItems({ ...items, [category.trim()]: 0 });
                setCategory('');
              }}
            >
              Add fee category
            </Button>
            <p>
              {targets.length} student(s) will be billed{' '}
              {money(Object.values(items).reduce((a, b) => a + b, 0) * (1 - concession / 100))}{' '}
              each. {mode === 'class' && !replace ? 'Already billed students are skipped.' : ''} Set
              an item to zero to remove its charge.
            </p>
            <div className="modal-actions">
              <Button type="submit" disabled={!targets.length}>
                Save student bills
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

