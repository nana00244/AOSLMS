import { useState } from 'react';
import { AttendanceImport } from '../components/AttendanceImport';
import { CheckCheck, Save, Users, UserCheck, UserX, Clock3, Check, Printer } from 'lucide-react';
import { useStore } from '../store';
import { today, standing, type AttendanceStatus } from '../data';
import {
  PageHeader,
  Button,
  Card,
  Stat,
  SearchBox,
  Person,
  Tabs,
  Badge,
  Empty,
} from '../components/ui';
const statuses: AttendanceStatus[] = ['Present', 'Late', 'Absent', 'Excused'];
export function Attendance() {
  const { data, role, update, notify, allowedClasses } = useStore();
  const isAdministrator = role === 'Administrator';
  const [importing, setImporting] = useState(false);
  const [viewTerm, setViewTerm] = useState(data.settings.term);
  const [cls, setCls] = useState(allowedClasses[0]),
    [date, setDate] = useState(today()),
    [q, setQ] = useState(''),
    [tab, setTab] = useState('Daily register'),
    [draft, setDraft] = useState<Record<string, AttendanceStatus>>({});
  const roster = data.students.filter((s) => s.classId === cls && s.status === 'Active');
  const key = (id: string) => `${date}|${viewTerm}|${id}`;
  const status = (id: string) => draft[key(id)] || data.attendance[key(id)];
  const shown = roster.filter((s) => (s.name + s.id).toLowerCase().includes(q.toLowerCase()));
  const count = (s: AttendanceStatus) => roster.filter((p) => status(p.id) === s).length;
  const month = date.slice(0, 7);
  const days = Array.from(
    { length: new Date(Number(month.slice(0, 4)), Number(month.slice(5)), 0).getDate() },
    (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`,
  ).filter(
    (d) =>
      ![0, 6].includes(new Date(d + 'T12:00:00').getDay()) ||
      roster.some((s) => data.attendance[`${d}|${viewTerm}|${s.id}`]),
  );
  const dirty = Object.keys(draft).length > 0;
  return (
    <>
      <PageHeader
        eyebrow="EVERY DAY COUNTS"
        title="Attendance register"
        description={`${cls} · Term ${viewTerm} · A good day begins with being here.`}
        actions={
          tab === 'Daily register' ? (
            <>
              <Button
                variant="secondary"
                onClick={() => {
                  setDraft((d) => ({
                    ...d,
                    ...Object.fromEntries(
                      roster.map((s) => [key(s.id), 'Present' as AttendanceStatus]),
                    ),
                  }));
                }}
              >
                <CheckCheck size={17} />
                Mark all present
              </Button>
              <Button
                onClick={async () => {
                  if (
                    !(await update(
                      (d) => ({ ...d, attendance: { ...d.attendance, ...draft } }),
                      `Attendance saved for ${cls}, ${date}`,
                    ))
                  )
                    return;
                  setDraft({});
                  notify('Attendance saved. Report card counts updated.');
                }}
                disabled={!dirty}
              >
                <Save size={16} />
                Save register{dirty ? ' •' : ''}
              </Button>
            </>
          ) : (
            <Button onClick={() => window.print()}>
              <Printer size={16} />
              Print monthly register
            </Button>
          )
        }
      />
      <Tabs items={['Daily register', 'Monthly audit']} value={tab} onChange={setTab} />
      <div className="filter-bar">
        <Button
          variant="secondary"
          disabled={dirty || !allowedClasses.length}
          onClick={() => setImporting(true)}
        >
          Import attendance CSV
        </Button>
        {dirty && <span>Save pending daily changes before importing.</span>}
      </div>
      {importing && (
        <AttendanceImport
          onClose={() => setImporting(false)}
          onImported={(classId, importedMonth, term) => {
            setCls(classId);
            setViewTerm(term);
            setDate(`${importedMonth}-01`);
            setTab('Monthly audit');
          }}
        />
      )}
      <div className="stats-grid">
        <Stat label="Students in class" value={roster.length} icon={<Users />} />
        <Stat label="Present" value={count('Present')} icon={<UserCheck />} tone="green" />
        <Stat label="Absent" value={count('Absent')} icon={<UserX />} tone="red" />
        <Stat
          label="Late / excused"
          value={count('Late') + count('Excused')}
          icon={<Clock3 />}
          tone="amber"
        />
      </div>
      <Card>
        <div className="filter-bar">
          <SearchBox value={q} onChange={setQ} placeholder="Search student name or ID..." />
          <select
            aria-label="Attendance class"
            value={cls}
            onChange={(e) => setCls(e.target.value)}
          >
            {allowedClasses.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <input
            aria-label="Attendance date"
            type="date"
            value={date}
            onChange={(e) => e.target.value && setDate(e.target.value)}
          />
          {isAdministrator ? (
            <select
              aria-label="Register term"
              value={viewTerm}
              onChange={(e) => setViewTerm(Number(e.target.value))}
            >
              {[1, 2, 3].map((term) => (
                <option key={term} value={term}>
                  Term {term}
                </option>
              ))}
            </select>
          ) : (
            <select
              aria-label="Register term"
              value={data.settings.term}
              disabled
              title="Locked to active term set by administrator"
            >
              <option value={data.settings.term}>
                Term {data.settings.term} (Active · Locked)
              </option>
            </select>
          )}
        </div>
        {tab === 'Daily register' ? (
          <div className="attendance-list">
            <div className="attendance-heading">
              <span>STUDENT INFORMATION</span>
              <span>ATTENDANCE STATUS</span>
            </div>
            {shown.map((s) => (
              <div className="attendance-row" key={s.id}>
                <Person name={s.name} sub={s.id} />
                <div
                  className="status-options"
                  role="group"
                  aria-label={`Attendance for ${s.name}`}
                >
                  {statuses.map((st) => (
                    <button
                      aria-pressed={status(s.id) === st}
                      className={`status-option ${status(s.id) === st ? `selected ${st.toLowerCase()}` : ''}`}
                      key={st}
                      onClick={() => setDraft({ ...draft, [key(s.id)]: st })}
                    >
                      {status(s.id) === st && <Check size={15} />} {st}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {!shown.length && <Empty title="No students found" />}
          </div>
        ) : (
          <div className="print-area table-scroll monthly-register">
            <h2 className="print-only">
              {data.settings.name} · Monthly attendance · {month}
            </h2>
            <table>
              <thead>
                <tr>
                  <th>Student</th>
                  {days.map((d) => (
                    <th key={d}>{Number(d.slice(-2))}</th>
                  ))}
                  <th>P / L / A / E</th>
                  <th>Standing</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((s) => {
                  const values = days.map((d) => data.attendance[`${d}|${viewTerm}|${s.id}`]);
                  const marked = values.filter(Boolean),
                    attended = marked.filter((v) => v === 'Present' || v === 'Late').length;
                  const percent = marked.length ? (attended / marked.length) * 100 : 0;
                  return (
                    <tr key={s.id}>
                      <td>{s.name}</td>
                      {values.map((v, i) => (
                        <td key={i}>
                          <span className={`attendance-letter ${(v || '').toLowerCase()}`}>
                            {v ? v[0] : '–'}
                          </span>
                        </td>
                      ))}
                      <td>
                        {statuses.map((st) => marked.filter((v) => v === st).length).join(' / ')}
                      </td>
                      <td>
                        <Badge tone={percent >= 85 ? 'green' : percent >= 75 ? 'amber' : 'red'}>
                          {marked.length ? standing(percent) : 'Unmarked'}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="print-caption">
              P: Present · L: Late · A: Absent · E: Excused. Standing uses marked sessions; Present
              and Late count as attended.
            </p>
          </div>
        )}
        <div className="table-footer">
          <span>
            {dirty
              ? 'Unsaved changes — save the register to update report cards.'
              : 'Attendance records are up to date.'}
          </span>
          <Badge tone={dirty ? 'amber' : 'green'}>{dirty ? 'Changes pending' : 'Up to date'}</Badge>
        </div>
      </Card>
    </>
  );
}
