import { useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Award,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  FileText,
  Printer,
  Send,
  ShieldCheck,
  Wallet,
} from 'lucide-react';
import { useStore } from '../store';
import { billed, classSubjects, gradeKey, gradeLetter, money, paid } from '../data';
import {
  Badge,
  Button,
  Card,
  CardTitle,
  Empty,
  Field,
  PageHeader,
  Person,
  Stat,
} from '../components/ui';
import {
  getAssignmentDetails,
  getStudentAssignments,
  getStudentProfile,
  getStudentStream,
  submitAssignment,
} from '../services/assignmentService';
import { certificateService } from '../services/certificateService';
import { financeService } from '../services/financeService';
import { reportCardService } from '../services/reportCardService';

export function StudentStream() {
  const { data, user } = useStore();
  const student = user ? getStudentProfile(data, user.id) : undefined;
  const items = user ? getStudentStream(data, user.id) : [];
  const assignments = user ? getStudentAssignments(data, user.id) : [];
  return (
    <>
      <PageHeader
        eyebrow="MY CLASSROOM"
        title={`Class stream${student ? ` · ${student.classId}` : ''}`}
        description="Your classroom updates, lessons, assignments, and learning resources."
        actions={
          <Link className="btn btn-primary" to="/student/assignments">
            My assignments <BookOpen size={16} />
          </Link>
        }
      />
      <div className="stats-grid three">
        <Stat label="Class assignments" value={assignments.length} icon={<BookOpen />} />
        <Stat
          label="My submissions"
          value={assignments.filter((a) => a.submission).length}
          icon={<CheckCircle2 />}
          tone="green"
        />
        <Stat
          label="My class"
          value={student?.classId || 'Not linked'}
          icon={<ShieldCheck />}
          tone="blue"
        />
      </div>
      <Card>
        <CardTitle
          title="Recent classroom activity"
          description="Only updates and learning materials for your enrolled classroom are shown."
        />
        {items.map((item) => (
          <div className="class-detail-row" key={`${item.type}-${item.id}`}>
            <span className="activity-icon blue">
              {item.type === 'assignment' ? (
                <BookOpen size={17} />
              ) : item.type === 'resource' ? (
                <FileText size={17} />
              ) : (
                <CalendarDays size={17} />
              )}
            </span>
            <div className="student-stream-item">
              <strong>{item.title}</strong>
              <small>
                {item.type} · {item.date}
              </small>
              <p>{item.description}</p>
              {item.type === 'assignment' && (
                <Link to={`/student/assignments/${item.id}`}>Open assignment</Link>
              )}
            </div>
          </div>
        ))}
        {!items.length && (
          <Empty title="No class updates yet" text="New classroom content will appear here." />
        )}
      </Card>
    </>
  );
}

export function StudentAssignments() {
  const { data, user } = useStore();
  const assignments = user ? getStudentAssignments(data, user.id) : [];
  return (
    <>
      <PageHeader
        eyebrow="MY LEARNING"
        title="My assignments"
        description="Assignments for your enrolled classroom, with your own submission and grade status."
      />
      <div className="resource-grid">
        {assignments.map((a) => (
          <Card key={a.id}>
            <div className="student-assignment-top">
              <Badge
                tone={
                  a.status === 'graded'
                    ? 'green'
                    : a.status === 'missing'
                      ? 'red'
                      : a.status === 'completed'
                        ? 'blue'
                        : 'amber'
                }
              >
                {a.status}
              </Badge>
              <small>Due {a.due}</small>
            </div>
            <h2>{a.title}</h2>
            <p className="muted">
              {a.subjectName} · {a.points} points · {a.category}
            </p>
            <p>{a.description}</p>
            {a.submission && (
              <p className="muted">
                Submitted {new Date(a.submission.date).toLocaleString()}
                {a.submission.filename ? ` · ${a.submission.filename}` : ''}
              </p>
            )}
            {a.submission?.score !== undefined && (
              <p>
                <strong>
                  Your score: {a.submission.score} / {a.points}
                </strong>
              </p>
            )}
            <Link className="btn btn-secondary" to={`/student/assignments/${a.id}`}>
              View assignment
            </Link>
          </Card>
        ))}
      </div>
      {!assignments.length && <Empty title="No assignments for your class" />}
    </>
  );
}

