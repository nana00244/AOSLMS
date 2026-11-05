import { useAnswerSounds } from '../learningHub/useAnswerSounds';
import { useState } from 'react';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  AlertCircle,
  HelpCircle,
  FileQuestion,
  RotateCcw,
  Trophy,
  Award,
} from 'lucide-react';
import { Button } from './ui';
import type { QuizDefinition, QuizSubmissionRecord } from '../nacca/quizEngine';
import { getStudentQuizQuestions, submitQuiz } from '../nacca/quizEngine';
import { shuffled, shuffledOptionIndices } from '../nacca/attemptOrder';
import '../pages/practice-arena.css';

interface Props {
  quiz: QuizDefinition;
  student: boolean;
  studentId?: string;
  studentName?: string;
  onBack: () => void;
  onCompleted?: (submission: QuizSubmissionRecord) => void;
}

export function PracticeArenaQuizPlayer({
  quiz,
  student,
  studentId = 'student_demo',
  studentName = 'Learner',
  onBack,
  onCompleted,
}: Props) {
  // Retrieve sanitized questions for student (Rule 2: answer and explanation stripped)
  const [{ questions, hasTeacherMarked }] = useState(() => {
    const paper = getStudentQuizQuestions(quiz, studentId);
    return {
      ...paper,
      questions: shuffled(paper.questions).map((q) => ({
        ...q,
        optionOrder: shuffledOptionIndices(q.options),
      })),
    };
  });

  const [currentIndex, setCurrentIndex] = useState(0);
  const [responses, setResponses] = useState<
    Record<
      string,
      {
        selectedOption?: number;
        numericInput?: string;
        shortAnswerInput?: string;
        writtenAnswer?: string;
      }
    >
  >({});
  const [submissionResult, setSubmissionResult] = useState<QuizSubmissionRecord | null>(null);
  const [showReview, setShowReview] = useState(false);

  const currentQ = questions[currentIndex];
  const currentResp = currentQ ? responses[currentQ.id] || {} : {};

  const answeredCount = Object.keys(responses).filter((k) => {
    const r = responses[k];
    return (
      r.selectedOption !== undefined ||
      (r.numericInput && r.numericInput.trim() !== '') ||
      (r.shortAnswerInput && r.shortAnswerInput.trim() !== '') ||
      (r.writtenAnswer && r.writtenAnswer.trim() !== '')
    );
  }).length;

  const handleSelectOption = (idx: number) => {
    if (!currentQ || submissionResult) return;
    setResponses((prev) => ({
      ...prev,
      [currentQ.id]: {
        ...prev[currentQ.id],
        selectedOption: idx,
      },
    }));
  };

  const handleNumericChange = (val: string) => {
    if (!currentQ || submissionResult) return;
    setResponses((prev) => ({
      ...prev,
      [currentQ.id]: {
        ...prev[currentQ.id],
        numericInput: val,
      },
    }));
  };

  const handleShortAnswerChange = (val: string) => {
    if (!currentQ || submissionResult) return;
    setResponses((prev) => ({
      ...prev,
      [currentQ.id]: {
        ...prev[currentQ.id],
        shortAnswerInput: val,
      },
    }));
  };

  const handleWrittenChange = (val: string) => {
    if (!currentQ || submissionResult) return;
    setResponses((prev) => ({
      ...prev,
      [currentQ.id]: {
        ...prev[currentQ.id],
        writtenAnswer: val,
      },
    }));
  };

  const prepareSound = useAnswerSounds();
  const handleSubmit = () => {
    const result = submitQuiz(quiz, studentId, studentName, responses, undefined, questions.map((q) => q.id));
    if (student) {
      const graded = result.answers.filter((answer) => answer.isAutoScored &&
        (answer.selectedOption !== undefined || answer.numericInput?.trim() || answer.shortAnswerInput?.trim()));
      prepareSound()(graded.map((answer) => answer.isCorrect === true));
    }
    setSubmissionResult(result);
    if (onCompleted) {
      onCompleted(result);
    }
  };

  // 1. Result Screen after submission
  if (submissionResult) {
    const isAwaitingTeacher = submissionResult.status === 'awaiting teacher marking';

    return (
      <div className="practice-arena-app-container">
        {/* Top Header */}
        <header className="practice-arena-top-header">
          <div className="practice-arena-header-left">
            <button className="practice-arena-nav-btn practice-arena-header-back" onClick={onBack}>
              <ArrowLeft size={16} /> Exit Assessment
            </button>
            <div className="practice-arena-brand-logo">
              <span className="practice-arena-leaf-icon">🌿</span>
              <span className="practice-arena-logo-text">
                Practice Arena <em>NaCCA</em>
              </span>
            </div>
          </div>
          <div className="practice-arena-header-right">
            <span className="practice-arena-curriculum-tag">
              {quiz.level} · {quiz.subject}
            </span>
            <span className="practice-arena-role-badge">Student: {studentName}</span>
          </div>
        </header>

        {/* Completion Card */}
        <main style={{ maxWidth: 840, margin: '40px auto', padding: '0 20px', width: '100%' }}>
          <div
            style={{
              backgroundColor: '#fff',
              borderRadius: 16,
              boxShadow: '0 10px 25px rgba(0,0,0,0.08)',
              border: '1px solid #e2e8f0',
              overflow: 'hidden',
            }}
          >
            {/* Banner */}
            <div
              style={{
                backgroundColor: isAwaitingTeacher ? '#0a2540' : '#1865f2',
                color: '#fff',
                padding: '32px 24px',
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: '50%',
                  background: 'rgba(255,255,255,0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px',
                }}
              >
                <Trophy size={36} color="#57d598" />
              </div>
              <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#fff' }}>
                {quiz.title}
              </h1>
              <p style={{ margin: '8px 0 0', fontSize: 14, color: '#cbd5e1' }}>
                Submitted on {new Date(submissionResult.submittedAt).toLocaleString()}
              </p>
            </div>

            <div style={{ padding: 32 }}>
              {/* Status Notice */}
              {isAwaitingTeacher ? (
                <div
                  style={{
                    backgroundColor: '#fffbeb',
                    border: '1px solid #fde68a',
                    borderRadius: 12,
                    padding: '16px 20px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    marginBottom: 24,
                  }}
                >
                  <Clock size={24} color="#d97706" />
                  <div>
                    <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#92400e' }}>
                      Status: Awaiting Teacher Marking
                    </h3>
                    <p style={{ margin: '4px 0 0', fontSize: 13, color: '#b45309' }}>
                      Your auto-scored questions were marked immediately. Tasks requiring written,
                      oral, or drawing rubrics have been placed in your teacher&apos;s marking
                      queue.
                    </p>
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    backgroundColor: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                    borderRadius: 12,
                    padding: '16px 20px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    marginBottom: 24,
                  }}
                >
                  <CheckCircle2 size={24} color="#16a34a" />
                  <div>
                    <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#166534' }}>
                      Status: Assessment Fully Graded
                    </h3>
                    <p style={{ margin: '4px 0 0', fontSize: 13, color: '#15803d' }}>
                      All questions were auto-scored according to approved NaCCA grading keys.
                    </p>
                  </div>
                </div>
              )}

              {/* SEPARATE SCORE BOXES (RULE 4) */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 20,
                  marginBottom: 28,
                }}
              >
                {/* Auto-Scored Box */}
                <div
                  style={{
                    border: '2px solid #e2e8f0',
                    borderRadius: 12,
                    padding: 20,
                    backgroundColor: '#f8fafc',
                  }}
                >
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: '#64748b',
                      textTransform: 'uppercase',
                      letterSpacing: 0.5,
                    }}
                  >
                    Auto-Scored Results
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 8 }}>
                    <span style={{ fontSize: 36, fontWeight: 800, color: '#1e293b' }}>
                      {submissionResult.autoScore.percentage}%
                    </span>
                    <span style={{ fontSize: 14, color: '#64748b' }}>
                      ({submissionResult.autoScore.pointsAwarded} /{' '}
                      {submissionResult.autoScore.pointsPossible} points)
                    </span>
                  </div>
                  <p style={{ margin: '8px 0 0', fontSize: 12, color: '#64748b' }}>
                    Graded automatically based on objective keys.
                  </p>
                </div>

                {/* Teacher-Assessed Box (Rule 4: strictly separate) */}
                <div
                  style={{
                    border: '2px solid #e2e8f0',
                    borderRadius: 12,
                    padding: 20,
                    backgroundColor: '#f8fafc',
                  }}
                >
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: '#64748b',
                      textTransform: 'uppercase',
                      letterSpacing: 0.5,
                    }}
                  >
                    Teacher-Assessed Results
                  </div>
                  {isAwaitingTeacher ? (
                    <div>
                      <div
                        style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 8 }}
                      >
                        <span style={{ fontSize: 24, fontWeight: 700, color: '#d97706' }}>
                          Pending
                        </span>
                        <span style={{ fontSize: 13, color: '#92400e' }}>
                          (Awaiting rubric marking)
                        </span>
                      </div>
                      <p style={{ margin: '8px 0 0', fontSize: 12, color: '#64748b' }}>
                        Stored separately; will never be merged into your auto score.
                      </p>
                    </div>
                  ) : (
                    <div>
                      <div
                        style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 8 }}
                      >
                        <span style={{ fontSize: 24, fontWeight: 700, color: '#64748b' }}>N/A</span>
                        <span style={{ fontSize: 13, color: '#64748b' }}>
                          (No teacher tasks in this test)
                        </span>
                      </div>
                      <p style={{ margin: '8px 0 0', fontSize: 12, color: '#64748b' }}>
                        This assessment contained only objective questions.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <Button variant="secondary" onClick={onBack}>
                  <ArrowLeft size={16} /> Return to Learning Hub
                </Button>
                <Button onClick={() => setShowReview(!showReview)}>
                  {showReview ? 'Hide Question Breakdown' : 'Review My Answers'}
                </Button>
              </div>

              {/* Question-by-Question Review */}
              {showReview && (
                <div style={{ marginTop: 32, borderTop: '1px solid #e2e8f0', paddingTop: 24 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1e293b', marginBottom: 16 }}>
                    Question Breakdown ({submissionResult.answers.length} items)
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {submissionResult.answers.map((ans, idx) => {
                      const qItem = questions.find((q) => q.id === ans.questionId);
                      return (
                        <div
                          key={ans.questionId}
                          style={{
                            border: '1px solid #e2e8f0',
                            borderRadius: 8,
                            padding: 16,
                            backgroundColor: '#fff',
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              marginBottom: 8,
                            }}
                          >
                            <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b' }}>
                              Question {idx + 1} ({ans.type.toUpperCase()} · Diff {ans.difficulty})
                            </span>
                            {ans.isAutoScored ? (
                              ans.isCorrect ? (
                                <span
                                  style={{
                                    color: '#16a34a',
                                    fontWeight: 600,
                                    fontSize: 12,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 4,
                                  }}
                                >
                                  <CheckCircle2 size={15} /> Correct (+1 pt)
                                </span>
                              ) : (
                                <span
                                  style={{
                                    color: '#dc2626',
                                    fontWeight: 600,
                                    fontSize: 12,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 4,
                                  }}
                                >
                                  <XCircle size={15} /> Incorrect (0 pts)
                                </span>
                              )
                            ) : (
                              <span
                                style={{
                                  color: '#d97706',
                                  fontWeight: 600,
                                  fontSize: 12,
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 4,
                                }}
                              >
                                <Clock size={15} /> Awaiting Teacher Marking
                              </span>
                            )}
                          </div>
                          <p
                            style={{
                              margin: '0 0 10px',
                              fontSize: 14,
                              color: '#1e293b',
                              fontWeight: 500,
                            }}
                          >
                            {qItem?.stem || `Question ${ans.questionId}`}
                          </p>
                          {ans.autoFeedback && (
                            <div
                              style={{
                                fontSize: 12,
                                color: '#475569',
                                backgroundColor: '#f1f5f9',
                                padding: '6px 10px',
                                borderRadius: 6,
                              }}
                            >
                              {ans.autoFeedback}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    );
  }

  // 2. Quiz Playing Screen
  return (
    <div className="practice-arena-app-container">
      {/* Top Header */}
      <header className="practice-arena-top-header">
        <div className="practice-arena-header-left">
          <button className="practice-arena-nav-btn practice-arena-header-back" onClick={onBack}>
            <ArrowLeft size={16} /> Exit Assessment
          </button>
          <div className="practice-arena-brand-logo">
            <span className="practice-arena-leaf-icon">🌿</span>
            <span className="practice-arena-logo-text">
              Practice Arena <em>NaCCA</em>
            </span>
          </div>
        </div>
        <div className="practice-arena-header-center">
          <span style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0' }}>{quiz.title}</span>
        </div>
        <div className="practice-arena-header-right">
          <span className="practice-arena-curriculum-tag">
            {quiz.level} · {quiz.subject}
          </span>
          <span className="practice-arena-role-badge">Student: {studentName}</span>
        </div>
      </header>

      {/* Main Two-Column Layout */}
      <div className="practice-arena-layout">
        {/* Left Navigator Panel */}
        <aside
          style={{
            width: 280,
            borderRight: '1px solid #e2e8f0',
            backgroundColor: '#f8fafc',
            padding: 20,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ marginBottom: 16 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: '#64748b',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}
            >
              Assessment Navigation
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b', marginTop: 4 }}>
              Answered {answeredCount} of {questions.length}
            </div>
          </div>

          {/* Question Grid / List */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 8,
              marginBottom: 20,
            }}
          >
            {questions.map((q, idx) => {
              const r = responses[q.id];
              const isAnswered =
                r &&
                (r.selectedOption !== undefined ||
                  (r.numericInput && r.numericInput.trim() !== '') ||
                  (r.shortAnswerInput && r.shortAnswerInput.trim() !== '') ||
                  (r.writtenAnswer && r.writtenAnswer.trim() !== ''));
              const isCurrent = idx === currentIndex;

              return (
                <button
                  key={q.id}
                  onClick={() => setCurrentIndex(idx)}
                  style={{
                    height: 40,
                    borderRadius: 8,
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: 'pointer',
                    border: isCurrent
                      ? '2px solid #1865f2'
                      : isAnswered
                        ? '1px solid #16a34a'
                        : '1px solid #cbd5e1',
                    backgroundColor: isCurrent ? '#eff6ff' : isAnswered ? '#dcfce7' : '#fff',
                    color: isCurrent ? '#1865f2' : isAnswered ? '#166534' : '#64748b',
                  }}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>

          <div style={{ marginTop: 'auto', borderTop: '1px solid #e2e8f0', paddingTop: 16 }}>
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 12 }}>
              Due: {new Date(quiz.dueDate).toLocaleDateString()}
            </div>
            <Button
              style={{ width: '100%', justifyContent: 'center' }}
              onClick={handleSubmit}
              disabled={answeredCount === 0}
            >
              Submit Assessment ({answeredCount}/{questions.length})
            </Button>
          </div>
        </aside>

        {/* Center Question View */}
        <main style={{ flex: 1, padding: '36px 48px', overflowY: 'auto' }}>
          {currentQ ? (
            <div style={{ maxWidth: 680, margin: '0 auto' }}>
              {/* Question metadata badge */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 16,
                }}
              >
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: '#1865f2',
                    backgroundColor: '#eff6ff',
                    padding: '4px 10px',
                    borderRadius: 20,
                  }}
                >
                  Question {currentIndex + 1} of {questions.length} · Difficulty{' '}
                  {currentQ.difficulty}/4
                </span>
                <span style={{ fontSize: 12, color: '#64748b' }}>
                  Indicator: {currentQ.indicator_code}
                </span>
              </div>

              {/* Exact Question Stem (Rule 1: Never alter or improve) */}
              <h2
                style={{
                  fontSize: 20,
                  fontWeight: 600,
                  color: '#1e293b',
                  lineHeight: 1.5,
                  marginBottom: 24,
                }}
              >
                {currentQ.stem}
              </h2>

              {/* Question Type: MCQ */}
              {currentQ.type === 'mcq' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>
                    Choose 1 answer:
                  </div>
                  {currentQ.optionOrder.map((oIdx, displayIndex) => {
                    const isSelected = currentResp.selectedOption === oIdx;
                    const letter = String.fromCharCode(65 + displayIndex); // A, B, C, D
                    return (
                      <button
                        key={oIdx}
                        type="button"
                        onClick={() => handleSelectOption(oIdx)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 14,
                          padding: '14px 18px',
                          borderRadius: 10,
                          textAlign: 'left',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          border: isSelected ? '2px solid #1865f2' : '1px solid #cbd5e1',
                          backgroundColor: isSelected ? '#eff6ff' : '#fff',
                        }}
                      >
                        <span
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 14,
                            fontWeight: 700,
                            flexShrink: 0,
                            border: isSelected ? '2px solid #1865f2' : '1px solid #94a3b8',
                            backgroundColor: isSelected ? '#1865f2' : '#fff',
                            color: isSelected ? '#fff' : '#475569',
                          }}
                        >
                          {letter}
                        </span>
                        <span
                          style={{
                            fontSize: 15,
                            color: '#1e293b',
                            fontWeight: isSelected ? 600 : 400,
                          }}
                        >
                          {currentQ.options?.[oIdx]}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Question Type: Numeric */}
              {currentQ.type === 'numeric' && (
                <div style={{ marginTop: 16 }}>
                  <label
                    style={{
                      display: 'block',
                      fontSize: 13,
                      fontWeight: 600,
                      color: '#475569',
                      marginBottom: 8,
                    }}
                  >
                    Enter numeric answer (accepts equivalents e.g. 5 or 5.0):
                  </label>
                  <input
                    type="text"
                    value={currentResp.numericInput || ''}
                    onChange={(e) => handleNumericChange(e.target.value)}
                    placeholder="Type your number here..."
                    style={{
                      width: 240,
                      padding: '12px 16px',
                      fontSize: 18,
                      borderRadius: 8,
                      border: '2px solid #cbd5e1',
                      outline: 'none',
                    }}
                  />
                </div>
              )}

              {/* Question Type: Short Answer */}
              {currentQ.type === 'short_answer' && (
                <div style={{ marginTop: 16 }}>
                  <label
                    style={{
                      display: 'block',
                      fontSize: 13,
                      fontWeight: 600,
                      color: '#475569',
                      marginBottom: 8,
                    }}
                  >
                    Type your short answer (spaces trimmed, case-insensitive):
                  </label>
                  <input
                    type="text"
                    value={currentResp.shortAnswerInput || ''}
                    onChange={(e) => handleShortAnswerChange(e.target.value)}
                    placeholder="Type answer here..."
                    style={{
                      width: '100%',
                      maxWidth: 400,
                      padding: '12px 16px',
                      fontSize: 15,
                      borderRadius: 8,
                      border: '2px solid #cbd5e1',
                      outline: 'none',
                    }}
                  />
                </div>
              )}

              {/* Question Type: Written / Oral / Drawing / Practical / Role Play */}
              {['written', 'oral', 'drawing', 'practical', 'role_play'].includes(currentQ.type) && (
                <div
                  style={{
                    marginTop: 16,
                    border: '1px solid #e2e8f0',
                    borderRadius: 10,
                    padding: 18,
                    backgroundColor: '#f8fafc',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      color: '#d97706',
                      marginBottom: 8,
                    }}
                  >
                    <AlertCircle size={18} />
                    <span style={{ fontSize: 13, fontWeight: 700 }}>
                      Teacher-Marked Task ({currentQ.type.toUpperCase()})
                    </span>
                  </div>
                  <p style={{ margin: '0 0 12px', fontSize: 12, color: '#64748b' }}>
                    Type your complete written answer below. Your teacher will mark this question
                    based on the curriculum rubric criteria.
                  </p>
                  <textarea
                    rows={4}
                    value={currentResp.writtenAnswer || ''}
                    onChange={(e) => handleWrittenChange(e.target.value)}
                    placeholder="Write your explanation or answer..."
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      fontSize: 14,
                      borderRadius: 8,
                      border: '1px solid #cbd5e1',
                      outline: 'none',
                    }}
                  />
                </div>
              )}

              {/* Navigation Footer */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginTop: 36,
                  paddingTop: 20,
                  borderTop: '1px solid #e2e8f0',
                }}
              >
                <Button
                  variant="secondary"
                  onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                  disabled={currentIndex === 0}
                >
                  <ChevronLeft size={16} /> Previous
                </Button>

                {currentIndex < questions.length - 1 ? (
                  <Button
                    onClick={() =>
                      setCurrentIndex((prev) => Math.min(questions.length - 1, prev + 1))
                    }
                  >
                    Next Question <ChevronRight size={16} />
                  </Button>
                ) : (
                  <Button onClick={handleSubmit} disabled={answeredCount === 0}>
                    Submit Assessment ({answeredCount}/{questions.length})
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div>No question available</div>
          )}
        </main>
      </div>
    </div>
  );
}
