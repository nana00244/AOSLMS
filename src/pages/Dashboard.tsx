import { Link } from 'react-router-dom';
import {
  Users,
  ClipboardCheck,
  Wallet,
  BookOpen,
  ArrowUpRight,
  ArrowRight,
  Upload,
  CalendarDays,
  Landmark,
  Download,
  GraduationCap,
  Sun,
  CheckCircle2,
  FileText,
  Clock3,
  Sparkles,
  School,
} from 'lucide-react';
import { useStore, backup } from '../store';
import { average, billed, money, paid, classes } from '../data';
import { PageHeader, Button, Card, CardTitle, Stat, Badge, Empty } from '../components/ui';
export function Dashboard() {
  const { data, role, me, ownId, allowedClasses, notify } = useStore();
  const student = data.students.find((s) => s.id === ownId);
  const totalBilled = data.students.reduce((a, s) => a + billed(data, s), 0),
    totalPaid = data.students.reduce((a, s) => a + paid(data, s.id), 0);
  const percent = totalBilled ? Math.round((totalPaid / totalBilled) * 100) : 0;
  const attend = Object.values(data.attendance);
  const present = attend.filter((s) => s === 'Present' || s === 'Late').length;
  const rate = attend.length ? Math.round((present / attend.length) * 100) : 0;
  const finance = role === 'Accountant';
  const learner = role === 'Student';
  const teacher = role === 'Teacher';
  const tasks = data.assignments.filter((a) => allowedClasses.includes(a.classId));
  return (
    <>
      <PageHeader
        eyebrow={`${new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date())}`}
        title={`Good morning, ${me.split(' ')[0]}.`}
        description={
          learner
            ? 'A fresh day to learn something wonderful.'
            : teacher
              ? 'Here’s what’s happening in your classroom today.'
              : 'Here’s a little perspective on your school today.'
        }
        actions={
          <>
            {role === 'Administrator' && (
              <Button
                variant="secondary"
                onClick={() =>
                  backup(data)
                    .then(() => notify('Demo backup downloaded.'))
                    .catch(() => notify('Unable to create backup. Please try again.'))
                }
              >
                <Download size={16} />
                Backup
              </Button>
            )}
            <Link
              className="btn btn-primary"
              to={finance ? '/finance' : learner ? '/coursework' : '/reports'}
            >
              {finance ? 'Open treasury' : learner ? 'My coursework' : 'View reports'}
              <ArrowUpRight size={16} />
            </Link>
          </>
        }
      />
      <div className="welcome-banner">
        <div className="welcome-icon">
          <Sun size={27} />
        </div>
        <div>
          <strong>A connected school. A brighter future.</strong>
          <p>Term {data.settings.term} is underway. Let’s make every school day count.</p>
        </div>
        <div className="welcome-term">
          <CalendarDays size={16} />
          {data.settings.year} academic year
        </div>
      </div>
      <div className="stats-grid">
        {learner && student ? (
          <>
            <Stat
              label="My overall average"
              value={`${average(data, student).toFixed(1)}%`}
              icon={<GraduationCap />}
              tone="blue"
              detail="This term"
            />
            <Stat label="Class assignments" value={tasks.length} icon={<BookOpen />} tone="navy" />
            <Stat
              label="My certificates"
              value={data.certificates.filter((c) => c.studentId === ownId).length}
              icon={<Sparkles />}
              tone="amber"
            />
            <Stat
              label="Fee balance"
              value={money(billed(data, student) - paid(data, ownId))}
              icon={<Wallet />}
              tone="green"
            />
          </>
        ) : (
          <>
            <Stat
              label={teacher ? 'Students in my classes' : 'Enrolled students'}
              value={
                data.students.filter(
                  (s) => s.status === 'Active' && (!teacher || allowedClasses.includes(s.classId)),
                ).length
              }
              icon={<Users />}
              detail="Active"
            />
            <Stat
              label={finance ? 'Total billed' : teacher ? 'Assigned classes' : 'Active classes'}
              value={
                finance
                  ? money(totalBilled)
                  : teacher
                    ? allowedClasses.length
                    : (data.classes || classes).length
              }
              icon={finance ? <FileText /> : <School />}
              tone="green"
              detail={finance ? 'This term' : teacher ? 'Teaching streams' : 'Available streams'}
            />
            <Stat
              label={
                finance ? 'Total collected' : teacher ? 'Class assignments' : 'Term collections'
              }
              value={teacher ? tasks.length : money(totalPaid)}
              icon={teacher ? <BookOpen /> : <Wallet />}
              tone="blue"
              detail="This term"
            />
            <Stat
              label={finance ? 'Outstanding fees' : teacher ? 'Awaiting grading' : 'Active staff'}
              value={
                finance
                  ? money(totalBilled - totalPaid)
                  : teacher
                    ? data.submissions.filter(
                        (s) => s.score === undefined && tasks.some((a) => a.id === s.assignmentId),
                      ).length
                    : data.users.filter((u) => u.role !== 'Student' && u.active).length
              }
              icon={finance ? <Landmark /> : <GraduationCap />}
              tone="amber"
            />
          </>
        )}
      </div>
      <div className="dashboard-grid">
        <div>
          <CardTitle
            title={learner ? 'Your learning journey' : 'Make things happen'}
            description={
              learner
                ? 'Everything you need for a great term.'
                : 'Your everyday essentials, one click away.'
            }
          />
          <div className="quick-links">
            {(learner
              ? [
                  [
                    '/coursework',
                    'Continue learning',
                    'Explore assignments and feedback',
                    BookOpen,
                    'navy',
                  ],
                  [
                    '/reports',
                    'My report card',
                    'See the progress you’re making',
                    GraduationCap,
                    'blue',
                  ],
                  [
                    '/resources',
                    'Find a resource',
                    'A little extra help, whenever you need it',
                    BookOpen,
                    'green',
                  ],
                ]
              : teacher
                ? [
                    [
                      '/attendance',
                      'Take attendance',
                      'Start the day with your class',
                      ClipboardCheck,
                      'navy',
                    ],
                    [
                      '/coursework',
                      'Review coursework',
                      'Give feedback that makes a difference',
                      BookOpen,
                      'blue',
                    ],
                    [
                      '/reports',
                      'Prepare report cards',
                      'Bring every student’s progress together',
                      GraduationCap,
                      'green',
                    ],
                  ]
                : finance
                  ? [
                      [
                        '/finance',
                        'Record a payment',
                        'Keep student balances up to date',
                        Wallet,
                        'navy',
                      ],
                      [
                        '/payroll',
                        'Payroll ledger',
                        'Manage staff salaries and pay slips',
                        Landmark,
                        'green',
                      ],
                      [
                        '/finance',
                        'Review outstanding fees',
                        'Follow up on term collections',
                        FileText,
                        'blue',
                      ],
                    ]
                  : [
                      [
                        '/students',
                        'Welcome new students',
                        'Admissions and spreadsheet imports',
                        Upload,
                        'navy',
                      ],
                      [
                        '/settings',
                        'Manage the academic term',
                        'Keep your school on the same page',
                        CalendarDays,
                        'blue',
                      ],
                      [
                        '/payroll',
                        'Review the payroll',
                        'Staff salaries, allowances, and slips',
                        Landmark,
                        'green',
                      ],
                    ]
            ).map(([path, title, desc, Icon, tone]) => {
              const I = Icon as typeof Upload;
              return (
                <Link to={path as string} className="quick-link" key={title as string}>
                  <span className={`icon-tile ${tone}`}>
                    <I size={22} />
                  </span>
                  <span>
                    <strong>{title as string}</strong>
                    <small>{desc as string}</small>
                  </span>
                  <ArrowRight size={18} />
                </Link>
              );
            })}
          </div>
        </div>
        <Card className="collection-card">
          <CardTitle
            title={learner || teacher ? 'Coming up next' : 'Fee collection progress'}
            description={
              learner || teacher
                ? 'Small steps, meaningful progress.'
                : 'A clear picture of this term’s collections.'
            }
            action={
              <span className="subtle-icon">
                {learner || teacher ? <CalendarDays size={20} /> : <Wallet size={20} />}
              </span>
            }
          />
          {learner || teacher ? (
            <div className="upcoming-list">
              {tasks.length ? (
                tasks.slice(0, 3).map((a) => (
                  <Link to="/coursework" className="upcoming-row" key={a.id}>
                    <div className="date-tile">
                      <small>
                        {new Date(a.due + 'T12:00:00').toLocaleString('en', { month: 'short' })}
                      </small>
                      <strong>{a.due.slice(-2)}</strong>
                    </div>
                    <div>
                      <strong>{a.title}</strong>
                      <small>
                        {a.subject} · {a.points} points
                      </small>
                    </div>
                    <Chevron />
                  </Link>
                ))
              ) : (
                <Empty title="You’re all caught up" />
              )}
            </div>
          ) : (
            <>
              <div className="donut-area">
                <div
                  className="donut"
                  style={{
                    background: `conic-gradient(#3c896f 0 ${percent}%, #edf1f3 ${percent}% 100%)`,
                  }}
                >
                  <div>
                    <strong>{percent}%</strong>
                    <small>collected</small>
                  </div>
                </div>
                <div className="donut-legend">
                  <div>
                    <span className="legend-dot green" />
                    <span>
                      Collected<strong>{money(totalPaid)}</strong>
                    </span>
                  </div>
                  <div>
                    <span className="legend-dot gray" />
                    <span>
                      Outstanding<strong>{money(totalBilled - totalPaid)}</strong>
                    </span>
                  </div>
                </div>
              </div>
              <Link className="collection-footer" to="/finance">
                View financial treasury <ArrowRight size={16} />
              </Link>
            </>
          )}
        </Card>
      </div>
      <div className="dashboard-bottom">
        <Card>
          <CardTitle
            title={role === 'Administrator' ? 'Recent activity' : 'Classroom updates'}
            description="The latest from your school community."
            action={
              <Link
                className="text-link"
                to={role === 'Administrator' ? '/audit' : finance ? '/finance' : '/community'}
              >
                View all <ArrowRight size={14} />
              </Link>
            }
          />
          {role === 'Administrator' || finance ? (
            <div className="activity-list">
              {data.logs
                .filter((l) => !finance || l.type === 'Finance' || l.actor === me)
                .slice(0, 4)
                .map((l, i) => (
                  <div className="activity-row" key={l.id}>
                    <span className={`activity-icon ${['blue', 'green', 'amber', 'navy'][i]}`}>
                      {i % 2 ? <Wallet size={17} /> : <CheckCircle2 size={17} />}
                    </span>
                    <div>
                      <strong>{l.action}</strong>
                      <small>{l.actor}</small>
                    </div>
                    <time>
                      {new Date(l.date).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </time>
                  </div>
                ))}
            </div>
          ) : (
            data.messages
              .filter((m) => m.classId === 'All classes' || allowedClasses.includes(m.classId))
              .slice(0, 2)
              .map((m) => (
                <div className="activity-row" key={m.id}>
                  <span className="activity-icon blue">
                    <BookOpen size={17} />
                  </span>
                  <div>
                    <strong>{m.title}</strong>
                    <small>
                      {m.author} · {m.classId}
                    </small>
                  </div>
                </div>
              ))
          )}
        </Card>
        <Card className="term-overview">
          <div className="icon-tile amber">
            <CalendarDays />
          </div>
          <h2>A term full of possibility.</h2>
          <p>Keep learning on track with your school calendar and important dates.</p>
          <div className="term-date">
            <Clock3 size={16} />
            <span>
              Term ends
              <strong>
                {new Date(data.settings.vacation + 'T12:00:00').toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </strong>
            </span>
          </div>
          <Badge tone="green">Term {data.settings.term} in progress</Badge>
        </Card>
      </div>
    </>
  );
}
function Chevron() {
  return <ArrowUpRight size={17} />;
}
