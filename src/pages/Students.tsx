import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Upload, Download, Eye, Pencil, Users, GraduationCap, School } from 'lucide-react';
import { classes, today, uid, type Student } from '../data';
import { useStore, csv } from '../store';
import {
  Button,
  Card,
  PageHeader,
  SearchBox,
  Badge,
  Person,
  Modal,
  Field,
  Empty,
  Stat,
} from '../components/ui';
export function Students() {
  const { data, update, notify } = useStore();
  const classList = data.classes || classes;
  const [q, setQ] = useState(''),
    [cls, setCls] = useState('All classes'),
    [status, setStatus] = useState('All statuses'),
    [page, setPage] = useState(1),
    [edit, setEdit] = useState<Student | null>(null),
    [view, setView] = useState<Student | null>(null),
    [importing, setImporting] = useState(false);
  const filtered = data.students.filter(
    (s) =>
      (s.name + ' ' + s.id).toLowerCase().includes(q.toLowerCase()) &&
      (cls === 'All classes' || s.classId === cls) &&
      (status === 'All statuses' || s.status === status),
  );
  const pages = Math.max(1, Math.ceil(filtered.length / 8));
  const current = Math.min(page, pages);
  function save(s: Student) {
    if (data.students.some((x) => x.id === s.id && x.id !== edit?.id)) {
      notify('This admission number already exists.');
      return;
    }
    const previous = data.students.find((student) => student.id === s.id);
    const action =
      previous && previous.classId !== s.classId
        ? `Student transferred: ${s.name} from ${previous.classId} to ${s.classId}`
        : previous
          ? `Student record updated: ${s.name}`
          : `Student admitted: ${s.name}`;
    update(
      (d) => ({
        ...d,
        students: d.students.some((x) => x.id === s.id)
          ? d.students.map((x) => (x.id === s.id ? s : x))
          : [...d.students, s],
      }),
      action,
    );
    setEdit(null);
    notify('Student record saved.');
  }
  return (
    <>
      <PageHeader
        eyebrow="PEOPLE & COMMUNITY"
        title="Student directory"
        description="Every learner has a story. Keep theirs in one place."
        actions={
          <>
            <Button variant="secondary" onClick={() => setImporting(true)}>
              <Upload size={16} />
              Bulk import
            </Button>
            <Button
              onClick={() =>
                setEdit({
                  id: '',
                  name: '',
                  classId: classList[0] || 'Basic 1 - Green',
                  gender: 'Female',
                  dob: '',
                  guardian: '',
                  phone: '',
                  status: 'Active',
                  enrolled: today(),
                })
              }
            >
              <Plus size={17} />
              New admission
            </Button>
          </>
        }
      />
      <div className="stats-grid three">
        <Stat label="Total students" value={data.students.length} icon={<Users />} />
        <Stat
          label="Active learners"
          value={data.students.filter((s) => s.status === 'Active').length}
          icon={<GraduationCap />}
          tone="green"
        />
        <Stat label="Classrooms" value={classList.length} icon={<School />} tone="blue" />
      </div>
      <Card>
        <div className="filter-bar">
          <SearchBox
            value={q}
            onChange={(v) => {
              setQ(v);
              setPage(1);
            }}
            placeholder="Search name or admission number..."
          />
          <select
            aria-label="Filter by class"
            value={cls}
            onChange={(e) => {
              setCls(e.target.value);
              setPage(1);
            }}
          >
            {['All classes', ...classList].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <select
            aria-label="Filter by status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            {['All statuses', 'Active', 'Inactive', 'Graduated'].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <Button
            variant="ghost"
            onClick={() =>
              csv('students.csv', [
                ['Admission No', 'Name', 'Class', 'Gender', 'Status'],
                ...filtered.map((s) => [s.id, s.name, s.classId, s.gender, s.status]),
              ])
            }
          >
            <Download size={16} />
            Export
          </Button>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Student</th>
                <th>Class / stream</th>
                <th>Guardian contact</th>
                <th>Gender</th>
                <th>Status</th>
                <th>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice((current - 1) * 8, current * 8).map((s) => (
                <tr key={s.id}>
                  <td>
                    <Person name={s.name} sub={s.id} photo={s.photo} />
                  </td>
                  <td>{s.classId}</td>
                  <td>{s.phone || s.guardian || '—'}</td>
                  <td>{s.gender}</td>
                  <td>
                    <Badge
                      tone={
                        s.status === 'Active' ? 'green' : s.status === 'Inactive' ? 'amber' : 'blue'
                      }
                    >
                      {s.status}
                    </Badge>
                  </td>
                  <td>
                    <div className="row-actions">
                      <button
                        className="icon-btn"
                        aria-label={`View ${s.name}`}
                        onClick={() => setView(s)}
                      >
                        <Eye size={18} />
                      </button>
                      <button
                        className="icon-btn"
                        aria-label={`Edit ${s.name}`}
                        onClick={() => setEdit(s)}
                      >
                        <Pencil size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!filtered.length && <Empty title="No students found" />}
        <div className="table-footer">
          <span>
            Showing {filtered.length ? (current - 1) * 8 + 1 : 0}–
            {Math.min(current * 8, filtered.length)} of {filtered.length} students
          </span>
          <div className="pagination">
            <Button
              variant="secondary"
              disabled={current === 1}
              onClick={() => setPage(current - 1)}
            >
              Previous
            </Button>
            <span>
              {current} / {pages}
            </span>
            <Button
              variant="secondary"
              disabled={current === pages}
              onClick={() => setPage(current + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      </Card>
      {cls !== 'All classes' && (
        <Card className="roster-summary">
          <h2>{cls} · Class roster</h2>
          <p>
            {data.students.filter((s) => s.classId === cls).length} / 40 seats ·{' '}
            {data.students.filter((s) => s.classId === cls && s.gender === 'Female').length} girls ·{' '}
            {data.students.filter((s) => s.classId === cls && s.gender === 'Male').length} boys
          </p>
          <p>Class teacher: {cls === classes[0] ? 'Sarah Mensah' : 'Alex Rivera'}</p>
        </Card>
      )}
      {edit && <StudentForm student={edit} onClose={() => setEdit(null)} onSave={save} />}{' '}
      {view && (
        <Modal title="Student profile" onClose={() => setView(null)}>
          <Person name={view.name} sub={view.id} photo={view.photo} />
          <dl className="detail-list">
            {[
              ['Class', view.classId],
              ['Status', view.status],
              ['Date of birth', view.dob],
              ['Guardian', view.guardian],
              ['Contact', view.phone],
              ['Enrolled', view.enrolled],
            ].map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v || 'Not provided'}</dd>
              </div>
            ))}
          </dl>
          <Link
            to={`/reports?student=${view.id}`}
            className="btn btn-primary"
            onClick={() => setView(null)}
          >
            View report card
          </Link>
        </Modal>
      )}
      {importing && <ImportStudents onClose={() => setImporting(false)} />}
    </>
  );
}
function StudentForm({
  student,
  onClose,
  onSave,
}: {
  student: Student;
  onClose: () => void;
  onSave: (s: Student) => void;
}) {
  const { data } = useStore();
  const classList = data.classes || classes;
  const [s, setS] = useState(student);
  return (
    <Modal title={student.id ? 'Edit student' : 'Welcome a new student'} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave({
            ...s,
            name: s.name.trim(),
            id: s.id.trim() || `AOS-2026-${uid().slice(0, 8).toUpperCase()}`,
          });
        }}
      >
        <div className="form-grid">
          <Field label="Full name">
            <input required value={s.name} onChange={(e) => setS({ ...s, name: e.target.value })} />
          </Field>
          <Field label="Admission number" hint="Leave blank to generate an ID.">
            <input
              disabled={!!student.id}
              value={s.id}
              onChange={(e) => setS({ ...s, id: e.target.value })}
            />
          </Field>
          <Field label="Class / stream">
            <select value={s.classId} onChange={(e) => setS({ ...s, classId: e.target.value })}>
              {classList.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field label="Gender">
            <select value={s.gender} onChange={(e) => setS({ ...s, gender: e.target.value })}>
              <option>Female</option>
              <option>Male</option>
            </select>
          </Field>
          <Field label="Date of birth">
            <input
              required
              type="date"
              max={today()}
              value={s.dob}
              onChange={(e) => setS({ ...s, dob: e.target.value })}
            />
          </Field>
          <Field label="Enrollment date">
            <input
              required
              type="date"
              value={s.enrolled}
              onChange={(e) => setS({ ...s, enrolled: e.target.value })}
            />
          </Field>
          <Field label="Guardian name">
            <input value={s.guardian} onChange={(e) => setS({ ...s, guardian: e.target.value })} />
          </Field>
          <Field label="Guardian phone">
            <input
              type="tel"
              value={s.phone}
              onChange={(e) => setS({ ...s, phone: e.target.value })}
            />
          </Field>
          <Field label="Status">
            <select
              value={s.status}
              onChange={(e) => setS({ ...s, status: e.target.value as Student['status'] })}
            >
              <option>Active</option>
              <option>Inactive</option>
              <option>Graduated</option>
            </select>
          </Field>
          <Field label="Student photograph">
            <input
              type="file"
              accept="image/png,image/jpeg"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                if (f.size > 500000) {
                  e.target.setCustomValidity('Please choose an image under 500 KB.');
                  return;
                }
                e.target.setCustomValidity('');
                const r = new FileReader();
                r.onload = () => setS({ ...s, photo: String(r.result) });
                r.readAsDataURL(f);
              }}
            />
          </Field>
        </div>
        <div className="modal-actions">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Save student</Button>
        </div>
      </form>
    </Modal>
  );
}
function ImportStudents({ onClose }: { onClose: () => void }) {
  const { data, update, notify } = useStore();
  const classList = data.classes || classes;
  const [targetClass, setTargetClass] = useState(classList[0] || 'Basic 6 - Gold');
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [nameColumn, setNameColumn] = useState<string>('');
  const [error, setError] = useState('');

  async function read(file?: File) {
    if (!file) return;
    try {
      if (file.size > 10 * 1024 * 1024) throw Error('Please choose a file smaller than 10 MB.');
      let parsed: Record<string, string>[];
      const fileName = file.name.toLowerCase();

      if (fileName.endsWith('.csv')) {
        const Papa = await import('papaparse');
        const text = await file.text();
        const result = Papa.default.parse<Record<string, string>>(text, {
          header: true,
          skipEmptyLines: true,
        });
        if (result.errors.length && !result.data.length) {
          throw Error('The CSV file could not be parsed. Please check the file format.');
        }
        parsed = result.data.filter((row) =>
          Object.values(row).some((val) => String(val).trim() !== ''),
        );
      } else {
        const readExcel = await import('read-excel-file/browser');
        const cells = await readExcel.readSheet(file);
        if (!cells || cells.length < 2)
          throw Error('The spreadsheet is empty or has no data rows.');
        const head = (cells[0] || []).map((h) => String(h || '').trim());
        parsed = cells
          .slice(1)
          .map((row) => Object.fromEntries(head.map((h, i) => [h, String(row[i] ?? '').trim()])))
          .filter((row) => Object.values(row).some((val) => val !== ''));
      }

      if (!parsed.length) throw Error('This spreadsheet has no student rows.');
      const rawHeads = Object.keys(parsed[0]).filter((h) => h.length > 0);
      setHeaders(rawHeads);
      setRows(parsed);

      // Auto-detect candidate name column
      const detectedNameCol =
        rawHeads.find((h) => {
          const lower = h.toLowerCase();
          return (
            lower === 'name' ||
            lower === 'full name' ||
            lower === 'fullname' ||
            lower === 'student name' ||
            lower === 'student' ||
            lower === 'learner' ||
            lower === 'pupil' ||
            lower === 'first name'
          );
        }) ||
        rawHeads[0] ||
        '';

      setNameColumn(detectedNameCol);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to read the file.');
    }
  }

  function importRows() {
    if (!nameColumn) {
      setError('Please select the column that contains the student names.');
      return;
    }
    if (!targetClass) {
      setError('Please select a class for the imported students.');
      return;
    }

    const seenIds = new Set(data.students.map((s) => s.id.toLowerCase()));
    const added: Student[] = [];
    let skipped = 0;

    rows.forEach((r, idx) => {
      const rawName = String(r[nameColumn] || '').trim();
      if (!rawName) {
        skipped++;
        return;
      }

      // Generate a unique clean ID
      let newId = `AOS-2026-${String(892 + data.students.length + idx + 1).padStart(4, '0')}`;
      while (seenIds.has(newId.toLowerCase())) {
        newId = `AOS-2026-${uid().slice(0, 6).toUpperCase()}`;
      }
      seenIds.add(newId.toLowerCase());

      added.push({
        id: newId,
        name: rawName,
        classId: targetClass,
        gender: 'Female',
        dob: '',
        guardian: '',
        phone: '',
        status: 'Active',
        enrolled: today(),
      });
    });

    if (!added.length) {
      setError('No valid student names found in the selected column.');
      return;
    }

    update(
      (d) => ({ ...d, students: [...d.students, ...added] }),
      `Imported ${added.length} students into ${targetClass}`,
    );
    notify(
      `Successfully imported ${added.length} student${added.length > 1 ? 's' : ''} into ${targetClass}. You can now edit full details in the directory.`,
    );
    onClose();
  }

  return (
    <Modal title="Import student roster" onClose={onClose} wide>
      <p>
        Upload any CSV or Excel file. Only the <strong>student name</strong> will be matched and
        imported. All other columns are safely ignored. You can edit remaining student details
        (gender, date of birth, guardian phone, etc.) anytime from the directory.
      </p>

      <div className="form-grid" style={{ marginBottom: 16 }}>
        <Field label="Assign to class (Available classes)">
          <select value={targetClass} onChange={(e) => setTargetClass(e.target.value)}>
            {classList.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="upload-zone">
        <Upload size={28} />
        <Field label="Choose file (.csv, .xlsx, .xls)">
          <input
            type="file"
            accept=".csv,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
            onChange={(e) => read(e.target.files?.[0])}
          />
        </Field>
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 8 }}>
        <Button
          variant="ghost"
          onClick={() =>
            csv('sample-student-list.csv', [
              ['Student Name'],
              ['Kofi Mensah'],
              ['Ama Serwaa'],
              ['Kwame Osei'],
              ['Abena Mansa'],
            ])
          }
        >
          <Download size={16} />
          Download simple sample CSV
        </Button>
      </div>

      {headers.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <h3>Match Student Name column · {rows.length} rows detected</h3>
          <div className="form-grid" style={{ marginTop: 8 }}>
            <Field
              label="Student Name column"
              hint="Only this column is matched. All other columns are ignored."
            >
              <select value={nameColumn} onChange={(e) => setNameColumn(e.target.value)}>
                <option value="">-- Select student name column --</option>
                {headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="notice" style={{ marginTop: 12 }}>
            Selected class for import: <strong>{targetClass}</strong> · {rows.length} records ready
            to import.
          </div>
        </div>
      )}

      {error && (
        <p className="error" role="alert" style={{ marginTop: 12 }}>
          {error}
        </p>
      )}

      <div className="modal-actions" style={{ marginTop: 20 }}>
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button disabled={!rows.length || !nameColumn} onClick={importRows}>
          Import {rows.length ? `${rows.length} students` : 'students'}
        </Button>
      </div>
    </Modal>
  );
}
