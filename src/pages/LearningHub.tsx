import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  BookOpen,
  Search,
  ArrowRight,
  ChevronRight,
  CheckCircle2,
  BarChart3,
  Target,
  Plus,
  ExternalLink,
  GraduationCap,
  ListChecks,
  RefreshCw,
  Download,
  ArrowLeft,
  Lightbulb,
  X,
} from 'lucide-react';
import { LessonPlayer } from './LessonPlayer';
import { useStore, csv } from '../store';
import { Button, Field, Modal } from '../components/ui';
import { canTeach } from '../backendAccess';
import type { HubLesson } from '../learningHub/catalog';
import { curriculumSources } from '../learningHub/sources';
import {
  loadHub,
  createHubLesson,
  assignHubLesson,
  completeHubReading,
  submitHubPractice,
} from '../learningHub/api';
import type { HubSnapshot, LearningLesson, HubPracticeResult } from '../learningHub/types';
import { learningStatus, recommendation } from '../learningHub/progress';
import './learning-hub.css';

const blank: HubSnapshot = { lessons: [], assignments: [], attempts: [], readings: [] };
const tabs = ['Courses', 'Assignments', 'Progress', 'Curriculum resources'] as const;
const levelName = (level: string) =>
  /^B[789]$/.test(level) ? `${level} · JHS ${Number(level[1]) - 6}` : level;

