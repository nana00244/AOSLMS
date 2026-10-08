import { useState } from 'react';
import {
  Plus,
  Printer,
  ShieldCheck,
  CalendarDays,
  User,
  MapPin,
  FileText,
  Download,
  Eye,
  Upload,
  Search,
  Award,
  MessageSquare,
  BookOpen,
  ArrowLeft,
  ArrowRight,
  School,
  Pencil,
  Trash2,
  Users,
  GraduationCap,
} from 'lucide-react';
import { useStore, download } from '../store';
import { classes, subjects, today, uid, conflicts, type Period, type Resource } from '../data';
import {
  PageHeader,
  Button,
  Card,
  CardTitle,
  Badge,
  Modal,
  Field,
  SearchBox,
  Tabs,
  Empty,
  Person,
  Stat,
} from '../components/ui';
const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
export function Timetable() {
  const { data, role, allowedClasses, update, notify } = useStore();
  const [cls, setCls] = useState(allowedClasses[0]),
    [teacher, setTeacher] = useState('All teachers'),
    [editing, setEditing] = useState<Period | null>(null),
    [error, setError] = useState(''),
    [day, setDay] = useState('Monday'),
    [week, setWeek] = useState(0);
  const periods = data.periods.filter(
    (p) => p.classId === cls && (teacher === 'All teachers' || p.teacher === teacher),
  );
  const teachers = [...new Set(data.periods.map((p) => p.teacher))];
  const base = new Date();
  base.setDate(base.getDate() - ((base.getDay() + 6) % 7) + week * 7);
  const end = new Date(base);
  end.setDate(end.getDate() + 4);
  const times = ['08:00', '09:00', '10:00', '11:30', '12:30', '13:30', '14:30'];
  const extra = [...new Set(periods.map((p) => p.start).filter((t) => !times.includes(t)))];
  const startTimes = [...times, ...extra].sort();
  return (
    <>
      <PageHeader
        eyebrow="A LITTLE STRUCTURE, A LOT OF POSSIBILITY"
        title="Master timetable"
        description={`Academic year ${data.settings.year} · Term ${data.settings.term}`}
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                const found = data.periods.some((p, i) =>
                  data.periods.slice(i + 1).some((other) => conflicts(p, other)),
                );
                notify(
                  found
                    ? 'Schedule conflicts found. Edit overlapping periods to resolve them.'
                    : 'All clear — no teacher, room, or class conflicts found.',
                );
              }}
            >
              <ShieldCheck size={16} />
              Conflict audit
            </Button>
            <Button variant="secondary" onClick={() => window.print()}>
              <Printer size={16} />
              Print
            </Button>
            {role === 'Administrator' && (
              <Button
                onClick={() => {
                  setError('');
                  setEditing({
                    id: '',
                    day: 'Monday',
                    start: '08:00',
                    end: '09:00',
                    classId: cls,
                    subject: subjects[0],
                    teacher: teachers[0] || 'Sarah Mensah',
                    room: 'Room 102',
                  });
                }}
              >
                <Plus size={16} />
                Add period
              </Button>
            )}
          </>
        }
      />
      <Card className="filter-bar">
        <select aria-label="Timetable class" value={cls} onChange={(e) => setCls(e.target.value)}>
          {allowedClasses.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <select
          aria-label="Filter teacher"
          value={teacher}
          onChange={(e) => setTeacher(e.target.value)}
        >
          {['All teachers', ...teachers].map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
        <div className="week-picker">
          <button className="icon-btn" aria-label="Previous week" onClick={() => setWeek(week - 1)}>
            <ArrowLeft size={17} />
          </button>
          <span>
            {base.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} –{' '}
            {end.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
          </span>
          <button className="icon-btn" aria-label="Next week" onClick={() => setWeek(week + 1)}>
            <ArrowRight size={17} />
          </button>
        </div>
      </Card>
      <div className="mobile-days">
        <Tabs items={days} value={day} onChange={setDay} />
      </div>
      <div className="timetable-wrap print-area">
        <div className="timetable">
          <div className="time-label">TIME</div>
          {days.map((d) => (
            <div key={d} className={`day-label ${d === day ? 'chosen-day' : ''}`}>
              {d.slice(0, 3)}
              <small>{d}</small>
            </div>
          ))}
          <div className="time-label">07:30</div>
          {days.map((d) => (
            <div key={d} className={`schedule-break ${d === day ? 'chosen-day' : ''}`}>
              Morning assembly
            </div>
          ))}
          {startTimes.map((time, i) => (
            <div className="timetable-row" key={time}>
              <div className="time-label">{time}</div>
              {days.map((d, j) => {
                const slots = periods.filter((p) => p.day === d && p.start === time);
                return (
                  <div key={d} className={`schedule-cell ${d === day ? 'chosen-day' : ''}`}>
                    {slots.length ? (
                      slots.map((p) => (
                        <button
                          disabled={role !== 'Administrator'}
                          className={`period-card tone-${(i + j) % 4}`}
                          key={p.id}
                          onClick={() => {
                            setError('');
                            setEditing(p);
                          }}
                        >
                          <span className="period-subject">{p.subject}</span>
                          <span>
                            <User size={12} />
                            {p.teacher}
                          </span>
                          <span>
                            <MapPin size={12} />
                            {p.room}
                          </span>
                          <small>
                            {p.start} – {p.end}
                          </small>
                        </button>
                      ))
                    ) : (
                      <div className="free-period">Independent study</div>
                    )}
                  </div>
                );
              })}
              {time === '10:00' && (
                <>
                  <div className="time-label">11:00</div>
                  {days.map((d) => (
                    <div
                      key={d}
                      className={`schedule-break lunch ${d === day ? 'chosen-day' : ''}`}
                    >
                      Lunch & recess
                    </div>
                  ))}
                </>
              )}
            </div>
          ))}
        </div>
      </div>
      <div className="notice">
        <CalendarDays size={18} />
        Weekly schedule repeats throughout the active term.{' '}
        {role === 'Administrator'
          ? 'Select a period to edit its subject, teacher, or room.'
          : 'Your class schedule, all in one place.'}
      </div>
      {editing && (
        <Modal
          title={editing.id ? 'Edit period' : 'Add a teaching period'}
          onClose={() => setEditing(null)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const p: Period = {
                id: editing.id || uid(),
                day: String(f.get('day')),
                start: String(f.get('start')),
                end: String(f.get('end')),
                classId: String(f.get('class')),
                subject: String(f.get('subject')),
                teacher: String(f.get('teacher')).trim(),
                room: String(f.get('room')).trim(),
              };
              if (p.start >= p.end) {
                setError('The end time must be after the start time.');
                return;
              }
              const clash = data.periods.find((x) => conflicts(p, x));
              if (clash) {
                setError(
                  `Conflict: ${clash.teacher} teaches ${clash.subject} in ${clash.classId}, ${clash.room}, from ${clash.start}–${clash.end}. Choose another time, room, or teacher.`,
                );
                return;
              }
              update(
                (s) => ({ ...s, periods: [...s.periods.filter((x) => x.id !== p.id), p] }),
                'Timetable period saved',
              );
              notify('Period saved. No scheduling conflicts.');
              setEditing(null);
            }}
          >
            <div className="form-grid">
              <Field label="Day">
                <select name="day" defaultValue={editing.day}>
                  {days.map((d) => (
                    <option key={d}>{d}</option>
                  ))}
                </select>
              </Field>
              <Field label="Class">
                <select name="class" defaultValue={editing.classId}>
                  {(data.classes || classes).map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </Field>
              <Field label="Subject">
                <select name="subject" defaultValue={editing.subject}>
                  {[...subjects, 'Social Studies', 'Sports', 'Library'].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </Field>
              <Field label="Teacher">
                <input name="teacher" required defaultValue={editing.teacher} list="teachers" />
                <datalist id="teachers">
                  {teachers.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </datalist>
              </Field>
              <Field label="Start time">
                <input required type="time" name="start" defaultValue={editing.start} />
              </Field>
              <Field label="End time">
                <input required type="time" name="end" defaultValue={editing.end} />
              </Field>
              <Field label="Room">
                <input required name="room" defaultValue={editing.room} />
              </Field>
            </div>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <div className="modal-actions">
              {editing.id && (
                <Button
                  variant="danger"
                  type="button"
                  onClick={() => {
                    update(
                      (d) => ({ ...d, periods: d.periods.filter((p) => p.id !== editing.id) }),
                      'Timetable period removed',
                    );
                    setEditing(null);
                    notify('Period removed.');
                  }}
                >
                  Remove period
                </Button>
              )}
              <Button type="submit">Save period</Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
export function Resources() {
  const { data, role, allowedClasses } = useStore();
  const [tab, setTab] = useState('All resources'),
    [q, setQ] = useState(''),
    [cls, setCls] = useState(allowedClasses[0]),
    [upload, setUpload] = useState(false),
    [view, setView] = useState<Resource | null>(null);
  const resources = data.resources.filter(
    (r) =>
      r.classId === cls &&
      allowedClasses.includes(r.classId) &&
      (tab === 'All resources' || r.category === tab) &&
      (r.title + ' ' + r.subject).toLowerCase().includes(q.toLowerCase()),
  );
  return (
    <>
      <PageHeader
        eyebrow="A WORLD OF IDEAS"
        title="Resource library"
        description="Good resources open doors. Find your next discovery here."
        actions={
          role !== 'Student' && (
            <Button onClick={() => setUpload(true)}>
              <Plus size={17} />
              Add resource
            </Button>
          )
        }
      />
      <Tabs
        items={['All resources', 'Lecture Notes', 'Worksheets', 'Syllabus Guides']}
        value={tab}
        onChange={setTab}
      />
      <div className="filter-bar resource-filter">
        <SearchBox value={q} onChange={setQ} placeholder="Find a resource..." />
        <select aria-label="Resource class" value={cls} onChange={(e) => setCls(e.target.value)}>
          {allowedClasses.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <span className="muted">{resources.length} resources</span>
      </div>
      <div className="resource-grid">
        {resources.map((r, i) => (
          <Card className="resource-card" key={r.id}>
            <div className={`resource-cover tone-${i % 4}`}>
              <div className="document-art">
                <FileText size={33} />
                <span>{r.type}</span>
              </div>
              <span className="resource-type">{r.category}</span>
            </div>
            <div className="resource-content">
              <small>{r.subject}</small>
              <h3>{r.title}</h3>
              <div className="resource-bottom">
                <span>{r.date}</span>
                <div className="row-actions">
                  <button
                    className="icon-btn"
                    aria-label={`View ${r.title}`}
                    onClick={() => setView(r)}
                  >
                    <Eye size={18} />
                  </button>
                  <button
                    className="icon-btn"
                    aria-label={`Download ${r.title}`}
                    onClick={() =>
                      r.url
                        ? window.open(r.url, '_blank', 'noopener,noreferrer')
                        : download(r.filename || `${r.title}.txt`, r.content)
                    }
                  >
                    <Download size={17} />
                  </button>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
      {!resources.length && (
        <Empty title="Room for new ideas" text="No resources match these filters." />
      )}
      <div className="library-note">
        <BookOpen size={22} />
        <div>
          <strong>A space for your classroom</strong>
          <p>Materials here are shared with {cls}. Explore, practise, and ask questions.</p>
        </div>
      </div>
      {view && (
        <Modal title={view.title} onClose={() => setView(null)}>
          <Badge tone="blue">{view.category}</Badge>
          {view.url ? (
            <>
              <p>Open this learning resource in a new tab.</p>
              <a className="btn btn-primary" href={view.url} target="_blank" rel="noreferrer">
                Open resource ↗
              </a>
            </>
          ) : (
            <>
              <pre className="resource-preview">{view.content}</pre>
              <Button onClick={() => download(view.filename || `${view.title}.txt`, view.content)}>
                <Download size={16} />
                Download resource
              </Button>
            </>
          )}
        </Modal>
      )}
      {upload && <ResourceForm cls={cls} onClose={() => setUpload(false)} />}
    </>
  );
}
function ResourceForm({ cls, onClose }: { cls: string; onClose: () => void }) {
  const { allowedClasses, update, notify } = useStore();
  const [content, setContent] = useState(''),
    [filename, setFilename] = useState(''),
    [error, setError] = useState('');
  return (
    <Modal title="Share a classroom resource" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const url = String(f.get('url'));
          if (!url && !content.trim()) {
            setError('Add a handout, text file, or resource link.');
            return;
          }
          const r: Resource = {
            id: uid(),
            title: String(f.get('title')),
            subject: String(f.get('subject')),
            classId: String(f.get('class')),
            category: String(f.get('category')),
            type: url ? 'LINK' : 'TXT',
            date: today(),
            content,
            url,
            filename: filename || undefined,
          };
          update((d) => ({ ...d, resources: [r, ...d.resources] }), `Resource shared: ${r.title}`);
          notify('Resource shared with the class.');
          onClose();
        }}
      >
        <Field label="Resource title">
          <input name="title" required />
        </Field>
        <div className="form-grid">
          <Field label="Class">
            <select name="class" defaultValue={cls}>
              {allowedClasses.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field label="Category">
            <select name="category">
              <option>Lecture Notes</option>
              <option>Worksheets</option>
              <option>Syllabus Guides</option>
            </select>
          </Field>
          <Field label="Subject">
            <select name="subject">
              {subjects.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
          <Field label="Resource or video link">
            <input name="url" type="url" pattern="https?://.*" placeholder="https://..." />
          </Field>
        </div>
        <Field label="Text handout">
          <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={4} />
        </Field>
        <Field
          label="Or upload a text handout"
          hint="Text files up to 500 KB. For PDFs, Office files, or videos, use a hosted resource link."
        >
          <input
            type="file"
            accept=".txt,.md"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              if (f.size > 500000) {
                setError('Choose a text file under 500 KB.');
                return;
              }
              setContent(await f.text());
              setFilename(f.name);
              setError('');
            }}
          />
        </Field>
        {error && <p className="error">{error}</p>}
        <div className="modal-actions">
          <Button type="submit">Share resource</Button>
        </div>
      </form>
    </Modal>
  );
}
const awards = [
  'Academic Excellence',
  'Perfect Attendance & Punctuality',
  'Leadership & Service',
  'Sports, Arts & Cultural Distinction',
];
export function Certificates() {
  const { data, role, ownId, allowedClasses, update, notify } = useStore();
  const [create, setCreate] = useState(false),
    [view, setView] = useState('');
  const students = data.students.filter(
    (s) => allowedClasses.includes(s.classId) && (role !== 'Student' || s.id === ownId),
  );
  const certs = data.certificates.filter((c) => students.some((s) => s.id === c.studentId));
  const current = certs.find((c) => c.id === view);
  return (
    <>
      <PageHeader
        eyebrow="MOMENTS WORTH CELEBRATING"
        title="Certificates & honours"
        description="Recognise effort. Celebrate growth. Inspire what comes next."
        actions={
          role !== 'Student' && (
            <Button onClick={() => setCreate(true)}>
              <Plus size={17} />
              Issue certificate
            </Button>
          )
        }
      />
      <div className="resource-grid">
        {certs.map((c) => (
          <Card className="award-card" key={c.id}>
            <div className="award-medal">
              <Award size={42} />
            </div>
            <Badge tone="amber">{c.type}</Badge>
            <h2>{data.students.find((s) => s.id === c.studentId)?.name}</h2>
            <p>Issued {c.date}</p>
            <Button variant="secondary" onClick={() => setView(c.id)}>
              <Eye size={16} />
              View certificate
            </Button>
          </Card>
        ))}
      </div>
      {!certs.length && (
        <Empty
          title="Great achievements are on the way"
          text="Issued certificates will appear here."
        />
      )}
      {current && (
        <Modal title="Certificate of achievement" onClose={() => setView('')} wide>
          <div className="certificate print-area">
            <div className="certificate-inner">
              <GraduationCapLogo />
              <h3>{data.settings.name}</h3>
              <div className="eyebrow">KNOWLEDGE IS POWER</div>
              <h1>Certificate of Achievement</h1>
              <p>This certificate is proudly presented to</p>
              <h2>{data.students.find((s) => s.id === current.studentId)?.name}</h2>
              <p>In recognition of</p>
              <strong className="certificate-award">{current.type}</strong>
              <p>For the dedication, curiosity, and spirit that make our school proud.</p>
              <div className="certificate-signatures">
                <span>
                  {current.date}
                  <small>Date awarded</small>
                </span>
                <Award size={45} />
                <span>
                  Headteacher<small>Authorised signature</small>
                </span>
              </div>
            </div>
          </div>
          <div className="modal-actions">
            <Button onClick={() => window.print()}>
              <Printer size={16} />
              Print / Save PDF
            </Button>
          </div>
        </Modal>
      )}
      {create && (
        <Modal title="Celebrate an achievement" onClose={() => setCreate(false)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const id = uid();
              update(
                (d) => ({
                  ...d,
                  certificates: [
                    ...d.certificates,
                    {
                      id,
                      studentId: String(f.get('student')),
                      type: String(f.get('type')),
                      date: today(),
                    },
                  ],
                }),
                'Certificate issued',
              );
              setCreate(false);
              setView(id);
              notify('Certificate issued.');
            }}
          >
            <Field label="Student">
              <select name="student">
                {students.map((s) => (
                  <option value={s.id} key={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Achievement">
              <select name="type">
                {awards.map((a) => (
                  <option key={a}>{a}</option>
                ))}
              </select>
            </Field>
            <div className="modal-actions">
              <Button type="submit">Issue certificate</Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
function GraduationCapLogo() {
  return <img src="./crest.svg" alt="School crest" width="54" height="54" />;
}
export function Community() {
  const { data, role, me, allowedClasses, update, notify } = useStore();
  const classList = data.classes || classes;
  const isAdmin = role === 'Administrator';
  const [tab, setTab] = useState(isAdmin ? 'Classrooms & Streams' : 'Classroom updates');
  const [createPost, setCreatePost] = useState(false);
  const [createClass, setCreateClass] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [editTarget, setEditTarget] = useState<string | null>(null);
  const [editClassName, setEditClassName] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [reassignClass, setReassignClass] = useState<string>('');
  const [classError, setClassError] = useState('');

  const messages = data.messages.filter(
    (m) => m.classId === 'All classes' || allowedClasses.includes(m.classId),
  );

  function handleCreateClass(e: React.FormEvent) {
    e.preventDefault();
    const name = newClassName.trim();
    if (!name) {
      setClassError('Please enter a valid class name.');
      return;
    }
    if (classList.some((c) => c.toLowerCase() === name.toLowerCase())) {
      setClassError('A class with this name already exists.');
      return;
    }

    update((d) => {
      const currentClasses = d.classes || classes;
      const nextClasses = [...currentClasses, name];
      const nextFees = {
        ...d.fees,
        [name]: {
          Tuition: name.toUpperCase().startsWith('JHS') ? 600 : 450,
          'ICT levy': 50,
          'PTA dues': 20,
          ...(name.toUpperCase().startsWith('JHS') ? { 'Science laboratory': 100 } : {}),
        },
      };
      return {
        ...d,
        classes: nextClasses,
        fees: nextFees,
      };
    }, `Class created: ${name}`);

    setNewClassName('');
    setClassError('');
    setCreateClass(false);
    notify(`Class "${name}" created successfully.`);
  }

  function handleEditClass(e: React.FormEvent) {
    e.preventDefault();
    if (!editTarget) return;
    const oldName = editTarget;
    const newName = editClassName.trim();

    if (!newName) {
      setClassError('Please enter a valid class name.');
      return;
    }
    if (
      newName.toLowerCase() !== oldName.toLowerCase() &&
      classList.some((c) => c.toLowerCase() === newName.toLowerCase())
    ) {
      setClassError('A class with this name already exists.');
      return;
    }

    update((d) => {
      const currentClasses = d.classes || classes;
      const nextClasses = currentClasses.map((c) => (c === oldName ? newName : c));
      const nextStudents = d.students.map((s) =>
        s.classId === oldName ? { ...s, classId: newName } : s,
      );
      const nextAssignments = d.assignments.map((a) =>
        a.classId === oldName ? { ...a, classId: newName } : a,
      );
      const nextResources = d.resources.map((r) =>
        r.classId === oldName ? { ...r, classId: newName } : r,
      );
      const nextPeriods = d.periods.map((p) =>
        p.classId === oldName ? { ...p, classId: newName } : p,
      );
      const nextMessages = d.messages.map((m) =>
        m.classId === oldName ? { ...m, classId: newName } : m,
      );
      const nextUsers = d.users.map((u) => ({
        ...u,
        classes: u.classes.map((c) => (c === oldName ? newName : c)),
      }));

      const nextFees = { ...d.fees };
      if (nextFees[oldName]) {
        nextFees[newName] = nextFees[oldName];
        delete nextFees[oldName];
      }

      return {
        ...d,
        classes: nextClasses,
        students: nextStudents,
        assignments: nextAssignments,
        resources: nextResources,
        periods: nextPeriods,
        messages: nextMessages,
        users: nextUsers,
        fees: nextFees,
      };
    }, `Class renamed: ${oldName} to ${newName}`);

    setEditTarget(null);
    setEditClassName('');
    setClassError('');
    notify(`Class renamed from "${oldName}" to "${newName}".`);
  }

  function handleDeleteClass() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    const remaining = classList.filter((c) => c !== target);

    if (remaining.length === 0) {
      setClassError('The school must have at least one active class.');
      return;
    }

    const fallbackClass = reassignClass || remaining[0];

    update((d) => {
      const currentClasses = d.classes || classes;
      const nextClasses = currentClasses.filter((c) => c !== target);
      // Reassign students in this class to fallback class
      const nextStudents = d.students.map((s) =>
        s.classId === target ? { ...s, classId: fallbackClass } : s,
      );
      const nextAssignments = d.assignments.map((a) =>
        a.classId === target ? { ...a, classId: fallbackClass } : a,
      );
      const nextResources = d.resources.map((r) =>
        r.classId === target ? { ...r, classId: fallbackClass } : r,
      );
      const nextPeriods = d.periods.filter((p) => p.classId !== target);
      const nextMessages = d.messages.map((m) =>
        m.classId === target ? { ...m, classId: fallbackClass } : m,
      );
      const nextUsers = d.users.map((u) => ({
        ...u,
        classes: u.classes.filter((c) => c !== target),
      }));

      const nextFees = { ...d.fees };
      delete nextFees[target];

      return {
        ...d,
        classes: nextClasses,
        students: nextStudents,
        assignments: nextAssignments,
        resources: nextResources,
        periods: nextPeriods,
        messages: nextMessages,
        users: nextUsers,
        fees: nextFees,
      };
    }, `Class deleted: ${target}`);

    setDeleteTarget(null);
    setReassignClass('');
    setClassError('');
    notify(`Class "${target}" has been deleted.`);
  }

  return (
    <>
      <PageHeader
        eyebrow="ACADEMICS & COMMUNITY"
        title="Classroom"
        description="Manage active classes, classrooms, streams, and school community announcements."
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            {isAdmin && tab === 'Classrooms & Streams' && (
              <Button
                onClick={() => {
                  setClassError('');
                  setNewClassName('');
                  setCreateClass(true);
                }}
              >
                <Plus size={17} />
                Create new class
              </Button>
            )}
            {role !== 'Student' && tab === 'Classroom updates' && (
              <Button onClick={() => setCreatePost(true)}>
                <Plus size={17} />
                Post an update
              </Button>
            )}
          </div>
        }
      />

      <div style={{ marginBottom: 20 }}>
        <Tabs items={['Classrooms & Streams', 'Classroom updates']} value={tab} onChange={setTab} />
      </div>

      {tab === 'Classrooms & Streams' ? (
        <>
          <div className="stats-grid three" style={{ marginBottom: 24 }}>
            <Stat
              label="Active Classrooms"
              value={classList.length}
              icon={<School />}
              tone="navy"
            />
            <Stat
              label="Enrolled Learners"
              value={data.students.filter((s) => s.status === 'Active').length}
              icon={<GraduationCap />}
              tone="green"
            />
            <Stat
              label="Teaching Staff"
              value={data.users.filter((u) => u.role === 'Teacher' && u.active).length}
              icon={<Users />}
              tone="blue"
            />
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
              gap: 20,
            }}
          >
            {classList.map((c) => {
              const studentsInClass = data.students.filter((s) => s.classId === c);
              const activeStudents = studentsInClass.filter((s) => s.status === 'Active').length;
              const girls = studentsInClass.filter((s) => s.gender === 'Female').length;
              const boys = studentsInClass.filter((s) => s.gender === 'Male').length;
              const teachersForClass = data.users.filter(
                (u) => u.role === 'Teacher' && u.classes.includes(c),
              );
              const assignmentsInClass = data.assignments.filter((a) => a.classId === c).length;
              const periodsInClass = data.periods.filter((p) => p.classId === c).length;
              const isJHS = c.toUpperCase().startsWith('JHS');

              return (
                <Card
                  key={c}
                  style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 16 }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                    }}
                  >
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                      <span className={`icon-tile ${isJHS ? 'navy' : 'blue'}`}>
                        <School size={22} />
                      </span>
                      <div>
                        <h3 style={{ fontSize: 16, margin: 0 }}>{c}</h3>
                        <small style={{ color: 'var(--muted)' }}>
                          {isJHS ? 'Junior High School Stream' : 'Primary Basic Stream'}
                        </small>
                      </div>
                    </div>
                    <Badge tone={isJHS ? 'amber' : 'blue'}>{isJHS ? 'JHS' : 'Basic'}</Badge>
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: 12,
                      padding: '12px 14px',
                      background: 'var(--line)',
                      borderRadius: 8,
                    }}
                  >
                    <div>
                      <small style={{ color: 'var(--muted)', display: 'block' }}>Students</small>
                      <strong>{activeStudents} enrolled</strong>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                        {girls} girls · {boys} boys
                      </div>
                    </div>
                    <div>
                      <small style={{ color: 'var(--muted)', display: 'block' }}>Coursework</small>
                      <strong>{assignmentsInClass} assignments</strong>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                        {periodsInClass} periods / wk
                      </div>
                    </div>
                  </div>

                  <div>
                    <small style={{ color: 'var(--muted)', display: 'block', marginBottom: 4 }}>
                      Assigned Teachers
                    </small>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>
                      {teachersForClass.length > 0
                        ? teachersForClass.map((t) => t.name).join(', ')
                        : 'No assigned teacher'}
                    </div>
                  </div>

                  {isAdmin && (
                    <div
                      style={{
                        display: 'flex',
                        gap: 8,
                        justifyContent: 'flex-end',
                        marginTop: 'auto',
                        paddingTop: 8,
                        borderTop: '1px solid var(--line)',
                      }}
                    >
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setClassError('');
                          setEditTarget(c);
                          setEditClassName(c);
                        }}
                      >
                        <Pencil size={14} />
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        style={{ color: 'var(--red)' }}
                        onClick={() => {
                          setClassError('');
                          setDeleteTarget(c);
                          const others = classList.filter((x) => x !== c);
                          setReassignClass(others[0] || '');
                        }}
                      >
                        <Trash2 size={14} />
                        Delete
                      </Button>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </>
      ) : (
        <div className="community-layout">
          <div className="feed">
            {messages.map((m) => (
              <Card key={m.id} className="post">
                <div className="post-meta">
                  <Person
                    name={m.author}
                    sub={new Date(m.date).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'long',
                    })}
                  />
                  <Badge tone="blue">{m.classId}</Badge>
                </div>
                <h2>{m.title}</h2>
                <p>{m.body}</p>
              </Card>
            ))}
            {!messages.length && (
              <Empty title="Your classroom is quiet" text="School updates will appear here." />
            )}
          </div>
          <Card className="community-side">
            <MessageSquare size={32} />
            <h2>A little connection goes a long way.</h2>
            <p>
              Check in here for class announcements, upcoming activities, and notes from your
              teachers.
            </p>
            <div className="notice">Direct messaging will be connected in a later phase.</div>
          </Card>
        </div>
      )}

      {/* Create Class Modal */}
      {createClass && (
        <Modal title="Create a new class" onClose={() => setCreateClass(false)}>
          <form onSubmit={handleCreateClass}>
            <p style={{ marginBottom: 16, color: 'var(--muted)', fontSize: 13 }}>
              Enter the name of the new class or stream (e.g. <em>Basic 5 - Diamond</em>,{' '}
              <em>JHS 1 - Beta</em>, <em>Nursery 2</em>).
            </p>
            <Field label="Class name">
              <input
                required
                value={newClassName}
                placeholder="e.g. Basic 5 - Emerald"
                onChange={(e) => {
                  setNewClassName(e.target.value);
                  setClassError('');
                }}
              />
            </Field>
            {classError && (
              <p className="error" role="alert" style={{ marginTop: 10 }}>
                {classError}
              </p>
            )}
            <div className="modal-actions" style={{ marginTop: 20 }}>
              <Button type="button" variant="secondary" onClick={() => setCreateClass(false)}>
                Cancel
              </Button>
              <Button type="submit">Create class</Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Edit Class Modal */}
      {editTarget && (
        <Modal title={`Edit Class: ${editTarget}`} onClose={() => setEditTarget(null)}>
          <form onSubmit={handleEditClass}>
            <p style={{ marginBottom: 16, color: 'var(--muted)', fontSize: 13 }}>
              Renaming this class will automatically update all enrolled students, assignments,
              timetable periods, fee structures, and teacher assignments.
            </p>
            <Field label="Class name">
              <input
                required
                value={editClassName}
                onChange={(e) => {
                  setEditClassName(e.target.value);
                  setClassError('');
                }}
              />
            </Field>
            {classError && (
              <p className="error" role="alert" style={{ marginTop: 10 }}>
                {classError}
              </p>
            )}
            <div className="modal-actions" style={{ marginTop: 20 }}>
              <Button type="button" variant="secondary" onClick={() => setEditTarget(null)}>
                Cancel
              </Button>
              <Button type="submit">Save changes</Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete Class Modal */}
      {deleteTarget && (
        <Modal title={`Delete Class: ${deleteTarget}`} onClose={() => setDeleteTarget(null)}>
          <div>
            {(() => {
              const studentsCount = data.students.filter((s) => s.classId === deleteTarget).length;
              const otherClasses = classList.filter((c) => c !== deleteTarget);

              return (
                <>
                  <div
                    style={{
                      padding: '14px 16px',
                      background: 'rgba(195, 84, 85, 0.08)',
                      borderRadius: 8,
                      border: '1px solid rgba(195, 84, 85, 0.25)',
                      marginBottom: 16,
                    }}
                  >
                    <strong>Are you sure you want to delete {deleteTarget}?</strong>
                    <p style={{ fontSize: 13, marginTop: 4 }}>
                      There are currently <strong>{studentsCount} students</strong> enrolled in this
                      class.
                    </p>
                  </div>

                  {otherClasses.length > 0 ? (
                    studentsCount > 0 && (
                      <Field label="Reassign enrolled students to:">
                        <select
                          value={reassignClass || otherClasses[0]}
                          onChange={(e) => setReassignClass(e.target.value)}
                        >
                          {otherClasses.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                      </Field>
                    )
                  ) : (
                    <p className="error">You cannot delete the only class in the school system.</p>
                  )}

                  {classError && (
                    <p className="error" role="alert" style={{ marginTop: 10 }}>
                      {classError}
                    </p>
                  )}

                  <div className="modal-actions" style={{ marginTop: 20 }}>
                    <Button type="button" variant="secondary" onClick={() => setDeleteTarget(null)}>
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      variant="danger"
                      disabled={otherClasses.length === 0}
                      onClick={handleDeleteClass}
                    >
                      Delete class
                    </Button>
                  </div>
                </>
              );
            })()}
          </div>
        </Modal>
      )}

      {/* Post Update Modal */}
      {createPost && (
        <Modal title="Share a classroom update" onClose={() => setCreatePost(false)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              update(
                (d) => ({
                  ...d,
                  messages: [
                    {
                      id: uid(),
                      author: me,
                      title: String(f.get('title')),
                      body: String(f.get('body')),
                      classId: String(f.get('class')),
                      date: new Date().toISOString(),
                    },
                    ...d.messages,
                  ],
                }),
                'Classroom update posted',
              );
              setCreatePost(false);
              notify('Update shared with your classroom.');
            }}
          >
            <Field label="Audience">
              <select name="class">
                {(role === 'Administrator'
                  ? ['All classes', ...allowedClasses]
                  : allowedClasses
                ).map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>
            <Field label="Title">
              <input name="title" required />
            </Field>
            <Field label="Message">
              <textarea name="body" required rows={5} />
            </Field>
            <div className="modal-actions">
              <Button type="button" variant="secondary" onClick={() => setCreatePost(false)}>
                Cancel
              </Button>
              <Button type="submit">Post update</Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