export function AssignmentDetail() {
  const { id = '' } = useParams();
  const { data, user, update, notify } = useStore();
  const [text, setText] = useState('');
  const [link, setLink] = useState('');
  const [filename, setFilename] = useState('');
  const [error, setError] = useState('');
  let assignment = null;
  try {
    assignment = user ? getAssignmentDetails(data, id, user.id) : null;
  } catch {
    assignment = null;
  }
  if (!assignment)
    return (
      <>
        <PageHeader
          title="Assignment unavailable"
          description="This assignment is unavailable or is not part of your enrolled classroom."
        />
        <Card>
          <Empty
            title="Access restricted"
            text="You can only open assignments for your own class."
            action={
              <Link className="btn btn-secondary" to="/student/assignments">
                Return to my assignments
              </Link>
            }
          />
        </Card>
      </>
    );
  const save = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    try {
      if (!user) throw new Error('Student account is not available.');
      const fileValue = new FormData(e.currentTarget).get('file');
      const file = fileValue instanceof File ? fileValue : undefined;
      if (file && file.size > 5 * 1024 * 1024)
        throw new Error('Choose a document smaller than 5 MB.');
      const result = submitAssignment(data, id, user.id, {
        text,
        link,
        filename: file?.size ? file.name : assignment?.submission?.filename,
      });
      update(() => result.state, `Student submitted assignment ${assignment!.title}`);
      notify('Your work has been submitted.');
      setText('');
      setLink('');
      setFilename('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to submit work.');
    }
  };
  return (
    <>
      <PageHeader
        eyebrow={assignment.subjectName}
        title={assignment.title}
        description={`${assignment.category} · ${assignment.points} points · Due ${assignment.due}`}
        actions={
          <Link className="btn btn-secondary" to="/student/assignments">
            All assignments
          </Link>
        }
      />
      <Card>
        <CardTitle title="Instructions" />
        <p>{assignment.description}</p>
        {assignment.submission && (
          <div className="notice">
            <strong>Your submission</strong>
            <p>{assignment.submission.text || 'No written response provided.'}</p>
            {assignment.submission.link && (
              <a href={assignment.submission.link} target="_blank" rel="noreferrer">
                Open your link
              </a>
            )}
            {assignment.submission.filename && <p>{assignment.submission.filename}</p>}
            {assignment.submission.score !== undefined && (
              <p>
                <strong>
                  {assignment.submission.score} / {assignment.points}
                </strong>{' '}
                · {assignment.submission.feedback || 'Teacher feedback'}
              </p>
            )}
          </div>
        )}
        <form onSubmit={save}>
          <Field label="Your response">
            <textarea
              rows={5}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Write your answer here"
              disabled={assignment.submission?.score !== undefined}
            />
          </Field>
          <Field label="Research link (optional)">
            <input
              type="url"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://"
              disabled={assignment.submission?.score !== undefined}
            />
          </Field>
          <Field
            label="Document (optional)"
            hint="The demo stores the filename; uploaded file storage requires a backend."
          >
            <input
              type="file"
              name="file"
              onChange={(e) => setFilename(e.target.files?.[0]?.name || '')}
              disabled={assignment.submission?.score !== undefined}
            />
          </Field>
          {filename && <p className="muted">Selected file: {filename}</p>}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" disabled={assignment.submission?.score !== undefined}>
            <Send size={16} /> {assignment.submission ? 'Update submission' : 'Submit assignment'}
          </Button>
        </form>
      </Card>
    </>
  );
}

