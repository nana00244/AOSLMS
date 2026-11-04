import { useState, useMemo } from 'react';
import {
  FileQuestion,
  Plus,
  Play,
  Calendar,
  Users,
  CheckCircle2,
  Clock,
  Trophy,
  Filter,
  Eye,
  Award,
  Layers,
  ChevronRight,
  BookOpen,
  ArrowRight,
} from 'lucide-react';
import { Button } from './ui';
import { naccaSubjects } from '../learningHub/naccaBank';
import {
  listQuizzes,
  listQuizSubmissions,
  type QuizDefinition,
  type QuizSubmissionRecord,
} from '../nacca/quizEngine';

interface Props {
  staff: boolean;
  studentId?: string;
  studentName?: string;
  onOpenCreator: () => void;
  onStartQuiz: (quiz: QuizDefinition) => void;
  onOpenPractice: (indicatorCode: string) => void;
}

export function QuizManagementView({
  staff,
  studentId = 'student_demo',
  studentName = 'Learner',
  onOpenCreator,
  onStartQuiz,
  onOpenPractice,
}: Props) {
  const [filterSubject, setFilterSubject] = useState<string>('ALL');
  const [filterLevel, setFilterLevel] = useState<string>('ALL');
  const [filterKind, setFilterKind] = useState<string>('ALL');
  const [selectedQuizForSubmissions, setSelectedQuizForSubmissions] =
    useState<QuizDefinition | null>(null);

  const quizzes = useMemo(() => {
    return listQuizzes();
  }, []);

  const allSubmissions = useMemo(() => {
    return listQuizSubmissions();
  }, []);

  // Filtered quizzes
  const filtered = useMemo(() => {
    return quizzes.filter((q) => {
      if (filterSubject !== 'ALL' && q.subject !== filterSubject) return false;
      if (filterLevel !== 'ALL' && q.level !== filterLevel) return false;
      if (filterKind !== 'ALL' && q.kind !== filterKind) return false;
      return true;
    });
  }, [quizzes, filterSubject, filterLevel, filterKind]);

  // Aggregate stats
  const totalQuizzes = quizzes.length;
  const unitTestsCount = quizzes.filter((q) => q.kind === 'unit_test').length;
  const submissionsCount = allSubmissions.length;
  const awaitingMarkingCount = allSubmissions.filter(
    (s) => s.status === 'awaiting teacher marking',
  ).length;

  return (
    <div style={{ padding: '4px 0' }}>
      {/* Top Banner & Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: '#fff',
          padding: '20px 24px',
          borderRadius: 12,
          border: '1px solid #e2e8f0',
          marginBottom: 20,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              backgroundColor: '#eff6ff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Trophy size={24} color="#1865f2" />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#1e293b' }}>
              NaCCA Quizzes & Unit Tests
            </h2>
            <p style={{ margin: '3px 0 0', fontSize: 13, color: '#64748b' }}>
              Randomized assessments from approved NaCCA bank · Instant auto-grading & separate
              teacher marks
            </p>
          </div>
        </div>

        {staff && (
          <Button onClick={onOpenCreator}>
            <Plus size={16} /> Create Quiz or Unit Test
          </Button>
        )}
      </div>

      {/* Overview Stat Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16,
          marginBottom: 24,
        }}
      >
        <div
          style={{
            backgroundColor: '#fff',
            borderRadius: 10,
            padding: 16,
            border: '1px solid #e2e8f0',
          }}
        >
          <div
            style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}
          >
            Total Assessments
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#1e293b', marginTop: 6 }}>
            {totalQuizzes}
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
            {unitTestsCount} unit tests · {totalQuizzes - unitTestsCount} quizzes
          </div>
        </div>

        <div
          style={{
            backgroundColor: '#fff',
            borderRadius: 10,
            padding: 16,
            border: '1px solid #e2e8f0',
          }}
        >
          <div
            style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}
          >
            Student Submissions
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#1e293b', marginTop: 6 }}>
            {submissionsCount}
          </div>
          <div style={{ fontSize: 12, color: '#16a34a', marginTop: 2 }}>All attempts recorded</div>
        </div>

        <div
          style={{
            backgroundColor: '#fff',
            borderRadius: 10,
            padding: 16,
            border: '1px solid #e2e8f0',
          }}
        >
          <div
            style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}
          >
            Awaiting Teacher Marking
          </div>
          <div
            style={{
              fontSize: 24,
              fontWeight: 800,
              color: awaitingMarkingCount > 0 ? '#d97706' : '#1e293b',
              marginTop: 6,
            }}
          >
            {awaitingMarkingCount}
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
            Written, oral & practical tasks
          </div>
        </div>

        <div
          style={{
            backgroundColor: '#fff',
            borderRadius: 10,
            padding: 16,
            border: '1px solid #e2e8f0',
          }}
        >
          <div
            style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}
          >
            Score Separation (Rule 4)
          </div>
          <div
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: '#16a34a',
              marginTop: 8,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <CheckCircle2 size={16} /> Enforced Strictly
          </div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
            Auto & Teacher marks never merged
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16,
          backgroundColor: '#fff',
          padding: '12px 18px',
          borderRadius: 8,
          border: '1px solid #e2e8f0',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: '#475569',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Filter size={15} /> Filter:
          </span>

          <select
            value={filterSubject}
            onChange={(e) => setFilterSubject(e.target.value)}
            style={{
              padding: '6px 10px',
              borderRadius: 6,
              border: '1px solid #cbd5e1',
              fontSize: 12,
              backgroundColor: '#fff',
            }}
          >
            <option value="ALL">All Subjects</option>
            {naccaSubjects.map((s) => (
              <option key={s.id} value={s.name}>
                {s.name}
              </option>
            ))}
          </select>

          <select
            value={filterLevel}
            onChange={(e) => setFilterLevel(e.target.value)}
            style={{
              padding: '6px 10px',
              borderRadius: 6,
              border: '1px solid #cbd5e1',
              fontSize: 12,
              backgroundColor: '#fff',
            }}
          >
            <option value="ALL">All Levels</option>
            <option value="Basic 1">Basic 1</option>
            <option value="Basic 2">Basic 2</option>
            <option value="Basic 3">Basic 3</option>
            <option value="Basic 4">Basic 4</option>
            <option value="Basic 5">Basic 5</option>
            <option value="Basic 6">Basic 6</option>
          </select>

          <select
            value={filterKind}
            onChange={(e) => setFilterKind(e.target.value)}
            style={{
              padding: '6px 10px',
              borderRadius: 6,
              border: '1px solid #cbd5e1',
              fontSize: 12,
              backgroundColor: '#fff',
            }}
          >
            <option value="ALL">All Kinds</option>
            <option value="quiz">⚡ Quizzes</option>
            <option value="unit_test">🏆 Unit Tests</option>
          </select>
        </div>

        <span style={{ fontSize: 12, color: '#64748b' }}>
          Showing {filtered.length} of {quizzes.length} assessments
        </span>
      </div>

      {/* Quizzes List */}
      {filtered.length === 0 ? (
        <div
          style={{
            backgroundColor: '#fff',
            borderRadius: 12,
            padding: '48px 24px',
            textAlign: 'center',
            border: '1px dashed #cbd5e1',
          }}
        >
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: '50%',
              backgroundColor: '#eff6ff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 12px',
            }}
          >
            <FileQuestion size={28} color="#1865f2" />
          </div>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1e293b' }}>
            No Quizzes or Unit Tests Found
          </h3>
          <p style={{ margin: '6px 0 20px', fontSize: 13, color: '#64748b' }}>
            {staff
              ? 'Create your first quiz or unit test from the approved NaCCA question bank.'
              : 'No assessments have been assigned yet.'}
          </p>
          {staff && (
            <Button onClick={onOpenCreator}>
              <Plus size={16} /> Create Assessment Now
            </Button>
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
          {filtered.map((quiz) => {
            const quizSubs = allSubmissions.filter((s) => s.quizId === quiz.id);
            const mySub = quizSubs.find((s) => s.studentId === studentId);
            const isCompleted = Boolean(mySub);

            return (
              <div
                key={quiz.id}
                style={{
                  backgroundColor: '#fff',
                  borderRadius: 12,
                  border: '1px solid #e2e8f0',
                  padding: 20,
                  display: 'flex',
                  flexDirection: 'column',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                }}
              >
                {/* Header tags */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 10,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        backgroundColor: quiz.kind === 'unit_test' ? '#fef3c7' : '#eff6ff',
                        color: quiz.kind === 'unit_test' ? '#92400e' : '#1865f2',
                        padding: '3px 8px',
                        borderRadius: 4,
                      }}
                    >
                      {quiz.kind === 'unit_test' ? '🏆 UNIT TEST' : '⚡ QUIZ'}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        backgroundColor: '#f1f5f9',
                        color: '#475569',
                        padding: '3px 8px',
                        borderRadius: 4,
                      }}
                    >
                      {quiz.level} · {quiz.subject}
                    </span>
                  </div>

                  <span
                    style={{
                      fontSize: 11,
                      color: '#64748b',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <Calendar size={13} /> Due: {new Date(quiz.dueDate).toLocaleDateString()}
                  </span>
                </div>

                {/* Title */}
                <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700, color: '#1e293b' }}>
                  {quiz.title}
                </h3>

                {/* Topics / Indicators */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 14 }}>
                  {quiz.indicatorCodes.map((c, idx) => (
                    <span
                      key={`${c}-${idx}`}
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        backgroundColor: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        color: '#334155',
                        padding: '2px 6px',
                        borderRadius: 4,
                      }}
                    >
                      {c}
                    </span>
                  ))}
                </div>

                {/* Metadata summary */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 16,
                    fontSize: 12,
                    color: '#64748b',
                    paddingBottom: 14,
                    borderBottom: '1px solid #f1f5f9',
                    marginBottom: 14,
                  }}
                >
                  <span>{quiz.questionCount} questions</span>
                  <span>·</span>
                  <span>{quiz.randomizePerStudent ? 'Randomized pool' : 'Fixed paper'}</span>
                  <span>·</span>
                  <span>
                    {quiz.assignmentTarget === 'class'
                      ? quiz.className || 'Class'
                      : `${quiz.assignedStudentIds.length} students`}
                  </span>
                </div>

                {/* Status and Action Buttons */}
                <div
                  style={{
                    marginTop: 'auto',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    {isCompleted ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <CheckCircle2 size={15} color="#16a34a" />
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#166534' }}>
                          Submitted: {mySub?.autoScore.percentage}% auto score
                        </span>
                      </div>
                    ) : (
                      <span style={{ fontSize: 12, color: '#64748b' }}>
                        {quizSubs.length} submission{quizSubs.length === 1 ? '' : 's'} recorded
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: 8 }}>
                    {staff && (
                      <Button
                        variant="secondary"
                        style={{ fontSize: 12, padding: '6px 10px' }}
                        onClick={() => setSelectedQuizForSubmissions(quiz)}
                      >
                        <Eye size={14} /> Submissions ({quizSubs.length})
                      </Button>
                    )}

                    <Button
                      style={{ fontSize: 12, padding: '6px 12px' }}
                      onClick={() => onStartQuiz(quiz)}
                    >
                      <Play size={14} /> {isCompleted ? 'Retake Test' : 'Start Test'}
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Submissions Modal */}
      {selectedQuizForSubmissions && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            backgroundColor: 'rgba(10, 37, 64, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <div
            style={{
              backgroundColor: '#fff',
              borderRadius: 12,
              width: '100%',
              maxWidth: 720,
              maxHeight: '85vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
            }}
          >
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: '#f8fafc',
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1e293b' }}>
                  Submissions for: {selectedQuizForSubmissions.title}
                </h3>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: '#64748b' }}>
                  {selectedQuizForSubmissions.level} · {selectedQuizForSubmissions.subject}
                </p>
              </div>
              <button
                onClick={() => setSelectedQuizForSubmissions(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: 18,
                  cursor: 'pointer',
                  color: '#64748b',
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: 20, overflowY: 'auto', flex: 1 }}>
              {allSubmissions.filter((s) => s.quizId === selectedQuizForSubmissions.id).length ===
              0 ? (
                <div
                  style={{ textAlign: 'center', padding: '36px 0', color: '#64748b', fontSize: 13 }}
                >
                  No students have submitted this assessment yet.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {allSubmissions
                    .filter((s) => s.quizId === selectedQuizForSubmissions.id)
                    .map((sub) => (
                      <div
                        key={sub.id}
                        style={{
                          border: '1px solid #e2e8f0',
                          borderRadius: 8,
                          padding: '12px 16px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 14, color: '#1e293b' }}>
                            {sub.studentName}
                          </div>
                          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                            Submitted: {new Date(sub.submittedAt).toLocaleString()}
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                          {/* Auto-Scored result */}
                          <div style={{ textAlign: 'right' }}>
                            <div
                              style={{
                                fontSize: 10,
                                fontWeight: 700,
                                color: '#64748b',
                                textTransform: 'uppercase',
                              }}
                            >
                              Auto Score
                            </div>
                            <div style={{ fontSize: 16, fontWeight: 800, color: '#1e293b' }}>
                              {sub.autoScore.percentage}% ({sub.autoScore.pointsAwarded}/
                              {sub.autoScore.pointsPossible})
                            </div>
                          </div>

                          {/* Teacher-Assessed result (Rule 4) */}
                          <div style={{ textAlign: 'right' }}>
                            <div
                              style={{
                                fontSize: 10,
                                fontWeight: 700,
                                color: '#64748b',
                                textTransform: 'uppercase',
                              }}
                            >
                              Teacher Assessed
                            </div>
                            <div
                              style={{
                                fontSize: 13,
                                fontWeight: 700,
                                color:
                                  sub.status === 'awaiting teacher marking' ? '#d97706' : '#16a34a',
                              }}
                            >
                              {sub.status === 'awaiting teacher marking'
                                ? 'Awaiting Marking'
                                : 'Marked'}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>

            <div
              style={{ padding: '12px 20px', borderTop: '1px solid #e2e8f0', textAlign: 'right' }}
            >
              <Button onClick={() => setSelectedQuizForSubmissions(null)}>Close</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
