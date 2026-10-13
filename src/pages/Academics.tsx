import { useEffect, useState } from 'react';
import { flushSync } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import {
  Plus,
  BookOpen,
  ClipboardCheck,
  ChartColumn,
  CalendarDays,
  ArrowUpRight,
  Save,
  Printer,
  CheckCircle2,
  GraduationCap,
  Pencil,
  FileText,
  Download,
  Trash2,
  Upload,
  User,
  ShieldCheck,
} from 'lucide-react';
import { csv, useStore } from '../store';
import { ScoreSheetImport } from '../components/ScoreSheetImport';
import { canTeach } from '../backendAccess';
import { downloadLearningFile, uploadLearningFile } from '../backend';
import { isSupabaseConfigured } from '../supabase';
import {
  uid,
  today,
  subjects,
  classSubjects,
  gradeKey,
  studentGrades,
  gradeLetter,
  average,
  rank,
  ordinal,
  courseworkAssessment,
  courseworkCategory,
  courseworkCategoryConfigs,
  courseworkFeedbackMetadata,
  ensureClassCourseworkCards,
  courseworkSubjectId,
  type State,
  type FeedbackType,
  type Assignment,
  type Student,
  type Submission,
} from '../data';
import {
  PageHeader,
  Button,
  Card,
  CardTitle,
  Stat,
  Badge,
  Modal,
  Field,
  Person,
  Empty,
  Tabs,
} from '../components/ui';
export function Coursework() {
  const [importOpen, setImportOpen] = useState(false);
  const { data, role, ownId, allowedClasses, me, update, notify } = useStore();
  const [cls, setCls] = useState(allowedClasses[0] || ''),
    [create, setCreate] = useState(false),
    [active, setActive] = useState(''),
    [selectedClassFilter, setSelectedClassFilter] = useState('all'),
    [scoreSubjectSelection, setScoreSubjectSelection] = useState(''),
    [gridAssignmentId, setGridAssignmentId] = useState(''),
    [scoreGridOpen, setScoreGridOpen] = useState(false),
    [gridSearch, setGridSearch] = useState(''),
    [gridFilter, setGridFilter] = useState<'all' | 'scored' | 'unscored' | 'feedback'>('all'),
    [activeCategoryTab, setActiveCategoryTab] = useState<'all' | string>('all'),
    [selectedSubjectFilter, setSelectedSubjectFilter] = useState('all'),
    [selectedTermFilter, setSelectedTermFilter] = useState('current'),
    [cardSearchTerm, setCardSearchTerm] = useState(''),
    [grading, setGrading] = useState<Submission | null>(null),
    [submit, setSubmit] = useState<Assignment | null>(null);
  const student = role === 'Student';
  const canManageCoursework = role === 'Administrator' || role === 'Teacher';
  const viewerUser = data.users.find((user) => user.name === me);
  const isAdministrator = role === 'Administrator';
  const classAllowedSubjectsMap = viewerUser?.classAllowedSubjects || {};
  const hasClassAccess = (classId: string) => isAdministrator || allowedClasses.includes(classId);
  const hasSubjectAccess = (classId: string, subject: string) => {
    if (!classSubjects(classId).includes(subject)) return false;
    if (isAdministrator) return true;
    const configured = classAllowedSubjectsMap[classId];
    return (
      configured === undefined ||
      configured.includes(courseworkSubjectId(subject)) ||
      configured.includes(subject)
    );
  };
  async function prepareCourseworkCards() {
    if (!canManageCoursework) return;
    const targetClasses = selectedClassFilter === 'all' ? allowedClasses : [selectedClassFilter];
    if (!targetClasses.length) return;
    let nextAssignments = data.assignments;
    let createdCount = 0;
    for (const classId of targetClasses) {
      const configured = classAllowedSubjectsMap[classId];
      const allowedIds =
        isAdministrator || configured === undefined ? undefined : new Set(configured);
      const result = ensureClassCourseworkCards(
        { ...data, assignments: nextAssignments },
        classId,
        data.settings.term,
        allowedIds,
      );
      nextAssignments = result.assignments;
      createdCount += result.createdCount;
    }
    if (createdCount) {
      if (
        !(await update(
          (current) => ({ ...current, assignments: nextAssignments }),
          `Populated ${targetClasses.length} class${targetClasses.length === 1 ? '' : 'es'} with ${createdCount} coursework cards`,
        ))
      )
        return;
      notify(
        `Populated ${targetClasses.length} class${targetClasses.length === 1 ? '' : 'es'} with coursework cards for the active term.`,
      );
    }
  }
  const visibleClassIds = selectedClassFilter === 'all' ? allowedClasses : [selectedClassFilter];
  const assignments = data.assignments.filter(
    (assignment) =>
      visibleClassIds.includes(assignment.classId) &&
      hasClassAccess(assignment.classId) &&
      hasSubjectAccess(assignment.classId, assignment.subject) &&
      (!isAdministrator
        ? !assignment.term ||
          assignment.term === `Term ${data.settings.term}` ||
          assignment.term === String(data.settings.term)
        : selectedTermFilter === 'all'
          ? true
          : selectedTermFilter === 'current'
            ? !assignment.term || assignment.term === `Term ${data.settings.term}`
            : !assignment.term || assignment.term === selectedTermFilter),
  );
  const curriculumAssignments = assignments.filter((assignment) => assignment.id.startsWith('cc_'));
  const legacyAssignments = assignments.filter((assignment) => !assignment.id.startsWith('cc_'));
  const visibleAssignments = curriculumAssignments.filter((assignment) => {
    const category = courseworkCategory(assignment.category)?.toLowerCase();
    const matchesCategory = activeCategoryTab === 'all' || category === activeCategoryTab;
    const matchesSubject =
      selectedSubjectFilter === 'all' || assignment.subject === selectedSubjectFilter;
    const matchesSearch =
      !cardSearchTerm ||
      `${assignment.title} ${assignment.subject}`
        .toLowerCase()
        .includes(cardSearchTerm.toLowerCase());
    return matchesCategory && matchesSubject && matchesSearch;
  });
  const subjectOptions = [
    ...new Set(
      visibleClassIds.flatMap((classId) =>
        classSubjects(classId).filter((subject) => hasSubjectAccess(classId, subject)),
      ),
    ),
  ];
  const categoryCounts = Object.fromEntries([
    ['all', curriculumAssignments.length],
    ...Object.keys(courseworkCategoryConfigs).map((category) => [
      category,
      curriculumAssignments.filter(
        (assignment) => courseworkCategory(assignment.category)?.toLowerCase() === category,
      ).length,
    ]),
  ]);
  const gridAssignments = assignments.filter((assignment) => assignment.id === gridAssignmentId);
  const gridColumns = gridAssignments.flatMap((assignment) => {
    const category = courseworkCategory(assignment.category);
    const config = category
      ? courseworkCategoryConfigs[category.toLowerCase() as keyof typeof courseworkCategoryConfigs]
      : undefined;
    const slots = assignment.slots?.length
      ? assignment.slots
      : config
        ? Array.from({ length: config.slotCount }, (_, index) => ({
            slotKey: `${config.prefix}${index + 1}`,
            title: `${config.label} ${index + 1}`,
            maxPoints: config.maxPoints,
          }))
        : [{ slotKey: 'Score', title: assignment.title, maxPoints: assignment.points }];
    return slots.map((slot) => ({ assignment, slot }));
  });
  const gridPupils = data.students.filter((pupil) => {
    if (pupil.classId !== cls) return false;
    const matches = `${pupil.name} ${pupil.id}`.toLowerCase().includes(gridSearch.toLowerCase());
    const entries = gridColumns.map(
      ({ assignment, slot }) => assignment.slotScores?.[pupil.id]?.[slot.slotKey],
    );
    const hasScores = entries.some((entry) => entry?.score !== undefined && entry?.score !== null);
    const hasFeedback = entries.some(
      (entry) => entry?.feedbackType && entry.feedbackType !== 'none',
    );
    return (
      matches &&
      (gridFilter === 'all' ||
        (gridFilter === 'scored'
          ? hasScores
          : gridFilter === 'unscored'
            ? !hasScores
            : hasFeedback))
    );
  });
  const scoreAssignments = data.assignments.filter(
    (assignment) => assignment.classId === cls && hasSubjectAccess(cls, assignment.subject),
  );
  const scoreSubjects = [
    ...new Set([
      ...scoreAssignments.map((a) => a.subject),
      ...classSubjects(cls).filter((subject) => hasSubjectAccess(cls, subject)),
    ]),
  ];
  const scoreSubject = scoreSubjects.includes(scoreSubjectSelection)
    ? scoreSubjectSelection
    : scoreSubjects[0];
  const scorebookRows = data.students
    .filter((pupil) => pupil.classId === cls && (!student || pupil.id === ownId))
    .map((pupil) => {
      const assessment = courseworkAssessment(data, pupil.id, cls, scoreSubject);
      return { pupil, assessment, score: assessment.total ?? 0 };
    });
  const rankedScores = scorebookRows.map((row) => row.score);
  const scorebookExport = () =>
    csv(
      `coursework-scorebook-${cls.toLowerCase().replace(/\s+/g, '-')}-${scoreSubject.toLowerCase().replace(/\s+/g, '-')}.csv`,
      [
        [
          'Student',
          'Exercise /15',
          'Homework /15',
          'Groupwork /15',
          'Quiz /15',
          'Project /15',
          'Raw SBA /60',
          'SBA /50',
          'Terminal exam /100',
          'Exam /50',
          'Total /100',
          'Grade',
          'Position',
        ],
        ...scorebookRows.map(({ pupil, assessment }) => [
          pupil.name,
          assessment.categories.Exercise ?? '',
          assessment.categories.Homework ?? '',
          assessment.categories.Groupwork ?? '',
          assessment.categories.Quiz ?? '',
          assessment.categories.Project ?? '',
          assessment.rawSba ?? '',
          assessment.sba ?? '',
          assessment.examRaw ?? '',
          assessment.exam ?? '',
          assessment.total ?? '',
          assessment.grade,
          rank(assessment.total ?? 0, rankedScores),
        ]),
      ],
    );
  const selected = assignments.find((a) => a.id === active) || assignments[0];
  const submissions = data.submissions.filter(
    (s) => s.assignmentId === selected?.id && (!student || s.studentId === ownId),
  );
  const pending = data.submissions.filter(
    (submission) =>
      submission.score === undefined &&
      assignments.some(
        (assignment) =>
          assignment.id === submission.assignmentId &&
          assignment.scores?.[submission.studentId]?.score === undefined,
      ),
  ).length;
  return (
    <>
      <PageHeader
        eyebrow="LEARNING IN PROGRESS"
        title={student ? 'My coursework' : 'Coursework & gradebook'}
        description="Small discoveries. Meaningful feedback. Lasting progress."
        actions={
          canManageCoursework && (
            <>
              <Button variant="secondary" onClick={() => void prepareCourseworkCards()}>
                Prepare blank coursework cards
              </Button>
              <Button variant="secondary" onClick={() => setImportOpen(true)}>
                <Upload size={17} />
                Upload score sheet
              </Button>
              <Button onClick={() => setCreate(true)}>
                <Plus size={17} />
                Create assignment
              </Button>
            </>
          )
        }
      />
      {importOpen && <ScoreSheetImport onClose={() => setImportOpen(false)} />}
      <div className="stats-grid three">
        <Stat
          label={student ? 'Class assignments' : 'Pending grading'}
          value={student ? assignments.length : pending}
          icon={<ClipboardCheck />}
        />
        <Stat
          label={student ? 'Graded submissions' : 'Class average'}
          value={
            student
              ? assignments.filter(
                  (assignment) =>
                    assignment.scores?.[ownId]?.score !== undefined ||
                    Object.values(assignment.slotScores?.[ownId] || {}).some(
                      (entry) => entry.score !== undefined && entry.score !== null,
                    ) ||
                    data.submissions.some(
                      (submission) =>
                        submission.assignmentId === assignment.id &&
                        submission.studentId === ownId &&
                        submission.score !== undefined,
                    ),
                ).length
              : `${(data.students.filter((s) => s.classId === cls).reduce((sum, s) => sum + average(data, s), 0) / Math.max(1, data.students.filter((s) => s.classId === cls).length)).toFixed(1)}%`
          }
          icon={<ChartColumn />}
          tone="green"
        />
        <Stat
          label="Assessment model"
          value="50 / 50"
          icon={<BookOpen />}
          tone="blue"
          detail="SBA + Exam"
        />
      </div>
      <div className="section-heading">
        <CardTitle
          title="Coursework & continuous assessment grids"
          description="Coursework cards are organized by curriculum subject and assessment category."
        />
        <select
          aria-label="Coursework class"
          value={selectedClassFilter}
          onChange={(e) => {
            setSelectedClassFilter(e.target.value);
            if (e.target.value !== 'all') setCls(e.target.value);
            setActive('');
            setSelectedSubjectFilter('all');
            setScoreGridOpen(false);
          }}
        >
          <option value="all">All my classes</option>
          {allowedClasses.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        {isAdministrator ? (
          <select
            aria-label="Coursework term"
            value={data.settings.term}
            onChange={async (event) => {
              const term = Number(event.target.value);
              if (
                !(await update(
                  (current) => ({ ...current, settings: { ...current.settings, term } }),
                  `Switched coursework to Term ${term}`,
                ))
              )
                return;
              setActive('');
              setScoreGridOpen(false);
            }}
          >
            {[1, 2, 3].map((term) => (
              <option key={term} value={term}>
                Term {term}
              </option>
            ))}
          </select>
        ) : (
          <span className="term-lock-badge" title="Active term set by school administration">
            <ShieldCheck size={14} />
            Term {data.settings.term} (Active)
          </span>
        )}
      </div>
      <div className="coursework-card-filters">
        <label>
          Class
          <select
            aria-label="Filter coursework by class"
            value={selectedClassFilter}
            onChange={(e) => {
              setSelectedClassFilter(e.target.value);
              if (e.target.value !== 'all') setCls(e.target.value);
              setActive('');
              setSelectedSubjectFilter('all');
              setScoreGridOpen(false);
            }}
          >
            <option value="all">All my classes</option>
            {allowedClasses.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label>
          Subject
          <select
            aria-label="Filter by subject"
            value={selectedSubjectFilter}
            onChange={(event) => setSelectedSubjectFilter(event.target.value)}
          >
            <option value="all">All My Subjects</option>
            {subjectOptions.map((subject) => (
              <option key={subject}>{subject}</option>
            ))}
          </select>
        </label>
        <label>
          Term
          {isAdministrator ? (
            <select
              aria-label="Filter by term"
              value={selectedTermFilter}
              onChange={(event) => setSelectedTermFilter(event.target.value)}
            >
              <option value="all">All terms</option>
              <option value="current">Current term (Term {data.settings.term})</option>
              {[1, 2, 3].map((term) => (
                <option key={term} value={`Term ${term}`}>
                  Term {term}
                </option>
              ))}
            </select>
          ) : (
            <select
              aria-label="Filter by term"
              value="current"
              disabled
              title="Locked to the active term set by administrator"
            >
              <option value="current">Term {data.settings.term} (Active · Locked)</option>
            </select>
          )}
        </label>
        <label>
          Search cards
          <input
            aria-label="Search coursework cards"
            placeholder="Search by title or subject"
            value={cardSearchTerm}
            onChange={(event) => setCardSearchTerm(event.target.value)}
          />
        </label>
      </div>
      <div className="coursework-category-tabs" role="tablist" aria-label="Coursework categories">
        {[
          { key: 'all', label: `All ${categoryCounts.all} Cards` },
          ...Object.keys(courseworkCategoryConfigs).map((category) => ({
            key: category,
            label: `${courseworkCategoryConfigs[category as keyof typeof courseworkCategoryConfigs].label} (${categoryCounts[category] || 0})`,
          })),
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={activeCategoryTab === tab.key}
            className={activeCategoryTab === tab.key ? 'active' : ''}
            onClick={() => setActiveCategoryTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="assignment-grid">
        {visibleAssignments.map((a, i) => {
          const mine = data.submissions.find(
            (s) => s.assignmentId === a.id && s.studentId === ownId,
          );
          const ownScore = a.scores?.[ownId];
          const ownEntries = Object.values(a.slotScores?.[ownId] || {});
          const hasSlotGrade = ownEntries.some(
            (entry) => entry.score !== undefined && entry.score !== null,
          );
          return (
            <Card
              className={`assignment-card ${selected?.id === a.id ? 'is-selected' : ''}`}
              key={a.id}
            >
              <div className="assignment-top">
                <span className={`icon-tile ${['green', 'blue', 'amber'][i % 3]}`}>
                  <BookOpen size={20} />
                </span>
                <Badge
                  tone={
                    student
                      ? ownScore || hasSlotGrade || mine?.score !== undefined
                        ? 'green'
                        : mine
                          ? 'blue'
                          : 'amber'
                      : 'blue'
                  }
                >
                  {student
                    ? ownScore || hasSlotGrade || mine?.score !== undefined
                      ? 'Graded'
                      : mine
                        ? 'Submitted'
                        : 'Pending'
                    : a.category}
                </Badge>
                {selectedClassFilter === 'all' && <Badge tone="blue">{a.classId}</Badge>}
              </div>
              <h3>{a.title}</h3>
              <p>{a.subject}</p>
              <div className="assignment-meta">
                <span>
                  <CalendarDays size={14} />
                  {new Date(a.due + 'T12:00:00').toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                  })}
                </span>
                <span>{a.points} points</span>
              </div>
              <div className="assignment-footer">
                <small>
                  {student && ownEntries.length
                    ? `${ownEntries.length} assessment entries recorded`
                    : `${Object.values(a.slotScores || {}).filter((entries) => Object.keys(entries).length).length} students assessed · ${data.submissions.filter((s) => s.assignmentId === a.id).length} submissions`}
                </small>
                <Button
                  variant="ghost"
                  onClick={() => {
                    if (student) setSubmit(a);
                    else {
                      setCls(a.classId);
                      setActive(a.id);
                      setGridAssignmentId(a.id);
                      setScoreSubjectSelection(a.subject);
                      setScoreGridOpen(true);
                    }
                  }}
                >
                  {student
                    ? mine || ownScore || ownEntries.length
                      ? 'View work / grade'
                      : 'Open task'
                    : 'Open Excel grading sheet'}
                  <ArrowUpRight size={15} />
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
      {legacyAssignments.length > 0 && (
        <section className="legacy-coursework-list">
          <CardTitle
            title="Existing assignments"
            description="Previously created tasks remain available alongside the curriculum grading cards."
          />
          <div className="assignment-grid">
            {legacyAssignments.map((assignment) => (
              <Card className="assignment-card" key={assignment.id}>
                <h3>{assignment.title}</h3>
                <p>
                  {assignment.subject} · {assignment.category} · {assignment.points} points
                </p>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setActive(assignment.id);
                    setGridAssignmentId(assignment.id);
                    setScoreSubjectSelection(assignment.subject);
                    setScoreGridOpen(true);
                  }}
                >
                  Open Excel grading sheet <ArrowUpRight size={15} />
                </Button>
              </Card>
            ))}
          </div>
        </section>
      )}
      {!assignments.length && (
        <Empty
          title="A new chapter starts here"
          text="Create your first assignment for this class."
        />
      )}
      {scoreGridOpen && canManageCoursework && (
        <Card className="coursework-score-entry">
          <CardTitle
            title={`Class score grid · ${scoreSubject}`}
            description="Enter scores for multiple assignments in one pass. Blank cells remain ungraded and are excluded from category scaling."
          />
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              const pupils = data.students.filter((pupil) => pupil.classId === cls);
              const entered = gridColumns.flatMap(({ assignment, slot }) =>
                pupils.flatMap((pupil) => {
                  const value = String(
                    form.get(`score-${assignment.id}-${slot.slotKey}-${pupil.id}`) || '',
                  ).trim();
                  if (!value) return [];
                  const score = Number(value);
                  const maxPoints =
                    assignment.slotScores?.[pupil.id]?.[slot.slotKey]?.maxPoints ?? slot.maxPoints;
                  if (!Number.isFinite(score) || score < 0 || score > maxPoints) {
                    return [
                      [`${assignment.title} · ${slot.slotKey}`, pupil.name, maxPoints] as const,
                    ];
                  }
                  return [];
                }),
              );
              if (entered.length) {
                const [assignmentTitle, pupilName, max] = entered[0];
                notify(
                  `Enter a score between 0 and ${max} for ${pupilName} on ${assignmentTitle}.`,
                );
                return;
              }
              const updates = gridColumns.flatMap(({ assignment, slot }) =>
                pupils.flatMap((pupil) => {
                  const value = String(
                    form.get(`score-${assignment.id}-${slot.slotKey}-${pupil.id}`) || '',
                  ).trim();
                  const status = String(
                    form.get(`status-${assignment.id}-${slot.slotKey}-${pupil.id}`) || 'none',
                  ) as FeedbackType;
                  if (!value && status === 'none') return [];
                  const score = value ? Number(value) : null;
                  return [
                    [
                      assignment.id,
                      pupil.id,
                      slot.slotKey,
                      {
                        score,
                        maxPoints:
                          assignment.slotScores?.[pupil.id]?.[slot.slotKey]?.maxPoints ??
                          slot.maxPoints,
                        feedbackType: status,
                        feedbackReason: String(
                          form.get(`feedback-${assignment.id}-${slot.slotKey}-${pupil.id}`) || '',
                        ).trim(),
                        updatedAt: new Date().toISOString(),
                      },
                    ] as const,
                  ];
                }),
              );
              if (!updates.length) {
                notify('Enter at least one score before saving.');
                return;
              }
              if (
                !(await update((d) => {
                  const next = {
                    ...d,
                    assignments: d.assignments.map((assignment) => {
                      const assignmentUpdates = updates.filter(([id]) => id === assignment.id);
                      if (!assignmentUpdates.length) return assignment;
                      return {
                        ...assignment,
                        slots: assignment.slots?.length
                          ? assignment.slots
                          : gridColumns
                              .filter((column) => column.assignment.id === assignment.id)
                              .map(({ slot }) => slot),
                        slotScores: assignmentUpdates.reduce(
                          (all, [, pupilId, slotKey, result]) => ({
                            ...all,
                            [pupilId]: {
                              ...all[pupilId],
                              [slotKey]: result,
                            },
                          }),
                          { ...assignment.slotScores },
                        ),
                      };
                    }),
                  };
                  const grades = { ...d.grades };
                  for (const pupil of pupils) {
                    const assessment = courseworkAssessment(next, pupil.id, cls, scoreSubject);
                    if (!assessment.hasSba && !assessment.hasExam) continue;
                    const key = gradeKey(pupil.id, d.settings.term, scoreSubject);
                    const current = grades[key] || { sba: 0, exam: 0, remark: '' };
                    grades[key] = {
                      ...current,
                      ...(assessment.hasSba ? { sba: assessment.sba ?? 0 } : {}),
                      ...(assessment.hasExam ? { exam: assessment.exam ?? 0 } : {}),
                    };
                  }
                  return { ...next, grades };
                }, `Scores entered: ${updates.length} assignment marks for ${scoreSubject}`))
              )
                return;
              notify(
                `Saved ${updates.length} score${updates.length === 1 ? '' : 's'} to the SBA scorebook and report cards.`,
              );
            }}
          >
            <div className="coursework-grid-tools">
              <input
                aria-label="Search students"
                placeholder="Search student name / ID…"
                value={gridSearch}
                onChange={(event) => setGridSearch(event.target.value)}
              />
              <select
                aria-label="Filter score grid"
                value={gridFilter}
                onChange={(event) => setGridFilter(event.target.value as typeof gridFilter)}
              >
                <option value="all">All pupils</option>
                <option value="scored">Scored</option>
                <option value="unscored">Unscored</option>
                <option value="feedback">With feedback</option>
              </select>
              <span>
                {gridPupils.length} pupils · {gridColumns.length} score slots
              </span>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  const maxima = gridColumns.map(({ assignment, slot }) => {
                    const values = new Set(
                      gridPupils.flatMap((pupil) => {
                        const entry = assignment.slotScores?.[pupil.id]?.[slot.slotKey];
                        return entry ? [entry.maxPoints ?? slot.maxPoints] : [];
                      }),
                    );
                    return values.size > 1 ? null : ([...values][0] ?? slot.maxPoints);
                  });
                  if (maxima.includes(null)) {
                    notify(
                      'This grid has different maximum marks within a column. Filter students to a common marking scale before exporting.',
                    );
                    return;
                  }
                  csv(`coursework-${cls}-${scoreSubject}.csv`, [
                    ['AYISATU OWEN SCHOOLS - CONTINUOUS ASSESSMENT SCORE SHEET'],
                    ['Subject', scoreSubject, 'Class', cls],
                    [
                      'Assessment Category',
                      gridAssignments[0]?.category || '',
                      'Term',
                      gridAssignments[0]?.term || `Term ${data.settings.term}`,
                    ],
                    [
                      'Student Name',
                      'Admission Number',
                      ...gridColumns.map(
                        ({ slot }, index) => `${slot.slotKey} (/${maxima[index]})`,
                      ),
                    ],
                    ...gridPupils.map((pupil) => [
                      pupil.name,
                      pupil.id,
                      ...gridColumns.map(({ assignment, slot }) => {
                        const entry = assignment.slotScores?.[pupil.id]?.[slot.slotKey];
                        return `${entry?.score ?? ''}${entry?.feedbackType && entry.feedbackType !== 'none' ? ` [${courseworkFeedbackMetadata[entry.feedbackType].tag}]` : ''}`.trim();
                      }),
                    ]),
                  ]);
                }}
              >
                <Download size={15} /> Export CSV
              </Button>
            </div>
            <div className="table-scroll coursework-grid-scroll">
              <table className="coursework-grid-table">
                <thead>
                  <tr>
                    <th className="coursework-grid-student">Student</th>
                    {gridColumns.map(({ assignment, slot }) => (
                      <th
                        key={`${assignment.id}-${slot.slotKey}`}
                        className="coursework-grid-assignment"
                      >
                        <strong>{slot.slotKey}</strong>
                        <small>
                          {assignment.title} · /{slot.maxPoints}
                        </small>
                        <small>
                          {
                            data.students.filter(
                              (pupil) =>
                                pupil.classId === cls &&
                                assignment.slotScores?.[pupil.id]?.[slot.slotKey]?.score !==
                                  undefined &&
                                assignment.slotScores?.[pupil.id]?.[slot.slotKey]?.score !== null,
                            ).length
                          }
                          /{data.students.filter((pupil) => pupil.classId === cls).length} scored
                        </small>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {gridPupils.map((pupil) => {
                    return (
                      <tr key={pupil.id}>
                        <td className="coursework-grid-student">
                          <Person name={pupil.name} />
                        </td>
                        {gridColumns.map(({ assignment, slot }, slotIndex) => {
                          const submission = data.submissions.find(
                            (item) =>
                              item.assignmentId === assignment.id && item.studentId === pupil.id,
                          );
                          const entry = assignment.slotScores?.[pupil.id]?.[slot.slotKey];
                          const score = entry
                            ? entry.score
                            : slotIndex === 0
                              ? (assignment.scores?.[pupil.id]?.score ?? submission?.score)
                              : undefined;
                          const feedback =
                            entry?.feedbackReason ??
                            (slotIndex === 0
                              ? (assignment.scores?.[pupil.id]?.feedback ?? submission?.feedback)
                              : '');
                          return (
                            <td
                              key={`${assignment.id}-${slot.slotKey}`}
                              className="coursework-grid-score"
                            >
                              <input
                                key={`score-${entry?.updatedAt || ''}`}
                                aria-label={`${pupil.name} ${slot.slotKey} score`}
                                name={`score-${assignment.id}-${slot.slotKey}-${pupil.id}`}
                                type="number"
                                min="0"
                                max={entry?.maxPoints ?? slot.maxPoints}
                                step="any"
                                defaultValue={score ?? ''}
                                placeholder="—"
                              />
                              <select
                                key={`status-${entry?.updatedAt || ''}`}
                                aria-label={`${pupil.name} ${slot.slotKey} feedback status`}
                                name={`status-${assignment.id}-${slot.slotKey}-${pupil.id}`}
                                defaultValue={entry?.feedbackType || 'none'}
                              >
                                {Object.entries(courseworkFeedbackMetadata).map(
                                  ([value, metadata]) => (
                                    <option key={value} value={value}>
                                      {metadata.tag}
                                    </option>
                                  ),
                                )}
                              </select>
                              <input
                                key={`feedback-${entry?.updatedAt || ''}`}
                                aria-label={`${pupil.name} ${slot.slotKey} feedback`}
                                name={`feedback-${assignment.id}-${slot.slotKey}-${pupil.id}`}
                                defaultValue={feedback}
                                placeholder="Feedback"
                              />
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="modal-actions">
              <Button variant="secondary" type="button" onClick={() => setScoreGridOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">
                <Save size={15} />
                Save scores
              </Button>
            </div>
          </form>
        </Card>
      )}
      <Card className="coursework-scorebook-card">
        <div className="section-heading">
          <CardTitle
            title={student ? 'My SBA scorebook' : 'SBA consolidated scorebook'}
            description="Graded work is grouped into five SBA categories, scaled to 15 points each, then combined with the terminal exam on a 50/50 basis."
          />
          <div className="row-actions">
            <select
              aria-label="Scorebook subject"
              value={scoreSubject}
              onChange={(e) => setScoreSubjectSelection(e.target.value)}
            >
              {scoreSubjects.map((subject) => (
                <option key={subject}>{subject}</option>
              ))}
            </select>
            {!student && (
              <Button variant="secondary" onClick={scorebookExport}>
                <Download size={15} />
                Export CSV
              </Button>
            )}
          </div>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Student</th>
                <th>EXE /15</th>
                <th>HW /15</th>
                <th>GW /15</th>
                <th>Quiz /15</th>
                <th>PW /15</th>
                <th>Raw SBA /60</th>
                <th>SBA /50</th>
                <th>Exam /100</th>
                <th>Exam /50</th>
                <th>Total /100</th>
                <th>Grade</th>
                <th>Position</th>
              </tr>
            </thead>
            <tbody>
              {scorebookRows.map(({ pupil, assessment }) => (
                <tr key={pupil.id}>
                  <td>
                    <Person name={pupil.name} />
                  </td>
                  <td>{assessment.categories.Exercise ?? '—'}</td>
                  <td>{assessment.categories.Homework ?? '—'}</td>
                  <td>{assessment.categories.Groupwork ?? '—'}</td>
                  <td>{assessment.categories.Quiz ?? '—'}</td>
                  <td>{assessment.categories.Project ?? '—'}</td>
                  <td>{assessment.rawSba ?? 0}</td>
                  <td>{assessment.sba ?? 0}</td>
                  <td>{assessment.examRaw ?? '—'}</td>
                  <td>{assessment.exam ?? '—'}</td>
                  <td>
                    <strong>{assessment.total ?? 0}</strong>
                  </td>
                  <td>{assessment.grade}</td>
                  <td>{ordinal(rank(assessment.total ?? 0, rankedScores))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!scorebookRows.some(({ assessment }) => assessment.total !== null) && (
          <p className="muted">Grade submissions for {scoreSubject} to populate this scorebook.</p>
        )}
      </Card>
      {selected && (
        <Card>
          <CardTitle
            title={student ? 'My submissions' : selected.title}
            description={
              student
                ? 'Your work and the feedback that helps you grow.'
                : `${selected.subject} · Select a submission to review and grade.`
            }
          />
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>{student ? 'Assignment' : 'Student'}</th>
                  <th>Submitted</th>
                  <th>Score</th>
                  <th>Feedback</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {submissions.map((s) => {
                  const pupil = data.students.find((p) => p.id === s.studentId);
                  const late = s.date.slice(0, 10) > selected.due;
                  const recordedScore = selected.scores?.[s.studentId]?.score ?? s.score;
                  const recordedFeedback = selected.scores?.[s.studentId]?.feedback ?? s.feedback;
                  return (
                    <tr key={s.id}>
                      <td>
                        <Person
                          name={student ? selected.title : pupil?.name || 'Student'}
                          sub={late ? 'Submitted late' : 'On time'}
                        />
                      </td>
                      <td>{new Date(s.date).toLocaleDateString()}</td>
                      <td>
                        <Badge tone={recordedScore !== undefined ? 'green' : 'amber'}>
                          {recordedScore !== undefined
                            ? `${recordedScore} / ${selected.points}`
                            : 'Awaiting grade'}
                        </Badge>
                      </td>
                      <td className="feedback-cell">{recordedFeedback || 'Feedback pending'}</td>
                      <td>
                        {!student && (
                          <Button variant="ghost" onClick={() => setGrading(s)}>
                            <Pencil size={15} />
                            Review
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!submissions.length && (
            <Empty title="No submissions yet" text="Submitted work will appear here." />
          )}
        </Card>
      )}
      {create && canManageCoursework && (
        <AssignmentForm cls={cls} onClose={() => setCreate(false)} />
      )}{' '}
      {submit && <SubmissionForm assignment={submit} onClose={() => setSubmit(null)} />}{' '}
      {grading && selected && (
        <Modal title="Review submission" onClose={() => setGrading(null)}>
          <Person
            name={data.students.find((s) => s.id === grading.studentId)?.name || 'Student'}
            sub={selected.title}
          />
          <div className="submission-answer">
            {grading.text || 'No written answer provided.'}
            {grading.link && (
              <p>
                <a href={grading.link} target="_blank" rel="noreferrer">
                  Research link ↗
                </a>
              </p>
            )}
            {grading.filename && (
              <p>
                <FileText size={16} /> Attached file: {grading.filename}
              </p>
            )}
            {grading.storagePath && (
              <Button
                onClick={() => {
                  void downloadLearningFile(grading.storagePath!).catch((e: Error) =>
                    notify(e.message),
                  );
                }}
              >
                Download submitted file
              </Button>
            )}
          </div>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const score = Number(f.get('score'));
              const feedback = String(f.get('feedback'));
              if (
                !(await update((d) => {
                  const next = {
                    ...d,
                    assignments: d.assignments.map((assignment) =>
                      assignment.id === grading.assignmentId
                        ? {
                            ...assignment,
                            scores: {
                              ...assignment.scores,
                              [grading.studentId]: { score, feedback },
                            },
                          }
                        : assignment,
                    ),
                    submissions: d.submissions.map((s) =>
                      s.id === grading.id ? { ...s, score, feedback } : s,
                    ),
                  };
                  const assessment = courseworkAssessment(
                    next,
                    grading.studentId,
                    selected.classId,
                    selected.subject,
                  );
                  const key = gradeKey(grading.studentId, d.settings.term, selected.subject);
                  const grade = d.grades[key] || { sba: 0, exam: 0, remark: '' };
                  return {
                    ...next,
                    grades: {
                      ...d.grades,
                      [key]: {
                        ...grade,
                        ...(assessment.hasSba ? { sba: assessment.sba ?? 0 } : {}),
                        ...(assessment.hasExam ? { exam: assessment.exam ?? 0 } : {}),
                      },
                    },
                  };
                }, `Graded ${selected.title}`))
              )
                return;
              notify('Grade saved. The category scorebook and report card were updated.');
              setGrading(null);
            }}
          >
            <div className="form-grid">
              <Field label={`Score (out of ${selected.points})`}>
                <input
                  required
                  name="score"
                  type="number"
                  min="0"
                  max={selected.points}
                  step="0.1"
                  defaultValue={selected.scores?.[grading.studentId]?.score ?? grading.score}
                />
              </Field>
              <Field label="Feedback">
                <textarea
                  name="feedback"
                  defaultValue={grading.feedback}
                  placeholder="What went well? What’s the next step?"
                />
              </Field>
            </div>
            <div className="modal-actions">
              <Button type="submit">
                <Save size={16} />
                Save grade
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
function AssignmentForm({ cls, onClose }: { cls: string; onClose: () => void }) {
  const { data, role, me, allowedClasses, update, notify } = useStore();
  const viewerUser = data.users.find((user) => user.name === me);
  const [selectedClass, setSelectedClass] = useState(cls);
  const allowedForClass = viewerUser?.classAllowedSubjects?.[selectedClass];
  const assignmentSubjects = classSubjects(selectedClass).filter(
    (subject) =>
      role === 'Administrator' ||
      allowedForClass === undefined ||
      allowedForClass.includes(subject) ||
      allowedForClass.includes(courseworkSubjectId(subject)),
  );
  const [category, setCategory] = useState('Homework');
  const [points, setPoints] = useState('15');
  return (
    <Modal title="Create an assignment" onClose={onClose}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const selectedSubject = String(f.get('subject') || '');
          if (!assignmentSubjects.includes(selectedSubject)) {
            notify('This teacher has no subject access for the selected class.');
            return;
          }
          const a: Assignment = {
            id: uid(),
            title: String(f.get('title')),
            description: String(f.get('description')),
            classId: String(f.get('class')),
            subject: selectedSubject,
            points: Number(f.get('points')),
            due: String(f.get('due')),
            category: String(f.get('category')),
          };
          if (
            !(await update(
              (d) => ({ ...d, assignments: [a, ...d.assignments] }),
              `Assignment published: ${a.title}`,
            ))
          )
            return;
          notify('Assignment published to the class.');
          onClose();
        }}
      >
        <Field label="Assignment title">
          <input name="title" required />
        </Field>
        <Field label="Instructions">
          <textarea name="description" required rows={4} />
        </Field>
        <div className="form-grid">
          <Field label="Class">
            <select
              name="class"
              value={selectedClass}
              onChange={(event) => setSelectedClass(event.target.value)}
            >
              {allowedClasses.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field label="Subject">
            <select name="subject">
              {!assignmentSubjects.length && <option value="">No subjects assigned</option>}
              {assignmentSubjects.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
          <Field label="Assessment category">
            <select
              name="category"
              value={category}
              onChange={(e) => {
                const nextCategory = e.target.value;
                setCategory(nextCategory);
                setPoints(nextCategory === 'Terminal exam' ? '100' : '15');
              }}
            >
              <option>Homework</option>
              <option>Project</option>
              <option>Class test</option>
              <option>Practical</option>
              <option>Exercise</option>
              <option>Groupwork</option>
              <option>Terminal exam</option>
            </select>
          </Field>
          <Field label="Maximum points">
            <input
              name="points"
              type="number"
              min="1"
              max="1000"
              value={points}
              onChange={(e) => setPoints(e.target.value)}
              required
            />
          </Field>
          <Field label="Due date">
            <input name="due" type="date" defaultValue={today()} required />
          </Field>
        </div>
        <div className="modal-actions">
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Publish assignment</Button>
        </div>
      </form>
    </Modal>
  );
}
function SubmissionForm({
  assignment: a,
  onClose,
}: {
  assignment: Assignment;
  onClose: () => void;
}) {
  const { data, ownId, update, notify } = useStore();
  const existing = data.submissions.find((s) => s.assignmentId === a.id && s.studentId === ownId);
  const recordedScore = a.scores?.[ownId]?.score ?? existing?.score;
  const recordedFeedback = a.scores?.[ownId]?.feedback ?? existing?.feedback;
  return (
    <Modal title={a.title} onClose={onClose}>
      <Badge tone="blue">
        {a.subject} · {a.points} points
      </Badge>
      <p className="assignment-instructions">{a.description}</p>
      <p>Due {a.due}</p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const file = f.get('file') as File;
          const text = String(f.get('answer')),
            link = String(f.get('link'));
          if (!text.trim() && !link && !file?.size) {
            notify('Add an answer, research link, or document.');
            return;
          }
          if (file?.size > 5 * 1024 * 1024) {
            notify('Choose a document smaller than 5 MB.');
            return;
          }
          let storagePath = existing?.storagePath;
          try {
            if (isSupabaseConfigured && file?.size) storagePath = await uploadLearningFile(file);
          } catch (error) {
            notify(error instanceof Error ? error.message : 'Upload failed');
            return;
          }
          const s: Submission = {
            id: existing?.id || uid(),
            assignmentId: a.id,
            studentId: ownId,
            text,
            link,
            filename: file?.size ? file.name : existing?.filename,
            storagePath,
            date: new Date().toISOString(),
          };
          if (
            !(await update(
              (d) => ({ ...d, submissions: [...d.submissions.filter((x) => x.id !== s.id), s] }),
              `Submitted ${a.title}`,
            ))
          )
            return;
          notify('Your work has been submitted.');
          onClose();
        }}
      >
        <Field label="Your response">
          <textarea
            name="answer"
            rows={5}
            defaultValue={existing?.text}
            disabled={recordedScore !== undefined}
          />
        </Field>
        <Field label="Research link (optional)">
          <input
            name="link"
            type="url"
            pattern="https?://.*"
            defaultValue={existing?.link}
            disabled={recordedScore !== undefined}
          />
        </Field>
        <Field
          label="Document (optional)"
          hint={
            isSupabaseConfigured
              ? 'Private school storage · maximum 5 MB.'
              : 'Connect to school storage to upload documents.'
          }
        >
          <input
            name="file"
            type="file"
            accept=".pdf,.doc,.docx,.txt,.png,.jpg"
            disabled={recordedScore !== undefined}
          />
        </Field>
        {recordedScore !== undefined ? (
          <div className="notice">
            <strong>
              {recordedScore} / {a.points}
            </strong>
            <p>{recordedFeedback}</p>
          </div>
        ) : (
          <div className="modal-actions">
            <Button type="submit">{existing ? 'Update submission' : 'Submit assignment'}</Button>
          </div>
        )}
      </form>
    </Modal>
  );
}
function formatLongDate(dateStr: string) {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr + 'T12:00:00');
    if (isNaN(d.getTime())) return dateStr;
    const day = d.getDate();
    const ord = ordinal(day);
    const month = d.toLocaleDateString('en-GB', { month: 'long' });
    const year = d.getFullYear();
    return `${ord} ${month}, ${year}`;
  } catch {
    return dateStr;
  }
}

function OfficialStamp({
  term = 1,
  year = '2023/2024',
  status = 'PASSED',
  image,
}: {
  term?: number;
  year?: string;
  status?: string;
  image?: string;
}) {
  if (image) {
    return (
      <img
        className="assessment-school-stamp-image"
        src={image}
        alt={`Official school stamp for ${year}, term ${term}`}
      />
    );
  }

  return null;
}

export function Reports() {
  const { data, role, ownId, allowedClasses, update, notify, pendingCount } = useStore();
  const [params] = useSearchParams();
  const [cls, setCls] = useState(
    () => data.students.find((s) => s.id === params.get('student'))?.classId || '',
  );
  const [studentId, setStudentId] = useState(params.get('student') || ownId);
  const [reportTerm, setReportTerm] = useState(data.settings.term);
  const [editing, setEditing] = useState(false);
  const [batch, setBatch] = useState(false);
  const term = role === 'Administrator' ? reportTerm : data.settings.term;
  const viewData = { ...data, settings: { ...data.settings, term } };
  const roster = data.students
    .filter(
      (s) =>
        allowedClasses.includes(s.classId) &&
        (!cls || s.classId === cls) &&
        (role !== 'Student' || s.id === ownId),
    )
    .sort((a, b) => a.name.localeCompare(b.name));
  const student = roster.find((s) => s.id === studentId) || roster[0];
  const editable = role === 'Administrator' || role === 'Teacher';
  useEffect(() => {
    const reset = () => setBatch(false);
    window.addEventListener('afterprint', reset);
    return () => window.removeEventListener('afterprint', reset);
  }, []);
  async function printReports(all: boolean) {
    flushSync(() => setBatch(all));
    await document.fonts.ready;
    await Promise.all(
      Array.from(document.querySelectorAll<HTMLImageElement>('.report-print-stack img')).map(
        (image) => image.decode().catch(() => {}),
      ),
    );
    window.print();
  }
  const rk = student ? `${student.id}|${term}` : '';
  return (
    <>
      <PageHeader
        eyebrow="CELEBRATE THEIR PROGRESS"
        title="Termly report cards"
        description={`Academic year ${data.settings.year} · Term ${term}`}
        actions={
          <>
            {editable && (
              <Button variant="secondary" disabled={!student} onClick={() => setEditing(true)}>
                <Pencil size={16} />
                Edit report card
              </Button>
            )}
            <Button
              disabled={!student || pendingCount > 0}
              onClick={() => void printReports(false)}
            >
              <Printer size={16} />
              Print / Save PDF
            </Button>
            {editable && (
              <Button
                disabled={!cls || !roster.length || pendingCount > 0}
                onClick={() => void printReports(true)}
              >
                <Printer size={16} />
                Print selected class ({cls ? roster.length : 0})
              </Button>
            )}
          </>
        }
      />
      <div className="filter-bar report-filters">
        {role !== 'Student' && (
          <select
            aria-label="Report class"
            value={cls}
            onChange={(e) => {
              setCls(e.target.value);
              setStudentId('');
              setBatch(false);
            }}
          >
            <option value="">All classes — select a class to batch print</option>
            {allowedClasses.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        )}
        <select
          aria-label="Report student"
          value={student?.id || ''}
          onChange={(e) => {
            setStudentId(e.target.value);
            setBatch(false);
          }}
          disabled={!student}
        >
          {!student && <option value="">No students in this class</option>}
          {roster.map((s) => (
            <option value={s.id} key={s.id}>
              {s.name} · {s.classId}
            </option>
          ))}
        </select>
        {role === 'Administrator' && (
          <select
            aria-label="Report term"
            value={term}
            onChange={(e) => {
              setReportTerm(Number(e.target.value));
              setBatch(false);
            }}
          >
            {[1, 2, 3].map((t) => (
              <option key={t} value={t}>
                Term {t}
              </option>
            ))}
          </select>
        )}
        {editable && student && (
          <Button
            variant="secondary"
            disabled={pendingCount > 0}
            onClick={async () => {
              if (
                await update(
                  (d) => ({ ...d, verified: [...new Set([...d.verified, rk])] }),
                  'Report card verified',
                )
              )
                notify('Report card marked as verified.');
            }}
          >
            <CheckCircle2 size={16} />
            {data.verified.includes(rk) ? 'Verified' : 'Verify report'}
          </Button>
        )}
      </div>
      {batch && (
        <p className="report-batch-controls">
          {roster.length} reports prepared for {cls}.{' '}
          <Button variant="ghost" onClick={() => setBatch(false)}>
            Return to single report
          </Button>
        </p>
      )}
      {!student ? (
        <Empty
          title="No report cards in this class"
          text="Select another class or enroll a student."
        />
      ) : (
        <div className="report-print-stack print-area">
          {(batch ? roster : [student]).map((pupil) => (
            <ReportSheet key={pupil.id} data={viewData} student={pupil} />
          ))}
        </div>
      )}
      {editing && student && (
        <ReportCardEditor
          key={rk}
          student={student}
          reportTerm={term}
          onClose={() => setEditing(false)}
        />
      )}
    </>
  );
}

function ReportSheet({ data, student }: { data: State; student: Student }) {
  const grades = studentGrades(data, student);
  const hasGrades = grades.some(
    (g) => !!data.grades[gradeKey(student.id, data.settings.term, g.subject)],
  );
  const peers = data.students.filter((s) => s.classId === student.classId);
  const avg = average(data, student);
  const position = rank(
    avg,
    peers.map((s) => average(data, s)),
  );
  const marks = Object.entries(data.attendance).filter(([k]) =>
    k.endsWith(`|${data.settings.term}|${student.id}`),
  );
  const attended = marks.filter(([, v]) => v === 'Present' || v === 'Late').length;
  const rk = `${student.id}|${data.settings.term}`;

  // Calculations for total aggregates
  const totalSBA = grades.reduce((sum, g) => sum + g.sba, 0);
  const totalExam = grades.reduce((sum, g) => sum + g.exam, 0);
  const grandTotal = totalSBA + totalExam;
  const overallPercent = grades.length ? (grandTotal / (grades.length * 100)) * 100 : 0;
  const overallGrade = gradeLetter(overallPercent);

  const conductData = data.conduct[rk] || {};
  const traits = [
    { label: 'Conduct:', value: conductData['Conduct'] || '—' },
    { label: 'Work Ethic:', value: conductData['Work Ethic'] || '—' },
    { label: 'Neatness:', value: conductData['Neatness'] || '—' },
    { label: 'Sociability:', value: conductData['Sociability'] || '—' },
    { label: 'Debate & Oratory:', value: conductData['Debate & Oratory'] || '—' },
    { label: 'Science Expo:', value: conductData['Science Expo'] || '—' },
    { label: 'Mental Drill:', value: conductData['Mental Drill'] || '—' },
    {
      label: 'Reading Comprehension:',
      value: conductData['Reading Comprehension'] || '—',
    },
  ];

  const customAttended =
    conductData['attendanceAttended'] !== undefined && conductData['attendanceAttended'] !== ''
      ? conductData['attendanceAttended']
      : marks.length
        ? attended
        : '—';
  const customTotalSessions =
    conductData['attendanceTotal'] !== undefined && conductData['attendanceTotal'] !== ''
      ? conductData['attendanceTotal']
      : marks.length || '—';
  const customRoll = conductData['rollOverride'] || `${peers.length} Pupils`;
  const customPosition =
    conductData['positionOverride'] ||
    (hasGrades ? `${ordinal(position)} of ${peers.length}` : '—');

  const teacherRemark = data.remarks[rk] || '';
  const promotedTo = conductData['promotedTo'] || '';

  return (
    <article className="assessment-card-sheet">
      {/* Header Section */}
      <header className="assessment-header">
        <img
          className="assessment-crest"
          src={data.settings.crest || './crest.svg'}
          alt="School crest"
        />
        <h1 className="assessment-school-title">{data.settings.name}</h1>
        <div className="assessment-school-sub">
          {[data.settings.address, data.settings.motto].filter(Boolean).join(' • ')}
        </div>
        <div className="assessment-pill-title">BASIC SCHOOL ASSESSMENT CARD</div>
      </header>

      {/* Student Information Box */}
      <section className="assessment-info-box">
        <div className="assessment-info-grid">
          <div className="assessment-info-cell">
            <small>NAME OF PUPIL</small>
            <strong>{student.name.toUpperCase()}</strong>
          </div>
          <div className="assessment-info-cell">
            <small>CLASS</small>
            <strong>{student.classId.toUpperCase()}</strong>
          </div>
          <div className="assessment-info-cell">
            <small>TERM & ACADEMIC YEAR</small>
            <strong>
              Term {data.settings.term} ({data.settings.year})
            </strong>
          </div>
          <div className="assessment-info-cell">
            <small>NO. ON ROLL</small>
            <strong>{customRoll}</strong>
          </div>

          <div className="assessment-info-cell">
            <small>POSITION IN CLASS</small>
            <strong style={{ color: '#1d4ed8' }}>{customPosition}</strong>
          </div>
          <div className="assessment-info-cell">
            <small>ADMISSION NUMBER</small>
            <strong>{student.id.toUpperCase()}</strong>
          </div>
          <div className="assessment-info-cell">
            <small>VACATION DATE</small>
            <strong>{formatLongDate(data.settings.vacation)}</strong>
          </div>
          <div className="assessment-info-cell">
            <small>NEXT TERM BEGINS</small>
            <strong>{formatLongDate(data.settings.reopening)}</strong>
          </div>
        </div>

        <div className="assessment-photo-container">
          <div className="assessment-photo-frame">
            {student.photo ? (
              <img
                src={student.photo}
                alt={student.name}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <>
                <GraduationCap size={24} color="#94a3b8" />
                <span style={{ fontSize: '7.5px', color: '#94a3b8', marginTop: 2 }}>
                  2" X 2" PHOTO
                </span>
              </>
            )}
          </div>
          <span className="assessment-photo-label">STUDENT PHOTO</span>
        </div>
      </section>

      {/* Academic Performance Table */}
      <div className="assessment-table-wrap">
        <table className="assessment-table">
          <thead>
            <tr>
              <th style={{ textAlign: 'left', width: '35%' }}>SUBJECTS</th>
              <th style={{ width: '15%' }}>CLASS SCORE (SBA 50%)</th>
              <th style={{ width: '14%' }}>EXAMS SCORE (50%)</th>
              <th style={{ width: '14%' }}>TOTAL SCORE (100%)</th>
              <th style={{ width: '9%' }}>POS.</th>
              <th style={{ width: '13%' }}>REMARKS</th>
            </tr>
          </thead>
          <tbody>
            {grades.map((g) => {
              const recorded = !!data.grades[gradeKey(student.id, data.settings.term, g.subject)];
              const total = g.sba + g.exam;
              const isSBAOnly = g.sba > 0 && g.exam === 0;
              const subjectRank = ordinal(
                rank(
                  total,
                  peers.map((s) => {
                    const v = data.grades[gradeKey(s.id, data.settings.term, g.subject)];
                    return v ? v.sba + v.exam : 0;
                  }),
                ),
              );

              let remarkText = g.remark;
              if (!remarkText) {
                if (total >= 80) remarkText = 'EXCELLENT';
                else if (total >= 70) remarkText = 'VERY GOOD';
                else if (total >= 60) remarkText = 'GOOD';
                else if (total >= 50) remarkText = 'CREDIT';
                else if (total >= 40) remarkText = 'PASS';
                else if (total > 0) remarkText = 'FAIL';
                else remarkText = '-';
              }

              return (
                <tr key={g.subject}>
                  <td className="subject-col">{g.subject}</td>
                  <td>{recorded ? g.sba : '-'}</td>
                  <td>{recorded ? g.exam : '-'}</td>
                  <td style={{ fontWeight: 800 }}>{recorded ? total : '-'}</td>
                  <td>{recorded ? subjectRank : '-'}</td>
                  <td>
                    {isSBAOnly ? (
                      <span
                        style={{
                          color: '#b91c1c',
                          fontWeight: '800',
                          fontSize: '9.5px',
                          lineHeight: '1.1',
                          display: 'block',
                        }}
                      >
                        SBA
                        <br />
                        ONLY
                      </span>
                    ) : (
                      <span style={{ fontWeight: 700, fontSize: '9.5px' }}>{remarkText}</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {/* Total Aggregate Row */}
            <tr style={{ background: '#f8fafc', fontWeight: 800 }}>
              <td className="subject-col" style={{ fontWeight: 850 }}>
                TOTAL / AGGREGATE
              </td>
              <td style={{ color: '#1d4ed8', fontWeight: 800 }}>{hasGrades ? totalSBA : '-'}</td>
              <td style={{ fontWeight: 800 }}>{hasGrades ? totalExam : '-'}</td>
              <td style={{ fontWeight: 850, fontSize: '12px' }}>{hasGrades ? grandTotal : '-'}</td>
              <td style={{ fontWeight: 800 }}>{hasGrades ? ordinal(position) : '—'}</td>
              <td style={{ padding: '4px 6px' }}>
                <div style={{ lineHeight: '1.1' }}>
                  <span style={{ fontSize: '8px', color: '#64748b', display: 'block' }}>
                    OVERALL:
                  </span>
                  <strong style={{ fontSize: '10.5px' }}>
                    {hasGrades ? `${overallGrade} (${Math.round(overallPercent)}%)` : '—'}
                  </strong>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Attitudes & Personal Development */}
      <section className="assessment-box">
        <div className="assessment-box-title">ATTITUDES & PERSONAL DEVELOPMENT</div>
        <div className="assessment-attitudes-grid">
          {traits.map((t) => (
            <div key={t.label} className="assessment-attitude-item">
              <span>{t.label}</span> <strong>{t.value}</strong>
            </div>
          ))}
        </div>
      </section>

      {/* Attendance & Promotion Bar */}
      <section className="assessment-bar">
        <div>
          ATTENDANCE: <strong style={{ color: '#1d4ed8' }}>{customAttended}</strong> OUT OF{' '}
          <strong>{customTotalSessions}</strong> SESSIONS
        </div>
        <div>
          PROMOTED TO: <strong>{promotedTo || '—'}</strong>
        </div>
      </section>

      {/* Remarks & Signatures */}
      <section className="assessment-remarks-container">
        <div className="assessment-remark-row">
          <div className="assessment-remark-content">
            <span className="assessment-remark-label">CLASS TEACHER'S REMARKS:</span>
            <p className="assessment-remark-text">"{teacherRemark}"</p>
            <div className="assessment-signature-line">
              Class Teacher's Signature: ______________________
            </div>
          </div>
          <div className="assessment-school-stamp">
            <OfficialStamp
              term={data.settings.term}
              year={data.settings.year}
              status={grandTotal > 0 && overallPercent >= 40 ? 'PASSED' : 'VALIDATED'}
              image={data.settings.reportStamps?.[`${data.settings.year}|${data.settings.term}`]}
            />
          </div>
        </div>
      </section>
    </article>
  );
}

function ReportCardEditor({
  student,
  reportTerm,
  onClose,
}: {
  student: Student;
  reportTerm: number;
  onClose: () => void;
}) {
  const { data, update, notify, role, user } = useStore();
  const rk = `${student.id}|${reportTerm}`;
  const conductData = data.conduct[rk] || {};

  // Form states for Pupil & School Info
  const [name, setName] = useState(student.name);
  const [classId, setClassId] = useState(student.classId);
  const [year, setYear] = useState(data.settings.year);
  const [term, setTerm] = useState(reportTerm);
  const [vacation, setVacation] = useState(data.settings.vacation);
  const [reopening, setReopening] = useState(data.settings.reopening);
  const [photo, setPhoto] = useState(student.photo || '');
  const [schoolLogo, setSchoolLogo] = useState(data.settings.crest || '');
  const [reportStamps, setReportStamps] = useState(data.settings.reportStamps || {});
  const [rollOverride, setRollOverride] = useState(conductData['rollOverride'] || '');
  const [positionOverride, setPositionOverride] = useState(conductData['positionOverride'] || '');

  // Attendance & Promotion
  const marks = Object.entries(data.attendance).filter(([k]) =>
    k.endsWith(`|${reportTerm}|${student.id}`),
  );
  const defaultAttended = marks.filter(([, v]) => v === 'Present' || v === 'Late').length;
  const defaultTotalSessions = marks.length;

  const [attended, setAttended] = useState(
    conductData['attendanceAttended'] !== undefined
      ? String(conductData['attendanceAttended'])
      : marks.length
        ? String(defaultAttended)
        : '',
  );
  const [totalSessions, setTotalSessions] = useState(
    conductData['attendanceTotal'] !== undefined
      ? String(conductData['attendanceTotal'])
      : marks.length
        ? String(defaultTotalSessions)
        : '',
  );
  const [promotedTo, setPromotedTo] = useState(conductData['promotedTo'] || '');

  // Subject Grades
  const [grades, setGrades] = useState<
    { subject: string; sba: number | string; exam: number | string; remark: string }[]
  >(
    studentGrades({ ...data, settings: { ...data.settings, term: reportTerm } }, student)
      .filter(
        (g) => role === 'Administrator' || (user && canTeach(user, student.classId, g.subject)),
      )
      .map((g) => ({
        subject: g.subject,
        sba: data.grades[gradeKey(student.id, reportTerm, g.subject)]?.sba ?? '',
        exam: data.grades[gradeKey(student.id, reportTerm, g.subject)]?.exam ?? '',
        remark: g.remark || '',
      })),
  );

  // Remarks
  const [teacherRemark, setTeacherRemark] = useState(data.remarks[rk] || '');
  // Attitudes / Traits
  const traitKeys = [
    'Conduct',
    'Work Ethic',
    'Neatness',
    'Sociability',
    'Debate & Oratory',
    'Science Expo',
    'Mental Drill',
    'Reading Comprehension',
  ];
  const [conduct, setConduct] = useState<Record<string, string>>({ ...conductData });

  // Calculation summaries
  const totalSBA = grades.reduce((sum, g) => sum + (Number(g.sba) || 0), 0);
  const totalExam = grades.reduce((sum, g) => sum + (Number(g.exam) || 0), 0);
  const grandTotal = totalSBA + totalExam;
  const overallPercent = grades.length ? (grandTotal / (grades.length * 100)) * 100 : 0;
  const overallGrade = gradeLetter(overallPercent);

  function handlePhotoUpload(file: File) {
    if (file.size > 500000) {
      notify('Please select an image under 500 KB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setPhoto(String(reader.result));
    reader.onerror = () => notify('The student photo could not be read.');
    reader.readAsDataURL(file);
  }

  function handleSchoolLogoUpload(file: File) {
    if (!['image/png', 'image/jpeg'].includes(file.type)) {
      notify('Choose a PNG or JPEG image for the school logo.');
      return;
    }
    if (file.size > 500000) {
      notify('Choose a school logo image under 500 KB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setSchoolLogo(String(reader.result));
    reader.onerror = () => notify('The school logo image could not be read.');
    reader.readAsDataURL(file);
  }

  const reportStampKey = `${year}|${term}`;
  const reportStamp = reportStamps[reportStampKey] || '';

  function handleStampUpload(file: File) {
    if (!['image/png', 'image/jpeg'].includes(file.type)) {
      notify('Choose a PNG or JPEG image for the school stamp.');
      return;
    }
    if (file.size > 500000) {
      notify('Choose a school stamp image under 500 KB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () =>
      setReportStamps((current) => ({ ...current, [reportStampKey]: String(reader.result) }));
    reader.onerror = () => notify('The school stamp image could not be read.');
    reader.readAsDataURL(file);
  }

  function addSubject() {
    setGrades([...grades, { subject: '', sba: '', exam: '', remark: '' }]);
  }

  function removeSubject(index: number) {
    setGrades(grades.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (
      !(await update((d) => {
        // 1. Update student data
        const updatedStudents = d.students.map((s) =>
          s.id === student.id
            ? {
                ...s,
                name: name.trim() || s.name,
                classId: classId || s.classId,
                photo: photo || undefined,
              }
            : s,
        );

        // 2. Update settings if admin modified academic dates/year/term
        const updatedSettings = {
          ...d.settings,
          year: year || d.settings.year,
          term: d.settings.term,
          vacation,
          reopening,
        };

        // 3. Update grades for this student and term
        const updatedGrades = { ...d.grades };
        // Remove any existing grades for this student & term
        for (const key of Object.keys(updatedGrades)) {
          if (
            key.startsWith(`${student.id}|${term}|`) &&
            (role === 'Administrator' ||
              grades.some((g) => key === gradeKey(student.id, term, g.subject)))
          ) {
            delete updatedGrades[key];
          }
        }
        for (const g of grades) {
          if (g.subject.trim() && (g.sba !== '' || g.exam !== '' || g.remark.trim())) {
            updatedGrades[gradeKey(student.id, Number(term), g.subject.trim())] = {
              sba: Math.min(50, Math.max(0, Number(g.sba) || 0)),
              exam: Math.min(50, Math.max(0, Number(g.exam) || 0)),
              remark: g.remark.trim(),
            };
          }
        }

        // 4. Update remarks
        const updatedRemarks = {
          ...d.remarks,
          [`${student.id}|${term}`]: teacherRemark,
        };

        // 5. Update conduct & traits & custom overrides
        const updatedConduct = {
          ...d.conduct,
          [`${student.id}|${term}`]: {
            ...conduct,
            promotedTo,
            attendanceAttended: attended,
            attendanceTotal: totalSessions,
            rollOverride: rollOverride.trim(),
            positionOverride: positionOverride.trim(),
          },
        };

        return {
          ...d,
          students: role === 'Administrator' ? updatedStudents : d.students,
          settings:
            role === 'Administrator'
              ? {
                  ...updatedSettings,
                  crest: schoolLogo,
                  reportStamps,
                }
              : d.settings,
          grades: updatedGrades,
          remarks: updatedRemarks,
          conduct: updatedConduct,
          verified: d.verified.filter((k) => k !== `${student.id}|${term}`),
        };
      }, `Report card updated for ${student.name}`))
    )
      return;

    notify('Report card changes saved successfully.');
    onClose();
  }

  return (
    <Modal title={`Edit Report Card · ${student.name}`} onClose={onClose} wide>
      <form onSubmit={handleSubmit} className="report-card-editor-form">
        <fieldset className="editor-fieldset" disabled={role !== 'Administrator'}>
          <legend>Global School Logo</legend>
          <p className="muted">
            This logo replaces the graduation-cap mark on every report card and throughout the
            system.
          </p>
          <div className="report-logo-editor">
            <img src={schoolLogo || './crest.svg'} alt="School logo preview" />
            <div>
              <Field
                label="Upload school logo"
                hint="PNG or JPEG, up to 500 KB. Save changes to publish it globally."
              >
                <input
                  type="file"
                  accept="image/png,image/jpeg"
                  aria-label="Upload school logo"
                  onChange={(e) => {
                    const file = e.currentTarget.files?.[0];
                    if (file) handleSchoolLogoUpload(file);
                    e.currentTarget.value = '';
                  }}
                />
              </Field>
              {schoolLogo && (
                <Button variant="secondary" type="button" onClick={() => setSchoolLogo('')}>
                  Use graduation-cap mark
                </Button>
              )}
            </div>
          </div>
        </fieldset>

        {/* Section 1: Pupil & Term Information */}
        <fieldset className="editor-fieldset">
          <legend>Pupil & Academic Information</legend>
          <div className="form-grid" style={{ marginBottom: 12 }}>
            <Field label="Pupil Full Name">
              <input
                required
                value={name}
                readOnly={role !== 'Administrator'}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. KWAME MENSAH"
              />
            </Field>
            <Field label="Class">
              <select
                value={classId}
                disabled={role !== 'Administrator'}
                onChange={(e) => setClassId(e.target.value)}
              >
                {(data.classes || []).map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Academic Year">
              <input
                required
                value={year}
                readOnly={role !== 'Administrator'}
                onChange={(e) => setYear(e.target.value)}
                placeholder="2023/2024"
              />
            </Field>
            <Field label="Academic Term">
              <select value={term} disabled>
                <option value={1}>Term 1</option>
                <option value={2}>Term 2</option>
                <option value={3}>Term 3</option>
              </select>
            </Field>
          </div>

          <div className="form-grid" style={{ marginBottom: 12 }}>
            <Field label="Vacation Date">
              <input
                type="date"
                value={vacation}
                readOnly={role !== 'Administrator'}
                onChange={(e) => setVacation(e.target.value)}
              />
            </Field>
            <Field label="Next Term Begins Date">
              <input
                type="date"
                value={reopening}
                readOnly={role !== 'Administrator'}
                onChange={(e) => setReopening(e.target.value)}
              />
            </Field>
            <Field label="No. on Roll (Custom or Auto)" hint="Leave blank to use class count">
              <input
                value={rollOverride}
                placeholder="e.g. 42 Pupils"
                onChange={(e) => setRollOverride(e.target.value)}
              />
            </Field>
            <Field label="Position in Class (Custom or Auto)" hint="Leave blank to auto-rank">
              <input
                value={positionOverride}
                placeholder="e.g. 1st of 42"
                onChange={(e) => setPositionOverride(e.target.value)}
              />
            </Field>
          </div>

          <div className="form-grid">
            <Field label="Student Photo" hint="Upload or paste image URL">
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => e.target.files?.[0] && handlePhotoUpload(e.target.files[0])}
                  style={{ flex: 1 }}
                />
                {photo && (
                  <Button
                    variant="secondary"
                    type="button"
                    onClick={() => setPhoto('')}
                    style={{ padding: '6px 10px', minHeight: 32 }}
                  >
                    Remove
                  </Button>
                )}
              </div>
            </Field>
            <Field label="Promoted to (e.g. Basic 2 / Junior High 1)">
              <input
                value={promotedTo}
                placeholder="e.g. Basic 5 - Gold"
                onChange={(e) => setPromotedTo(e.target.value)}
              />
            </Field>
          </div>
        </fieldset>

        {/* School stamps are shared by all report cards for this academic year and term. */}
        <fieldset className="editor-fieldset" style={{ marginTop: 14 }}>
          <legend>
            School Stamp · {year} · Term {term}
          </legend>
          <p className="muted">
            {role === 'Administrator'
              ? 'This stamp is shared across every report card for the selected academic year and term.'
              : 'The official stamp is shared across every report card for the selected academic year and term.'}
          </p>
          <div className="report-stamp-editor">
            {reportStamp ? (
              <img src={reportStamp} alt={`School stamp for ${year}, term ${term}`} />
            ) : (
              <OfficialStamp term={term} year={year} />
            )}
            {role === 'Administrator' && (
              <div>
                <Field label="Upload school stamp" hint="PNG or JPEG, up to 500 KB.">
                  <input
                    type="file"
                    accept="image/png,image/jpeg"
                    aria-label="Upload school stamp"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleStampUpload(file);
                      e.currentTarget.value = '';
                    }}
                  />
                </Field>
                {reportStamp && (
                  <Button
                    variant="secondary"
                    type="button"
                    onClick={() =>
                      setReportStamps((current) => {
                        const remaining = { ...current };
                        delete remaining[reportStampKey];
                        return remaining;
                      })
                    }
                  >
                    Use generated stamp
                  </Button>
                )}
              </div>
            )}
          </div>
        </fieldset>

        {/* Section 2: Attendance */}
        <fieldset className="editor-fieldset" style={{ marginTop: 14 }}>
          <legend>Attendance Record</legend>
          <div className="form-grid">
            <Field label="Sessions Attended">
              <input
                type="number"
                min="0"
                max="300"
                value={attended}
                onChange={(e) => setAttended(e.target.value)}
                placeholder="e.g. 20"
              />
            </Field>
            <Field label="Total Sessions">
              <input
                type="number"
                min="1"
                max="300"
                value={totalSessions}
                onChange={(e) => setTotalSessions(e.target.value)}
                placeholder="e.g. 20"
              />
            </Field>
          </div>
        </fieldset>

        {/* Section 3: Subject Scores & Remarks */}
        <fieldset className="editor-fieldset" style={{ marginTop: 14 }}>
          <legend
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
          >
            <span>Subject Scores (SBA & Exams)</span>
          </legend>

          <div className="table-scroll" style={{ marginBottom: 12 }}>
            <table className="editor-grades-table">
              <thead>
                <tr>
                  <th style={{ minWidth: 160 }}>Subject</th>
                  <th style={{ width: 100 }}>SBA (50%)</th>
                  <th style={{ width: 100 }}>Exam (50%)</th>
                  <th style={{ width: 90 }}>Total (100%)</th>
                  <th style={{ minWidth: 140 }}>Subject Remark</th>
                  <th style={{ width: 50 }}></th>
                </tr>
              </thead>
              <tbody>
                {grades.map((g, i) => {
                  const subTotal = (Number(g.sba) || 0) + (Number(g.exam) || 0);
                  return (
                    <tr key={i}>
                      <td>
                        <input
                          aria-label={`Subject name ${i + 1}`}
                          value={g.subject}
                          required
                          onChange={(e) =>
                            setGrades((gs) =>
                              gs.map((v, j) => (j === i ? { ...v, subject: e.target.value } : v)),
                            )
                          }
                          placeholder="Subject Name"
                        />
                      </td>
                      <td>
                        <input
                          aria-label={`${g.subject} SBA`}
                          type="number"
                          min="0"
                          max="50"
                          step="1"
                          value={g.sba}
                          onChange={(e) =>
                            setGrades((gs) =>
                              gs.map((v, j) =>
                                j === i
                                  ? {
                                      ...v,
                                      sba: e.target.value === '' ? '' : Number(e.target.value),
                                    }
                                  : v,
                              ),
                            )
                          }
                        />
                      </td>
                      <td>
                        <input
                          aria-label={`${g.subject} Exam`}
                          type="number"
                          min="0"
                          max="50"
                          step="1"
                          value={g.exam}
                          onChange={(e) =>
                            setGrades((gs) =>
                              gs.map((v, j) =>
                                j === i
                                  ? {
                                      ...v,
                                      exam: e.target.value === '' ? '' : Number(e.target.value),
                                    }
                                  : v,
                              ),
                            )
                          }
                        />
                      </td>
                      <td style={{ fontWeight: 800, textAlign: 'center' }}>
                        {subTotal > 0 ? subTotal : 0}
                      </td>
                      <td>
                        <input
                          aria-label={`${g.subject} Remark`}
                          placeholder="e.g. EXCELLENT, VERY GOOD, PASS"
                          value={g.remark}
                          onChange={(e) =>
                            setGrades((gs) =>
                              gs.map((v, j) => (j === i ? { ...v, remark: e.target.value } : v)),
                            )
                          }
                        />
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {grades.length > 1 && (
                          <button
                            type="button"
                            className="icon-btn"
                            aria-label={`Delete ${g.subject}`}
                            title="Delete subject"
                            onClick={() => removeSubject(i)}
                            style={{ color: '#ef4444' }}
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'var(--card-subtle, #f8fafc)',
              padding: '8px 12px',
              borderRadius: 6,
              border: '1px solid var(--line, #e2e8f0)',
              marginBottom: 10,
            }}
          >
            <Button
              variant="secondary"
              type="button"
              onClick={addSubject}
              style={{ minHeight: 34, padding: '6px 12px' }}
            >
              <Plus size={15} /> Add Subject Row
            </Button>
            <div style={{ display: 'flex', gap: 16, fontSize: '12px', fontWeight: 700 }}>
              <span>
                Total SBA: <strong>{totalSBA}</strong>
              </span>
              <span>
                Total Exam: <strong>{totalExam}</strong>
              </span>
              <span>
                Grand Total: <strong style={{ color: '#1d4ed8' }}>{grandTotal}</strong> /{' '}
                {grades.length * 100}
              </span>
              <span>
                Overall:{' '}
                <strong>
                  {overallGrade} ({Math.round(overallPercent)}%)
                </strong>
              </span>
            </div>
          </div>
        </fieldset>

        {/* Section 4: Attitudes & Personal Development */}
        <fieldset className="editor-fieldset" style={{ marginTop: 14 }}>
          <legend>Attitudes & Personal Development</legend>
          <div className="form-grid">
            {traitKeys.map((k) => (
              <Field key={k} label={k}>
                <input
                  value={conduct[k] ?? ''}
                  placeholder={
                    k === 'Conduct'
                      ? 'EXEMPLARY'
                      : k === 'Work Ethic'
                        ? 'COMMENDABLE'
                        : k === 'Neatness'
                          ? 'NEAT & ORDERLY'
                          : k === 'Sociability'
                            ? 'RESPECTFUL'
                            : k === 'Debate & Oratory'
                              ? 'VERY ACTIVE'
                              : k === 'Science Expo'
                                ? 'INNOVATIVE'
                                : k === 'Mental Drill'
                                  ? 'QUICK & SHARP'
                                  : 'FLUENT & EXPRESSIVE'
                  }
                  onChange={(e) => setConduct({ ...conduct, [k]: e.target.value })}
                />
              </Field>
            ))}
          </div>
        </fieldset>

        {/* Section 5: Remarks */}
        <fieldset className="editor-fieldset" style={{ marginTop: 14 }}>
          <legend>Class Teacher Remarks</legend>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Field label="Class Teacher’s Remarks">
              <textarea
                rows={3}
                value={teacherRemark}
                onChange={(e) => setTeacherRemark(e.target.value)}
                placeholder="Enter class teacher remark..."
              />
            </Field>
          </div>
        </fieldset>

        {/* Footer Actions: Save and Cancel */}
        <div className="modal-actions" style={{ marginTop: 20 }}>
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">
            <Save size={16} />
            Save changes
          </Button>
        </div>
      </form>
    </Modal>
  );
}