export function StudentFees() {
  const { data, ownId } = useStore();
  const student = data.students.find((s) => s.id === ownId);
  if (!student) return <Empty title="Student profile unavailable" />;
  const ledger = financeService.getStudentLedger(data, student.id);
  if (!ledger) return <Empty title="Student ledger unavailable" />;
  const feeLines = ledger.fees;
  const totalDue = ledger.totalDue;
  const totalPaid = ledger.totalPaid;
  const balance = ledger.balance;
  const receipts = ledger.payments;
  return (
    <>
      <PageHeader
        eyebrow="MY ACCOUNT · PRIVATE"
        title="My fees & payment ledger"
        description={`Personal fee statement · Term ${data.settings.term}, ${data.settings.year}`}
        actions={
          <Button onClick={() => window.print()}>
            <Printer size={16} /> Print fee statement
          </Button>
        }
      />
      <div className="stats-grid three">
        <Stat label="Total billed" value={money(totalDue)} icon={<FileText />} />
        <Stat label="Total paid" value={money(totalPaid)} icon={<Wallet />} tone="green" />
        <Stat
          label="Outstanding balance"
          value={money(balance)}
          icon={<CreditCard />}
          tone={balance ? 'amber' : 'green'}
        />
      </div>
      <div className="student-print-area print-area">
        <Card>
          <CardTitle
            title="Itemized fee invoices"
            description={`${student.name} · ${student.id} · ${student.classId}`}
          />
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Fee item</th>
                  <th>Term</th>
                  <th>Amount due</th>
                  <th>Paid</th>
                  <th>Balance</th>
                </tr>
              </thead>
              <tbody>
                {feeLines.map((f) => (
                  <tr key={f.id}>
                    <td>{f.categoryName}</td>
                    <td>Term {f.term}</td>
                    <td>{money(f.amountDue)}</td>
                    <td>{money(f.amountPaid)}</td>
                    <td>{money(f.balance)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th>Total</th>
                  <th />
                  <th>{money(totalDue)}</th>
                  <th>{money(Math.min(totalDue, totalPaid))}</th>
                  <th>{money(balance)}</th>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
        <Card>
          <CardTitle
            title="Official payment receipts"
            description="Your own receipts for the active term."
          />
          {receipts.length ? (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Receipt no.</th>
                    <th>Date</th>
                    <th>Channel</th>
                    <th>Reference</th>
                    <th>Amount received</th>
                  </tr>
                </thead>
                <tbody>
                  {receipts.map((p) => (
                    <tr key={p.id}>
                      <td>{p.receiptNumber || p.id}</td>
                      <td>{p.date}</td>
                      <td>{p.method}</td>
                      <td>{p.transactionRef || '—'}</td>
                      <td>{money(p.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty title="No receipts for this term" />
          )}
        </Card>
      </div>
    </>
  );
}

export function ReportCardView() {
  const { data, ownId } = useStore();
  const reports = reportCardService.getReportCardsForStudent(data, ownId);
  const [term, setTerm] = useState(reports[0]?.term ?? 0);
  const report = reports.find((item) => item.term === term) || reports[0];
  if (!data.students.some((student) => student.id === ownId))
    return <Empty title="Student profile unavailable" />;
  if (!report)
    return (
      <>
        <PageHeader
          eyebrow="MY ACADEMIC RECORD"
          title="Terminal report card"
          description="Certified continuous assessment (SBA 50%) and terminal examination (50%) records."
        />
        <Card>
          <Empty
            title="No certified report cards yet"
            text="Your official report card will appear here after the school certifies it."
          />
        </Card>
      </>
    );
  return (
    <>
      <PageHeader
        eyebrow="CERTIFIED ACADEMIC RECORD"
        title="Terminal report card"
        description={`${report.studentName} · ${report.classId} · Term ${report.term}, ${report.year}`}
        actions={
          <>
            <select
              aria-label="Certified report term"
              value={report.term}
              onChange={(e) => setTerm(Number(e.target.value))}
            >
              {reports.map((item) => (
                <option value={item.term} key={item.id}>
                  Term {item.term}
                </option>
              ))}
            </select>
            <Button onClick={() => window.print()}>
              <Printer size={16} /> Print official report
            </Button>
          </>
        }
      />
      <Card className="student-print-area print-area">
        <div className="student-report-heading">
          <img src={data.settings.crest || './crest.svg'} alt="School crest" width="50" />
          <div>
            <h2>{data.settings.name}</h2>
            <p>Official Terminal Report Card · Academic year {report.year}</p>
          </div>
          <ShieldCheck size={28} />
        </div>
        <div className="student-report-summary">
          <Person name={report.studentName} sub={`${ownId} · ${report.classId}`} />
          <strong>
            Overall: {report.overall.toFixed(1)}% · Grade {report.overallGrade}
          </strong>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Subject</th>
                <th>SBA / 50</th>
                <th>Terminal exam / 50</th>
                <th>Total / 100</th>
                <th>Grade</th>
                <th>Teacher remark</th>
              </tr>
            </thead>
            <tbody>
              {report.subjects.map((g) => (
                <tr key={g.subject}>
                  <td>{g.subject}</td>
                  <td>{g.sba}</td>
                  <td>{g.exam}</td>
                  <td>
                    <strong>{g.total}</strong>
                  </td>
                  <td>{g.grade}</td>
                  <td>{g.remark || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {report.teacherRemark && (
          <div className="student-teacher-remark">
            <strong>Teacher’s remark</strong>
            <p>{report.teacherRemark}</p>
          </div>
        )}
        <p className="student-certified">
          <CheckCircle2 size={16} /> Certified by the school
        </p>
      </Card>
    </>
  );
}

export function StudentPerformanceTracking() {
  const { data, ownId, user } = useStore();
  const student = data.students.find((s) => s.id === ownId);
  if (!student) return <Empty title="Student profile unavailable" />;
  const assignments = (user ? getStudentAssignments(data, user.id) : []).map((a) => ({
    assignment: a,
    submission: a.submission,
    score: a.scores?.[student.id]?.score,
  }));
  const remarks = Object.entries(data.remarks).filter(([key]) => key.startsWith(`${student.id}|`));
  const subjects = classSubjects(student.classId);
  const subjectScores = subjects.map((subject) => {
    const g = data.grades[gradeKey(student.id, data.settings.term, subject)] || {
      sba: 0,
      exam: 0,
      remark: '',
    };
    return { subject, ...g, total: g.sba + g.exam };
  });
  return (
    <>
      <PageHeader
        eyebrow="MY ACADEMIC RECORD"
        title="Performance tracking"
        description={`Your personal scores, teacher feedback, and progress · Term ${data.settings.term}.`}
      />
      <div className="stats-grid three">
        <Stat label="Subjects tracked" value={subjectScores.length} icon={<BookOpen />} />
        <Stat
          label="Graded assignments"
          value={
            assignments.filter((a) => a.score !== undefined || a.submission?.score !== undefined)
              .length
          }
          icon={<CheckCircle2 />}
          tone="green"
        />
        <Stat
          label="Teacher remarks"
          value={remarks.length + subjectScores.filter((g) => g.remark).length}
          icon={<FileText />}
          tone="blue"
        />
      </div>
      <Card>
        <CardTitle
          title="My subject results"
          description="Only your own SBA and terminal exam scores are displayed."
        />
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Subject</th>
                <th>SBA / 50</th>
                <th>Terminal / 50</th>
                <th>Total</th>
                <th>Grade</th>
                <th>Teacher remark</th>
              </tr>
            </thead>
            <tbody>
              {subjectScores.map((g) => (
                <tr key={g.subject}>
                  <td>{g.subject}</td>
                  <td>{g.sba}</td>
                  <td>{g.exam}</td>
                  <td>{g.total}</td>
                  <td>{gradeLetter(g.total)}</td>
                  <td>{g.remark || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <Card>
        <CardTitle title="My assignment feedback" />
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Assignment</th>
                <th>Subject</th>
                <th>Score</th>
                <th>Feedback</th>
                <th>Submitted</th>
              </tr>
            </thead>
            <tbody>
              {assignments.map(({ assignment, submission, score }) => (
                <tr key={assignment.id}>
                  <td>{assignment.title}</td>
                  <td>{assignment.subject}</td>
                  <td>{score ?? submission?.score ?? 'Not graded'}</td>
                  <td>
                    {assignment.scores?.[student.id]?.feedback || submission?.feedback || '—'}
                  </td>
                  <td>{submission?.date || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      {remarks.map(([key, value]) => (
        <Card key={key}>
          <CardTitle title={`Teacher remark · Term ${key.split('|')[1]}`} />
          <p>{value}</p>
        </Card>
      ))}
    </>
  );
}

export function StudentSchedule() {
  const { data, ownId } = useStore();
  const student = data.students.find((s) => s.id === ownId);
  if (!student) return <Empty title="Student profile unavailable" />;
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  const periods = data.periods
    .filter((p) => p.classId === student.classId)
    .sort((a, b) => a.start.localeCompare(b.start));
  return (
    <>
      <PageHeader
        eyebrow="MY CLASSROOM"
        title="My schedule"
        description={`${student.classId} · Term ${data.settings.term}, ${data.settings.year}`}
        actions={
          <Button variant="secondary" onClick={() => window.print()}>
            <Printer size={16} /> Print schedule
          </Button>
        }
      />
      <div className="timetable-wrap student-print-area print-area">
        <div className="timetable">
          <div className="time-label">TIME</div>
          {days.map((day) => (
            <div key={day} className="day-label">
              {day.slice(0, 3)}
              <small>{day}</small>
            </div>
          ))}
          {[...new Set(periods.map((p) => p.start))].map((start) => (
            <div className="timetable-row" key={start}>
              <div className="time-label">{start}</div>
              {days.map((day) => (
                <div className="schedule-cell" key={day}>
                  {periods
                    .filter((p) => p.start === start && p.day === day)
                    .map((p) => (
                      <div className="period-card" key={p.id}>
                        <span className="period-subject">{p.subject}</span>
                        <span>{p.teacher}</span>
                        <span>{p.room}</span>
                        <small>
                          {p.start}–{p.end}
                        </small>
                      </div>
                    ))}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
      {!periods.length && <Empty title="No schedule published for your class" />}
    </>
  );
}

export function StudentCertificates() {
  const { data, ownId } = useStore();
  const [certs, setCerts] = useState<typeof data.certificates>([]);
  useEffect(() => {
    let active = true;
    void certificateService.getCertificatesForStudent(data.certificates, ownId).then((items) => {
      if (active) setCerts(items);
    });
    return () => {
      active = false;
    };
  }, [data.certificates, ownId]);
  return (
    <>
      <PageHeader
        eyebrow="MY ACHIEVEMENTS"
        title="My digital certificates"
        description="Certificates awarded to your own student profile."
      />
      {certs.length ? (
        <div className="resource-grid">
          {certs.map((c) => (
            <Card className="student-certificate print-area" key={c.id}>
              <div className="award-medal">
                <Award size={42} />
              </div>
              <h2>{c.type}</h2>
              <p>Awarded to {data.students.find((s) => s.id === c.studentId)?.name}</p>
              <p>{new Date(c.date).toLocaleDateString()}</p>
              <Button variant="secondary" onClick={() => window.print()}>
                <Printer size={16} /> Print certificate
              </Button>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <Empty
            title="No certificates awarded yet"
            text="Certificates for your student profile will appear here."
          />
        </Card>
      )}
    </>
  );
}
