import { useState } from 'react';
import { ImportStudents } from '../components/RosterImport';
import { removeStudents } from '../studentRecords';
import { isSupabaseConfigured } from '../supabase';
import { Link } from 'react-router-dom';
import {
  Plus,
  Upload,
  Download,
  Eye,
  Pencil,
  Users,
  GraduationCap,
  School,
  Trash2,
  KeyRound,
} from 'lucide-react';
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
  const { data, update, notify, role } = useStore();
  const [selected, setSelected] = useState<string[]>([]);
  const [bulkAction, setBulkAction] = useState('');
  const [destination, setDestination] = useState('');
  const isAdmin = role === 'Administrator';
  const classList = data.classes || [];
  const [q, setQ] = useState(''),
    [cls, setCls] = useState('All classes'),
    [status, setStatus] = useState('All statuses'),
    [page, setPage] = useState(1),
    [edit, setEdit] = useState<Student | null>(null),
    [view, setView] = useState<Student | null>(null),
    [importing, setImporting] = useState(false),
    [selectedIds, setSelectedIds] = useState<string[]>([]),
    [reassignModalOpen, setReassignModalOpen] = useState(false),
    [reassignClass, setReassignClass] = useState(''),
    [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false),
    [singleDeleteStudent, setSingleDeleteStudent] = useState<Student | null>(null);
  const filtered = data.students.filter(
    (s) =>
      (s.name + ' ' + s.id).toLowerCase().includes(q.toLowerCase()) &&
      (cls === 'All classes' || s.classId === cls) &&
      (status === 'All statuses' || s.status === status),
  );
  const pages = Math.max(1, Math.ceil(filtered.length / 8));
  const current = Math.min(page, pages);
  const pageStudents = filtered.slice((current - 1) * 8, current * 8);
  const allPageSelected =
    pageStudents.length > 0 && pageStudents.every((s) => selectedIds.includes(s.id));

  const toggleSelectAll = () => {
    if (allPageSelected) {
      const pageIds = new Set(pageStudents.map((s) => s.id));
      setSelectedIds((prev) => prev.filter((id) => !pageIds.has(id)));
    } else {
      const pageIds = pageStudents.map((s) => s.id);
      setSelectedIds((prev) => [...new Set([...prev, ...pageIds])]);
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  async function handleReassign(target: string) {
    if (!target) return;
    const count = selectedIds.length;
    if (
      !(await update(
        (d) => ({
          ...d,
          students: d.students.map((s) =>
            selectedIds.includes(s.id) ? { ...s, classId: target } : s,
          ),
        }),
        `Reassigned ${count} student${count === 1 ? '' : 's'} to ${target}`,
      ))
    )
      return;
    notify(`Successfully reassigned ${count} student${count === 1 ? '' : 's'} to ${target}.`);
    setSelectedIds([]);
    setReassignModalOpen(false);
  }

  async function handleDeleteSelected() {
    const count = selectedIds.length;
    const idSet = new Set(selectedIds);
    if (
      !(await update(
        (d) => ({
          ...d,
          students: d.students.filter((s) => !idSet.has(s.id)),
        }),
        `Deleted ${count} student${count === 1 ? '' : 's'} from directory`,
      ))
    )
      return;
    notify(`Deleted ${count} student${count === 1 ? '' : 's'}. Changes saved to database.`);
    setSelectedIds([]);
    setDeleteConfirmOpen(false);
  }

  async function handleSingleDelete(s: Student) {
    if (
      !(await update(
        (d) => ({
          ...d,
          students: d.students.filter((item) => item.id !== s.id),
        }),
        `Deleted student: ${s.name} (${s.id})`,
      ))
    )
      return;
    notify(`Deleted student ${s.name}. Changes saved to database.`);
    setSelectedIds((prev) => prev.filter((id) => id !== s.id));
    setSingleDeleteStudent(null);
  }

  async function save(s: Student) {
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
    if (
      !(await update(
        (d) => ({
          ...d,
          students: d.students.some((x) => x.id === s.id)
            ? d.students.map((x) => (x.id === s.id ? s : x))
            : [...d.students, s],
        }),
        action,
      ))
    )
      return;
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
        {isAdmin && (
          <div className="filter-bar">
            <label>
              <input
                type="checkbox"
                aria-label="Select all filtered students"
                checked={!!filtered.length && filtered.every((s) => selected.includes(s.id))}
                onChange={(e) =>
                  setSelected(
                    e.target.checked
                      ? [...new Set([...selected, ...filtered.map((s) => s.id)])]
                      : selected.filter((id) => !filtered.some((s) => s.id === id)),
                  )
                }
              />{' '}
              Select all filtered students
            </label>
            <span>{selected.length} selected</span>
            <Button
              variant="secondary"
              disabled={!selected.length}
              onClick={() => setBulkAction('move')}
            >
              Reassign selected
            </Button>
            <Button
              variant="secondary"
              disabled={!selected.length}
              onClick={() => setBulkAction('delete')}
            >
              Delete selected
            </Button>
            {!!selected.length && (
              <Button variant="ghost" onClick={() => setSelected([])}>
                Clear selection
              </Button>
            )}
          </div>
        )}
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
        {selectedIds.length > 0 && (
          <div className="bulk-actions-bar" role="region" aria-label="Student batch operations">
            <div className="bulk-selection-count">
              <strong>{selectedIds.length}</strong> student{selectedIds.length === 1 ? '' : 's'}{' '}
              selected
            </div>
            <div className="bulk-action-buttons">
              <Button
                variant="secondary"
                onClick={() => {
                  setReassignClass(classList[0] || '');
                  setReassignModalOpen(true);
                }}
              >
                <School size={16} />
                Reassign to class
              </Button>
              <Button variant="danger" onClick={() => setDeleteConfirmOpen(true)}>
                <Trash2 size={16} />
                Delete selected ({selectedIds.length})
              </Button>
              <Button variant="ghost" onClick={() => setSelectedIds([])}>
                Deselect all
              </Button>
            </div>
          </div>
        )}
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th style={{ width: '42px', textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    aria-label="Select all students on current page"
                    checked={allPageSelected}
                    onChange={toggleSelectAll}
                  />
                </th>
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
              {pageStudents.map((s) => (
                <tr key={s.id} className={selectedIds.includes(s.id) ? 'is-selected' : ''}>
                  <td style={{ textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      aria-label={`Select ${s.name}`}
                      checked={selectedIds.includes(s.id)}
                      onChange={() => toggleSelectOne(s.id)}
                    />
                  </td>
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
                      {isAdmin && (
                        <Link
                          className="icon-btn"
                          to={`/users?student=${encodeURIComponent(s.id)}`}
                          aria-label={`Manage login for ${s.name}`}
                          title="Assign username or reset password"
                        >
                          <KeyRound size={16} />
                        </Link>
                      )}
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
                      <button
                        className="icon-btn"
                        aria-label={`Delete ${s.name}`}
                        title={`Delete ${s.name}`}
                        onClick={() => setSingleDeleteStudent(s)}
                      >
                        <Trash2 size={16} />
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
      {edit && <StudentForm student={edit} onClose={() => setEdit(null)} onSave={save} />}
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
      {reassignModalOpen && (
        <Modal
          title={`Reassign ${selectedIds.length} Student${selectedIds.length === 1 ? '' : 's'} to Class`}
          onClose={() => setReassignModalOpen(false)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleReassign(reassignClass);
            }}
          >
            <p>
              Select the new classroom stream for the <strong>{selectedIds.length}</strong> selected
              student{selectedIds.length === 1 ? '' : 's'}. This change will synchronize immediately
              with the school database.
            </p>
            <Field label="Target Class">
              <select
                value={reassignClass}
                onChange={(e) => setReassignClass(e.target.value)}
                required
              >
                {classList.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>
            <div className="modal-actions">
              <Button variant="secondary" type="button" onClick={() => setReassignModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">
                <School size={16} />
                Reassign to class
              </Button>
            </div>
          </form>
        </Modal>
      )}
      {deleteConfirmOpen && (
        <Modal
          title={`Delete ${selectedIds.length} Student${selectedIds.length === 1 ? '' : 's'}`}
          onClose={() => setDeleteConfirmOpen(false)}
        >
          <div>
            <p>
              Are you sure you want to permanently delete the <strong>{selectedIds.length}</strong>{' '}
              selected student record{selectedIds.length === 1 ? '' : 's'}?
            </p>
            <p className="muted" style={{ marginTop: '8px' }}>
              This will remove them from the student directory and synchronize the deletion directly
              with the Supabase deployment.
            </p>
            <div className="modal-actions">
              <Button variant="secondary" type="button" onClick={() => setDeleteConfirmOpen(false)}>
                Cancel
              </Button>
              <Button variant="danger" type="button" onClick={handleDeleteSelected}>
                <Trash2 size={16} />
                Delete {selectedIds.length} student{selectedIds.length === 1 ? '' : 's'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
      {singleDeleteStudent && (
        <Modal
          title={`Delete ${singleDeleteStudent.name}`}
          onClose={() => setSingleDeleteStudent(null)}
        >
          <div>
            <p>
              Are you sure you want to permanently delete{' '}
              <strong>{singleDeleteStudent.name}</strong> ({singleDeleteStudent.id})?
            </p>
            <p className="muted" style={{ marginTop: '8px' }}>
              This student record will be removed from the school directory and synced with the
              database.
            </p>
            <div className="modal-actions">
              <Button
                variant="secondary"
                type="button"
                onClick={() => setSingleDeleteStudent(null)}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                type="button"
                onClick={() => handleSingleDelete(singleDeleteStudent)}
              >
                <Trash2 size={16} />
                Delete student
              </Button>
            </div>
          </div>
        </Modal>
      )}
      {importing && <ImportStudents onClose={() => setImporting(false)} />}
      {isAdmin && bulkAction && (
        <Modal
          title={
            bulkAction === 'delete' ? 'Delete selected students?' : 'Reassign selected students'
          }
          onClose={() => setBulkAction('')}
        >
          <p>
            {selected.length} student(s):{' '}
            {data.students
              .filter((s) => selected.includes(s.id))
              .map((s) => s.name)
              .join(', ')}
          </p>
          {bulkAction === 'delete' ? (
            <p>
              This permanently removes their student records, attendance, grades, submissions,
              certificates, bills and payments. Linked student logins will be deactivated. This
              cannot be undone.
            </p>
          ) : (
            <>
              <p>
                Existing attendance, academic records, bills and payments stay with each student.
                Moving class does not bill fees.
              </p>
              <Field label="Destination class">
                <select value={destination} onChange={(e) => setDestination(e.target.value)}>
                  <option value="">Choose a class</option>
                  {classList.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </Field>
            </>
          )}
          <div className="modal-actions">
            <Button variant="secondary" onClick={() => setBulkAction('')}>
              Cancel
            </Button>
            <Button
              disabled={bulkAction === 'move' && !destination}
              onClick={async () => {
                if (
                  !(await update(
                    (d) =>
                      bulkAction === 'delete'
                        ? removeStudents(d, selected, !isSupabaseConfigured)
                        : {
                            ...d,
                            students: d.students.map((s) =>
                              selected.includes(s.id) ? { ...s, classId: destination } : s,
                            ),
                          },
                    `${bulkAction === 'delete' ? 'Deleted' : 'Reassigned'} ${selected.length} selected student(s)`,
                  ))
                )
                  return;
                setSelected([]);
                setBulkAction('');
                notify('Student update submitted.');
              }}
            >
              {bulkAction === 'delete' ? 'Confirm deletion' : 'Confirm reassignment'}
            </Button>
          </div>
        </Modal>
      )}
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
  const classList = data.classes || [];
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