export function LearningHub() {
  const { data, user, role, notify } = useStore();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'Courses';
  const [snapshot, setSnapshot] = useState<HubSnapshot>(blank);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [subject, setSubject] = useState('All subjects');
  const [level, setLevel] = useState('All levels');
  const [assign, setAssign] = useState<LearningLesson | null>(null);
  const [assignStudent, setAssignStudent] = useState<{ id: string; classId: string }>();
  const [creating, setCreating] = useState(false);
  const staff = role === 'Administrator' || role === 'Teacher';
  const lesson = snapshot.lessons.find((l) => l.id === params.get('lesson'));
  const assignmentId = params.get('assignment') || undefined;
  const reload = useCallback(async () => {
    setError('');
    try {
      setSnapshot(await loadHub());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Learning Hub could not load.');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void reload();
  }, [reload, user?.id]);
  const go = (next: string) => setParams({ tab: next });
  const open = (id: string, assignment?: string) =>
    setParams({ tab, lesson: id, ...(assignment ? { assignment } : {}) });
  const subjects = [...new Set(snapshot.lessons.map((l) => l.subject))].sort();
  const levels = [...new Set(snapshot.lessons.map((l) => l.level))].sort();
  const filtered = snapshot.lessons.filter(
    (l) =>
      (subject === 'All subjects' || l.subject === subject) &&
      (level === 'All levels' || l.level === level) &&
      `${l.title} ${l.subject} ${l.strand} ${l.standard}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const groups = [...new Set(filtered.map((l) => `${l.level}|${l.subject}`))];
  const sid = user?.studentId || '';
  const completed = snapshot.assignments.filter(
    (a) => learningStatus(snapshot, sid, a.lessonId, a.id).complete,
  ).length;
  return (
    <div className="learning-hub">
      <header className="lh-masthead">
        <div className="lh-brand">
          <span>
            <GraduationCap size={26} />
          </span>
          <h1>Learning Hub</h1>
        </div>
        <span className="lh-school">GES · NaCCA curriculum</span>
      </header>
      <nav className="lh-tabs" aria-label="Learning Hub navigation">
        {tabs.map((t) => (
          <button key={t} aria-current={tab === t ? 'page' : undefined} onClick={() => go(t)}>
            {t === 'Courses' ? (
              <BookOpen size={17} />
            ) : t === 'Assignments' ? (
              <ListChecks size={17} />
            ) : t === 'Progress' ? (
              <BarChart3 size={17} />
            ) : (
              <GraduationCap size={17} />
            )}{' '}
            {t === 'Assignments' && !staff ? 'My assignments' : t}
          </button>
        ))}
        <button
          className="lh-refresh"
          onClick={() => {
            setLoading(true);
            void reload();
          }}
          aria-label="Refresh learning progress"
        >
          <RefreshCw size={17} />
        </button>
      </nav>
      {error && (
        <div role="alert" className="lh-error">
          {error}
          <Button variant="secondary" onClick={() => void reload()}>
            Retry loading
          </Button>
        </div>
      )}
      {loading && (
        <p className="lh-loading" role="status">
          Loading your learning space…
        </p>
      )}
      {!loading && !error && (
        <>
          {lesson ? (
            <LessonPlayer
              key={`${lesson.id}-${assignmentId || ''}`}
              lesson={lesson}
              assignmentId={assignmentId}
              snapshot={snapshot}
              studentId={sid}
              staff={staff}
              onBack={() => go(tab)}
              onAssign={() => {
                setAssignStudent(undefined);
                setAssign(lesson);
              }}
              onSaved={reload}
            />
          ) : (
            <>
              {tab === 'Courses' && (
                <>
                  <section className="lh-hero">
                    <div>
                      <span className="lh-eyebrow">YOUR NEXT STEP STARTS HERE</span>
                      <h2>
                        A little practice.
                        <br />
                        <em>A world of possibility.</em>
                      </h2>
                      <p>
                        Explore Ghana’s curriculum, understand new ideas, and build your
                        confidence—one skill at a time.
                      </p>
                      <div className="lh-hero-actions">
                        <Button
                          onClick={() =>
                            document
                              .getElementById('hub-courses')
                              ?.scrollIntoView({ behavior: 'smooth' })
                          }
                        >
                          Explore courses <ArrowRight size={17} />
                        </Button>
                        {staff && (
                          <Button variant="secondary" onClick={() => setCreating(true)}>
                            <Plus size={17} /> Create lesson
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="lh-hero-art" aria-hidden="true">
                      <div className="lh-orbit" />
                      <div className="lh-math">a² + b²</div>
                      <div className="lh-book">
                        <BookOpen size={78} />
                      </div>
                      <div className="lh-star">✦</div>
                      <span className="lh-art-caption">Learn. Practise. Grow.</span>
                    </div>
                  </section>
                  <div className="lh-summary">
                    <span>
                      <BookOpen size={20} />
                      <strong>{snapshot.lessons.length}</strong> lessons to explore
                    </span>
                    <span>
                      <Target size={20} />
                      <strong>{subjects.length}</strong> subjects
                    </span>
                    <span>
                      <CheckCircle2 size={20} />
                      <strong>
                        {staff
                          ? snapshot.assignments.length
                          : `${completed}/${snapshot.assignments.length}`}
                      </strong>{' '}
                      {staff ? 'assignments created' : 'assignments completed'}
                    </span>
                  </div>
                  <section id="hub-courses" className="lh-course-section">
                    <div className="lh-section-heading">
                      <div>
                        <span className="lh-eyebrow">FIND YOUR PATH</span>
                        <h2>Explore courses</h2>
                      </div>
                      <p>Original lessons aligned to published NaCCA standards.</p>
                    </div>
                    <div className="lh-filters">
                      <label className="lh-search">
                        <Search size={18} />
                        <input
                          aria-label="Search lessons"
                          placeholder="Search lessons, skills or standards"
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                        />
                      </label>
                      <select
                        aria-label="Subject"
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                      >
                        <option>All subjects</option>
                        {subjects.map((s) => (
                          <option key={s}>{s}</option>
                        ))}
                      </select>
                      <select
                        aria-label="Level"
                        value={level}
                        onChange={(e) => setLevel(e.target.value)}
                      >
                        <option>All levels</option>
                        {levels.map((l) => (
                          <option key={l} value={l}>
                            {levelName(l)}
                          </option>
                        ))}
                      </select>
                    </div>
                    {!filtered.length && (
                      <EmptyHub
                        title="No lessons match your search"
                        text="Try a different subject or level. Teachers can create lessons for additional curriculum standards."
                      />
                    )}
                    <div className="lh-course-grid">
                      {groups.map((g, index) => {
                        const lessons = filtered.filter((l) => `${l.level}|${l.subject}` === g);
                        const first = lessons[0];
                        return (
                          <section key={g} className={`lh-course lh-course-${index % 3}`}>
                            <header>
                              <span className="lh-subject-icon">
                                {first.subject === 'Mathematics' ? (
                                  '∑'
                                ) : first.subject === 'Science' ? (
                                  '⚛'
                                ) : (
                                  <BookOpen />
                                )}
                              </span>
                              <div>
                                <span>{levelName(first.level)}</span>
                                <h3>{first.subject}</h3>
                              </div>
                              <span className="lh-count">{lessons.length} lessons</span>
                            </header>
                            <div>
                              {lessons.map((l) => {
                                const status = learningStatus(snapshot, sid, l.id);
                                return (
                                  <button
                                    className="lh-lesson-row"
                                    key={l.id}
                                    onClick={() => open(l.id)}
                                  >
                                    <span className={status.complete ? 'lh-done' : ''}>
                                      {status.complete ? (
                                        <CheckCircle2 size={19} />
                                      ) : (
                                        <BookOpen size={19} />
                                      )}
                                    </span>
                                    <span>
                                      <strong>{l.title}</strong>
                                      <small>
                                        {l.strand} · {l.questions.length} practice questions
                                      </small>
                                    </span>
                                    <ChevronRight size={18} />
                                  </button>
                                );
                              })}
                            </div>
                            <footer>
                              <span>{first.level} curriculum · self-paced learning</span>
                            </footer>
                          </section>
                        );
                      })}
                    </div>
                  </section>
                  <aside className="lh-curriculum-note">
                    <GraduationCap size={25} />
                    <div>
                      <strong>Rooted in Ghana’s curriculum.</strong>
                      <p>
                        Browse the official curriculum documents and expand your learning with
                        teacher-created lessons. This library covers selected standards; it is not a
                        complete digitisation of every NaCCA subject.
                      </p>
                    </div>
                    <button onClick={() => go('Curriculum resources')}>
                      View resources <ArrowRight size={16} />
                    </button>
                  </aside>
                </>
              )}
              {tab === 'Assignments' && (
                <AssignmentView
                  snapshot={snapshot}
                  studentId={sid}
                  staff={staff}
                  students={data.students}
                  onOpen={open}
                  onBrowse={() => go('Courses')}
                />
              )}
              {tab === 'Progress' && (
                <ProgressView
                  snapshot={snapshot}
                  studentId={sid}
                  staff={staff}
                  students={data.students}
                  onOpen={open}
                  onAssign={(lesson, student) => {
                    setAssignStudent(student);
                    setAssign(lesson);
                  }}
                />
              )}
              {tab === 'Curriculum resources' && (
                <section className="lh-section">
                  <div className="lh-section-heading">
                    <div>
                      <span className="lh-eyebrow">THE FOUNDATION OF YOUR LEARNING</span>
                      <h2>Curriculum resources</h2>
                    </div>
                    {staff && (
                      <Button onClick={() => setCreating(true)}>
                        <Plus size={16} /> Create lesson
                      </Button>
                    )}
                  </div>
                  <p className="lh-intro">
                    Official standards and teaching resources for Ghanaian learners. Use these
                    documents to plan lessons, check learning indicators, and extend the course
                    library.
                  </p>
                  <div className="lh-resource-grid">
                    {curriculumSources.map((s) => (
                      <a
                        key={s.url}
                        className="lh-resource"
                        href={s.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <GraduationCap size={30} />
                        <h3>{s.title}</h3>
                        <p>{s.description}</p>
                        <small>{s.levels.join(' · ')}</small>
                        <span>
                          Open resource <ExternalLink size={16} />
                        </span>
                      </a>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </>
      )}
      {assign && (
        <AssignDialog
          lesson={assign}
          initialStudent={assignStudent}
          onClose={() => setAssign(null)}
          onSaved={async () => {
            setAssign(null);
            await reload();
            notify('Lesson assigned successfully.');
          }}
        />
      )}
      {creating && (
        <CreateLessonDialog
          onClose={() => setCreating(false)}
          onSaved={async () => {
            setCreating(false);
            await reload();
            notify('Lesson created. It is ready to assign.');
          }}
        />
      )}
      <footer className="lh-footer">
        <span>
          <GraduationCap size={17} /> Learning Hub · Ayisatu Owen Schools
        </span>
        <span>Every learner can grow.</span>
      </footer>
    </div>
  );
}

function EmptyHub({ title, text }: { title: string; text: string }) {
  return (
    <div className="lh-empty">
      <BookOpen size={32} />
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}
function AssignDialog({
  lesson,
  initialStudent,
  onClose,
  onSaved,
}: {
  lesson: LearningLesson;
  initialStudent?: { id: string; classId: string };
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const { data, user, role } = useStore();
  const classes = data.classes.filter(
    (c) => role === 'Administrator' || (!!user && canTeach(user, c, lesson.subject)),
  );
  const [classId, setClassId] = useState(initialStudent?.classId || classes[0] || ''),
    [mode, setMode] = useState(initialStudent ? 'students' : 'class'),
    [studentIds, setStudentIds] = useState<string[]>(initialStudent ? [initialStudent.id] : []),
    [dueDate, setDueDate] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  return (
    <Modal title="Assign lesson" onClose={onClose}>
      <form
        className="lh-form"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError('');
          try {
            await assignHubLesson({
              lessonId: lesson.id,
              classId,
              studentIds: mode === 'class' ? undefined : studentIds,
              dueDate,
            });
            await onSaved();
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not assign lesson.');
          } finally {
            setBusy(false);
          }
        }}
      >
        <p>
          <strong>{lesson.title}</strong>
          <br />
          {lesson.subject} · {lesson.standard}
        </p>
        {error && <p role="alert">{error}</p>}
        <Field label="Class">
          <select
            required
            value={classId}
            onChange={(e) => {
              setClassId(e.target.value);
              setStudentIds([]);
            }}
          >
            <option value="">Choose class</option>
            {classes.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
        <Field label="Assign to">
          <select value={mode} onChange={(e) => setMode(e.target.value)}>
            <option value="class">Whole class</option>
            <option value="students">Selected students</option>
          </select>
        </Field>
        {mode === 'students' && (
          <fieldset className="lh-students">
            <legend>Students</legend>
            {data.students
              .filter((s) => s.classId === classId)
              .map((s) => (
                <label key={s.id}>
                  <input
                    type="checkbox"
                    checked={studentIds.includes(s.id)}
                    onChange={(e) =>
                      setStudentIds((ids) =>
                        e.target.checked ? [...ids, s.id] : ids.filter((id) => id !== s.id),
                      )
                    }
                  />
                  {s.name}
                </label>
              ))}
          </fieldset>
        )}
        <Field label="Due date">
          <input
            required
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </Field>
        <p className="lh-help">
          Assignments include the students currently selected. New class members can be assigned
          separately.
        </p>
        <div className="modal-actions">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={busy || !classId || (mode === 'students' && !studentIds.length)}
            type="submit"
          >
            {busy ? 'Assigning…' : 'Assign'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function AssignmentView({
  snapshot,
  studentId,
  staff,
  students,
  onOpen,
  onBrowse,
}: {
  snapshot: HubSnapshot;
  studentId: string;
  staff: boolean;
  students: { id: string; name: string; classId: string }[];
  onOpen: (id: string, assignment?: string) => void;
  onBrowse: () => void;
}) {
  const [classId, setClassId] = useState('All classes');
  const assignments = snapshot.assignments.filter(
    (a) => classId === 'All classes' || a.classId === classId,
  );
  return (
    <section className="lh-section">
      <div className="lh-section-heading">
        <div>
          <span className="lh-eyebrow">A CLEAR NEXT STEP</span>
          <h2>{staff ? 'Assignments' : 'My assignments'}</h2>
        </div>
        {staff && (
          <Button onClick={onBrowse}>
            <Plus size={17} /> Assign a lesson
          </Button>
        )}
      </div>
      <p className="lh-intro">
        {staff
          ? 'Track the reading and practice assigned to your classes and individual learners.'
          : 'Your teacher’s lessons, practice activities, and due dates in one place.'}
      </p>
      {staff && (
        <select
          aria-label="Assignment class"
          value={classId}
          onChange={(e) => setClassId(e.target.value)}
        >
          <option>All classes</option>
          {[...new Set(snapshot.assignments.map((a) => a.classId))].map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      )}
      {!assignments.length ? (
        <EmptyHub
          title="No assignments yet"
          text={
            staff
              ? 'Choose a lesson in Courses and assign it to a class or selected students.'
              : 'Your teacher’s assigned lessons will appear here. You can explore Courses in the meantime.'
          }
        />
      ) : (
        <div className="lh-assignment-list">
          {assignments.map((a) => {
            const l = snapshot.lessons.find((l) => l.id === a.lessonId);
            if (!l) return null;
            const status = learningStatus(snapshot, studentId, l.id, a.id);
            const done = a.studentIds.filter(
              (s) => learningStatus(snapshot, s, l.id, a.id).complete,
            ).length;
            const overdue = a.dueDate < new Date().toISOString().slice(0, 10) && !status.complete;
            return (
              <section className="lh-assignment" key={a.id}>
                <div className="lh-assignment-icon">
                  <BookOpen size={25} />
                </div>
                <div>
                  <span className="lh-eyebrow">
                    {a.classId} · {l.subject}
                  </span>
                  <h3>{l.title}</h3>
                  <p>
                    Due {a.dueDate}
                    {staff
                      ? ` · ${a.studentIds.length} learner${a.studentIds.length === 1 ? '' : 's'}`
                      : overdue
                        ? ' · Overdue'
                        : ''}
                  </p>
                  {staff ? (
                    <details>
                      <summary>
                        View recipients and results ({done}/{a.studentIds.length} completed)
                      </summary>
                      <ul>
                        {a.studentIds.map((id) => {
                          const s = learningStatus(snapshot, id, l.id, a.id);
                          return (
                            <li key={id}>
                              {students.find((s) => s.id === id)?.name ||
                                'Student no longer in your roster'}{' '}
                              — {s.complete ? 'Completed' : s.label}
                              {s.latest ? ` · ${s.latest.score}%` : ''}
                            </li>
                          );
                        })}
                      </ul>
                    </details>
                  ) : (
                    <span className={`lh-status ${status.complete ? 'lh-done' : ''}`}>
                      {status.complete ? 'Completed' : status.label}
                      {status.latest ? ` · ${status.latest.score}%` : ''}
                    </span>
                  )}
                </div>
                <Button variant="secondary" onClick={() => onOpen(l.id, a.id)}>
                  {staff ? 'View lesson' : status.complete ? 'Review lesson' : 'Continue'}
                  <ArrowRight size={16} />
                </Button>
              </section>
            );
          })}
        </div>
      )}
    </section>
  );
}

function ProgressView({
  snapshot,
  studentId,
  staff,
  students,
  onOpen,
  onAssign,
}: {
  snapshot: HubSnapshot;
  studentId: string;
  staff: boolean;
  students: { id: string; name: string; classId: string }[];
  onOpen: (id: string) => void;
  onAssign: (lesson: LearningLesson, student: { id: string; classId: string }) => void;
}) {
  const [classId, setClassId] = useState('All classes'),
    [selected, setSelected] = useState('All students');
  const roster = students.filter(
    (s) =>
      (!staff ? s.id === studentId : true) &&
      (classId === 'All classes' || s.classId === classId) &&
      (selected === 'All students' || s.id === selected),
  );
  const ids = new Set(roster.map((s) => s.id));
  const attempts = snapshot.attempts.filter((a) => ids.has(a.studentId));
  const average = attempts.length
    ? Math.round(attempts.reduce((n, a) => n + a.score, 0) / attempts.length)
    : null;
  const rows = roster.flatMap((s) =>
    snapshot.lessons.flatMap((l) => {
      const status = learningStatus(snapshot, s.id, l.id);
      const assigned = snapshot.assignments.some(
        (a) => a.lessonId === l.id && a.studentIds.includes(s.id),
      );
      return assigned || status.read || status.latest ? [{ student: s, lesson: l, status }] : [];
    }),
  );
  const support = rows.filter((r) => r.status.latest && r.status.latest.score < 80);
  return (
    <section className="lh-section">
      <div className="lh-section-heading">
        <div>
          <span className="lh-eyebrow">MAKE EVERY STEP COUNT</span>
          <h2>{staff ? 'Learning progress' : 'My progress'}</h2>
        </div>
        {rows.length > 0 && (
          <Button
            variant="secondary"
            onClick={() =>
              csv('learning-progress.csv', [
                [
                  'Student',
                  'Class',
                  'Lesson',
                  'Standard',
                  'Reading',
                  'Attempts',
                  'Latest score',
                  'Recommendation',
                ],
                ...rows.map((r) => [
                  r.student.name,
                  r.student.classId,
                  r.lesson.title,
                  r.lesson.standard,
                  r.status.read ? 'Read' : 'Not read',
                  r.status.attempts.length,
                  r.status.latest?.score ?? '',
                  recommendation(r.status.latest?.score, r.status.read),
                ]),
              ])
            }
          >
            <Download size={16} /> Export report
          </Button>
        )}
      </div>
      <p className="lh-intro">
        Real practice results and clear next steps. Proficiency reflects the latest practice score;
        reading completion is recorded separately.
      </p>
      {staff && (
        <div className="lh-filters">
          <select
            aria-label="Progress class"
            value={classId}
            onChange={(e) => {
              setClassId(e.target.value);
              setSelected('All students');
            }}
          >
            <option>All classes</option>
            {[...new Set(students.map((s) => s.classId))].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <select
            aria-label="Progress student"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            <option>All students</option>
            {students
              .filter((s) => classId === 'All classes' || s.classId === classId)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
          </select>
        </div>
      )}
      <div className="lh-metrics">
        <div>
          <span>Practice attempts</span>
          <strong>{attempts.length}</strong>
          <small>All submitted attempts</small>
        </div>
        <div>
          <span>Average practice score</span>
          <strong>{average === null ? '—' : `${average}%`}</strong>
          <small>{average === null ? 'No attempts yet' : 'Across all attempts in this view'}</small>
        </div>
        <div>
          <span>Skills needing practice</span>
          <strong>{support.length}</strong>
          <small>Latest score below 80%</small>
        </div>
        <div>
          <span>Proficient skills</span>
          <strong>
            {rows.filter((r) => ['Proficient', 'Mastered'].includes(r.status.label)).length}
          </strong>
          <small>Proficient or mastered through assessed practice</small>
        </div>
      </div>
      {!rows.length ? (
        <EmptyHub
          title="Your learning story starts here"
          text="Assign a lesson or complete some practice to see performance and personalised next steps."
        />
      ) : (
        <>
          <div className="lh-section-heading">
            <h3>Skills & recommendations</h3>
            <span className="lh-legend">
              Not started · Attempted · Familiar · Proficient · Mastered
            </span>
          </div>
          <div className="lh-table-wrap">
            <table className="lh-progress-table">
              <thead>
                <tr>
                  {staff && <th>Learner</th>}
                  <th>Skill / standard</th>
                  <th>Progress</th>
                  <th>Latest score</th>
                  <th>Recommended next step</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={`${r.student.id}-${r.lesson.id}`}>
                    {staff && (
                      <td>
                        <strong>{r.student.name}</strong>
                        <small>{r.student.classId}</small>
                      </td>
                    )}
                    <td>
                      <button onClick={() => onOpen(r.lesson.id)}>{r.lesson.title}</button>
                      <small>{r.lesson.standard}</small>
                    </td>
                    <td>
                      <span
                        className={`lh-status ${(r.status.latest?.score ?? -1) >= 80 ? 'lh-done' : ''}`}
                      >
                        {r.status.label}
                      </span>
                      <small>
                        {r.status.attempts.length} attempts ·{' '}
                        {r.status.read ? 'Reading complete' : 'Reading not completed'}
                      </small>
                    </td>
                    <td>
                      <strong>{r.status.latest ? `${r.status.latest.score}%` : '—'}</strong>
                      {r.status.latest && (
                        <progress
                          max={100}
                          value={r.status.latest.score}
                          aria-label={`${r.student.name} ${r.lesson.title} score`}
                        />
                      )}
                    </td>
                    <td>
                      <p>{recommendation(r.status.latest?.score, r.status.read)}</p>
                      {staff && r.status.latest && r.status.latest.score < 80 ? (
                        <button
                          className="lh-text-button"
                          onClick={() => onAssign(r.lesson, r.student)}
                        >
                          Assign practice <ArrowRight size={14} />
                        </button>
                      ) : (
                        <button className="lh-text-button" onClick={() => onOpen(r.lesson.id)}>
                          Review lesson <ArrowRight size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <h3 className="lh-history-title">Recent practice</h3>
          <div className="lh-history">
            {[...attempts]
              .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
              .slice(0, 15)
              .map((a) => (
                <div key={a.id}>
                  <span>
                    {staff
                      ? `${students.find((s) => s.id === a.studentId)?.name || 'Learner'} · `
                      : ''}
                    {snapshot.lessons.find((l) => l.id === a.lessonId)?.title}
                  </span>
                  <strong>{a.score}%</strong>
                  <time>{new Date(a.createdAt).toLocaleDateString()}</time>
                </div>
              ))}
          </div>
        </>
      )}
    </section>
  );
}

function CreateLessonDialog({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [questions, setQuestions] = useState<
      { prompt: string; options: string[]; answer: number; explanation: string }[]
    >([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  return (
    <Modal title="Create lesson" onClose={onClose}>
      <form
        className="lh-form"
        onSubmit={async (e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          setBusy(true);
          setError('');
          try {
            const lesson: Omit<HubLesson, 'id'> = {
              title: String(form.get('title')),
              subject: String(form.get('subject')),
              level: String(form.get('level')),
              strand: String(form.get('strand')),
              standard: String(form.get('standard')),
              description: String(form.get('description')),
              body: String(form.get('body'))
                .split(/\n\s*\n/)
                .filter(Boolean),
              sourceUrl: String(form.get('sourceUrl')),
              sourceTitle: String(form.get('sourceTitle')),
              questions: questions.map((q, i) => ({ ...q, id: `q${i + 1}` })),
            };
            await createHubLesson(lesson);
            await onSaved();
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not create lesson.');
          } finally {
            setBusy(false);
          }
        }}
      >
        <p>
          Create an original lesson and link the NaCCA curriculum source that supports its learning
          standard.
        </p>
        {error && (
          <p role="alert" className="lh-error">
            {error}
          </p>
        )}
        <Field label="Lesson title">
          <input name="title" required maxLength={200} />
        </Field>
        <div className="form-grid">
          <Field label="Subject">
            <select name="subject">
              {[
                'Mathematics',
                'Science',
                'English Language',
                'Computing',
                'Social Studies',
                'Religious and Moral Education',
                'Career Technology',
                'Creative Arts and Design',
                'Ghanaian Language',
                'French',
                'History',
                'Our World Our People',
                'Physical Education',
              ].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
          <Field label="Level">
            <select name="level">
              {['KG1', 'KG2', ...Array.from({ length: 9 }, (_, i) => `B${i + 1}`)].map((l) => (
                <option key={l}>{l}</option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Curriculum strand">
          <input name="strand" required maxLength={200} />
        </Field>
        <Field label="Content standard / indicator">
          <input
            name="standard"
            required
            maxLength={300}
            placeholder="Use the code and learning goal from the curriculum"
          />
        </Field>
        <Field label="Lesson summary">
          <textarea name="description" required maxLength={1000} rows={2} />
        </Field>
        <Field
          label="Lesson content"
          hint="Include explanations, worked examples and learner activities. Separate paragraphs with a blank line."
        >
          <textarea name="body" required maxLength={30000} rows={8} />
        </Field>
        <Field label="Curriculum source title">
          <input name="sourceTitle" required maxLength={200} defaultValue="NaCCA curriculum" />
        </Field>
        <Field label="Curriculum source URL">
          <input
            name="sourceUrl"
            type="url"
            pattern="https://.*"
            required
            placeholder="https://nacca.gov.gh/..."
          />
        </Field>
        <div className="lh-editor-heading">
          <h3>Practice questions</h3>
          <Button
            type="button"
            variant="secondary"
            onClick={() =>
              setQuestions((q) => [
                ...q,
                { prompt: '', options: ['', '', '', ''], answer: 0, explanation: '' },
              ])
            }
            disabled={questions.length >= 20}
          >
            <Plus size={16} /> Add question
          </Button>
        </div>
        {questions.map((q, i) => (
          <fieldset key={i} className="lh-question-editor">
            <legend>Question {i + 1}</legend>
            <button
              type="button"
              aria-label={`Remove question ${i + 1}`}
              onClick={() => setQuestions((v) => v.filter((_, n) => n !== i))}
            >
              <X size={16} />
            </button>
            <Field label={`Question ${i + 1} prompt`}>
              <input
                required
                value={q.prompt}
                onChange={(e) =>
                  setQuestions((v) =>
                    v.map((x, n) => (n === i ? { ...x, prompt: e.target.value } : x)),
                  )
                }
              />
            </Field>
            {q.options.map((o, j) => (
              <Field key={j} label={`Question ${i + 1} option ${String.fromCharCode(65 + j)}`}>
                <input
                  required
                  value={o}
                  onChange={(e) =>
                    setQuestions((v) =>
                      v.map((x, n) =>
                        n === i
                          ? {
                              ...x,
                              options: x.options.map((a, k) => (k === j ? e.target.value : a)),
                            }
                          : x,
                      ),
                    )
                  }
                />
              </Field>
            ))}
            <Field label={`Question ${i + 1} correct answer`}>
              <select
                value={q.answer}
                onChange={(e) =>
                  setQuestions((v) =>
                    v.map((x, n) => (n === i ? { ...x, answer: Number(e.target.value) } : x)),
                  )
                }
              >
                {q.options.map((_, j) => (
                  <option key={j} value={j}>
                    {String.fromCharCode(65 + j)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={`Question ${i + 1} explanation`}>
              <textarea
                required
                value={q.explanation}
                onChange={(e) =>
                  setQuestions((v) =>
                    v.map((x, n) => (n === i ? { ...x, explanation: e.target.value } : x)),
                  )
                }
              />
            </Field>
          </fieldset>
        ))}
        <div className="modal-actions">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? 'Saving lesson…' : 'Create lesson'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
