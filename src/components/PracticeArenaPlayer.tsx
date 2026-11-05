import type { useAnswerSounds } from '../learningHub/useAnswerSounds';
import { useState, useMemo, useEffect } from 'react';
import {
  BookOpen,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Lightbulb,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Sparkles,
  AlertCircle,
  Check,
  Trophy,
  History,
  Layers,
  ChevronDown,
} from 'lucide-react';
import { Button } from './ui';
import {
  naccaQuestions,
  naccaIndicators,
  naccaSubjects,
  naccaLevels,
} from '../learningHub/naccaBank';
import type { NaccaQuestion, NaccaIndicator } from '../nacca/types';
import {
  createAdaptiveSession,
  getNextAdaptiveQuestion,
  recordAdaptiveAnswer,
  type AdaptiveSessionState,
} from '../nacca/adaptiveEngine';
import {
  evaluateAnswer,
  sanitizeQuestionForStudent,
  type CheckAnswerResult,
} from '../nacca/answerChecker';
import {
  calculateMastery,
  type MasteryResult,
  type IndicatorAttemptRecord,
} from '../nacca/mastery';
import {
  savePracticeAttempt,
  getIndicatorAttempts,
  type PracticeSessionRecord,
} from '../nacca/practiceHistory';

import { indicatorLessonId } from '../learningHub/indicatorLessonId';
import { shuffled, shuffledOptionIndices } from '../nacca/attemptOrder';

interface Props {
  prepareSound: ReturnType<typeof useAnswerSounds>;
  initialIndicatorCode?: string;
  initialSubject?: string;
  onBack: () => void;
  staff: boolean;
  studentId?: string;
  assignmentId?: string;
  assignmentLessonId?: string;
  onRecordAttempt?: (record: PracticeSessionRecord) => void;
}

type PracticeMode = 'practice' | 'quiz' | 'unit_test' | 'teacher_task';

interface QuestionState {
  question: NaccaQuestion;
  optionOrder: number[];
  selectedOption?: number;
  numericInput?: string;
  shortAnswerInput?: string;
  teacherInput?: string;
  isAnswered: boolean;
  isCorrect?: boolean;
  validationError?: string;
  explanationViewed: boolean;
}

export function PracticeArenaPlayer({
  prepareSound,
  initialIndicatorCode,
  initialSubject,
  onBack,
  staff,
  studentId = 'guest_student',
  assignmentId,
  assignmentLessonId,
  onRecordAttempt,
}: Props) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  // 1. Student Hierarchy Pickers: Subject -> Level -> Strand/Sub-strand -> Indicator (Topic)
  const availableSubjects = useMemo(() => {
    const list = naccaSubjects.map((s) => s.name);
    return list.length > 0 ? list : ['Mathematics'];
  }, []);

  const initialIndicator = naccaIndicators.find(
    (i) => i.code === initialIndicatorCode && (!initialSubject || i.subject === initialSubject),
  );
  const [selectedSubject, setSelectedSubject] = useState<string>(
    initialIndicator?.subject || initialSubject || availableSubjects[0] || 'Mathematics',
  );

  const availableLevels = useMemo(() => {
    const list = naccaLevels
      .map((l) => l.name)
      .filter((level) =>
        naccaIndicators.some((i) => i.subject === selectedSubject && i.level === level),
      );
    return list;
  }, [selectedSubject]);

  // Determine initial level based on initialIndicatorCode if present
  const initialLevel = useMemo(() => {
    if (initialIndicatorCode) {
      const found = naccaIndicators.find(
        (i) => i.code === initialIndicatorCode && (!initialSubject || i.subject === initialSubject),
      );
      if (found) return found.level;
    }
    return availableLevels[0] || 'Basic 1';
  }, [initialIndicatorCode, initialSubject, availableLevels]);

  const [selectedLevel, setSelectedLevel] = useState<string>(initialLevel);

  // Filter indicators by selected subject and level
  const filteredIndicators = useMemo(() => {
    return naccaIndicators.filter(
      (ind) =>
        ind.subject.toLowerCase() === selectedSubject.toLowerCase() &&
        ind.level.toLowerCase() === selectedLevel.toLowerCase(),
    );
  }, [selectedSubject, selectedLevel]);

  const [currentIndicatorCode, setCurrentIndicatorCode] = useState<string>(
    initialIndicatorCode || filteredIndicators[0]?.code || 'B1.1.1.1.1',
  );

  // Ensure currentIndicatorCode is valid within the filtered list
  useEffect(() => {
    if (
      filteredIndicators.length > 0 &&
      !filteredIndicators.some((ind) => ind.code === currentIndicatorCode)
    ) {
      setCurrentIndicatorCode(filteredIndicators[0].code);
    }
  }, [filteredIndicators, currentIndicatorCode]);

  const currentIndicator = useMemo(() => {
    return (
      filteredIndicators.find((ind) => ind.code === currentIndicatorCode) ||
      filteredIndicators[0] ||
      naccaIndicators[0]
    );
  }, [filteredIndicators, currentIndicatorCode]);

  const practiceQuestions = useMemo(
    () => naccaQuestions.filter((q) => q.subject === selectedSubject && q.level === selectedLevel),
    [selectedSubject, selectedLevel],
  );

  // Group indicators by Strand (Units) for the current level
  const units = useMemo(() => {
    const map = new Map<string, NaccaIndicator[]>();
    for (const ind of filteredIndicators) {
      const strand = ind.strand || 'General';
      if (!map.has(strand)) map.set(strand, []);
      map.get(strand)!.push(ind);
    }
    return Array.from(map.entries()).map(([strand, items], idx) => ({
      id: `unit_${idx + 1}`,
      name: strand,
      indicators: items,
    }));
  }, [filteredIndicators]);

  const currentUnit = useMemo(() => {
    return (
      units.find((u) => u.indicators.some((ind) => ind.code === currentIndicatorCode)) ||
      units[0] || { id: 'unit_1', name: 'General', indicators: [] }
    );
  }, [units, currentIndicatorCode]);

  const [mode, setMode] = useState<PracticeMode>('practice');

  // Mastery calculation for current indicator
  const [historyKey, setHistoryKey] = useState(0);
  const indicatorAttemptsData = useMemo(() => {
    return getIndicatorAttempts(currentIndicatorCode, studentId, selectedSubject, selectedLevel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndicatorCode, studentId, selectedSubject, selectedLevel, historyKey]);

  const masteryResult: MasteryResult = useMemo(() => {
    const attemptsRecords: IndicatorAttemptRecord[] = [];
    for (const session of indicatorAttemptsData.autoMarked) {
      for (const q of session.questions) {
        attemptsRecords.push({
          questionId: q.questionId,
          indicatorCode: session.indicatorCode,
          isCorrect: !!q.isCorrect,
          difficulty: q.difficulty,
          timestamp: q.timestamp,
        });
      }
    }
    return calculateMastery(currentIndicatorCode, attemptsRecords);
  }, [currentIndicatorCode, indicatorAttemptsData]);

  // 2. Adaptive Practice Session State
  const TARGET_PROBLEMS = 4;
  const [adaptiveState, setAdaptiveState] = useState<AdaptiveSessionState>(() =>
    createAdaptiveSession(currentIndicatorCode, TARGET_PROBLEMS),
  );

  const [currentIndex, setCurrentIndex] = useState(0);
  const [questionStates, setQuestionStates] = useState<QuestionState[]>([]);
  const [sessionCompleted, setSessionCompleted] = useState(false);
  const [revealedHints, setRevealedHints] = useState<number>(0);
  const [showExplanation, setShowExplanation] = useState(false);
  const [validationError, setValidationError] = useState<string>('');

  const [attemptPool, setAttemptPool] = useState<NaccaQuestion[]>([]);

  // Start or restart session
  const restartSession = () => {
    const newSession = createAdaptiveSession(currentIndicatorCode, TARGET_PROBLEMS);
    setAdaptiveState(newSession);

    // Pick first question using adaptive engine (starts at difficulty 1)
    const previous = getIndicatorAttempts(currentIndicatorCode, studentId, selectedSubject, selectedLevel).allAttempts[0]?.questions ?? [];
    const lastSeen = new Set(previous.map((q) => q.questionId));
    const pool = shuffled(practiceQuestions.filter((q) => q.indicator_code === currentIndicatorCode))
      .sort((a, b) => Number(lastSeen.has(a.id)) - Number(lastSeen.has(b.id)));
    setAttemptPool(pool);
    const lastFirst = previous[0]?.questionId;
    const firstQ = getNextAdaptiveQuestion(pool.filter((q) => q.id !== lastFirst), newSession)
      ?? getNextAdaptiveQuestion(pool, newSession);
    if (firstQ) {
      setQuestionStates([
        {
          question: firstQ,
          optionOrder: shuffledOptionIndices(firstQ.options, previous.find((q) => q.questionId === firstQ.id)?.optionOrder),
          isAnswered: false,
          explanationViewed: false,
        },
      ]);
    } else {
      setQuestionStates([]);
    }

    setCurrentIndex(0);
    setSessionCompleted(false);
    setRevealedHints(0);
    setShowExplanation(false);
    setValidationError('');
  };

  useEffect(() => {
    restartSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndicatorCode, selectedSubject, selectedLevel, mode]);

  const currentQState = questionStates[currentIndex];
  const currentQ = currentQState?.question;

  // Sanitize question for student view so answer is never leaked (Rule 2)
  const studentSafeQuestion = useMemo(() => {
    if (!currentQ) return null;
    return sanitizeQuestionForStudent(currentQ);
  }, [currentQ]);

  // Handle inputs
  const isInputSelected = useMemo(() => {
    if (!currentQ || !currentQState) return false;
    if (currentQ.type === 'mcq') {
      return currentQState.selectedOption !== undefined;
    }
    if (currentQ.type === 'numeric') {
      return currentQState.numericInput !== undefined && currentQState.numericInput.trim() !== '';
    }
    if (currentQ.type === 'short_answer') {
      return (
        currentQState.shortAnswerInput !== undefined && currentQState.shortAnswerInput.trim() !== ''
      );
    }
    return currentQState.teacherInput !== undefined && currentQState.teacherInput.trim() !== '';
  }, [currentQ, currentQState]);

  const handleSelectOption = (index: number) => {
    if (currentQState?.isAnswered) return;
    setValidationError('');
    setQuestionStates((prev) => {
      const next = [...prev];
      next[currentIndex] = {
        ...next[currentIndex],
        selectedOption: index,
      };
      return next;
    });
  };

  const handleNumericInput = (val: string) => {
    if (currentQState?.isAnswered) return;
    setValidationError('');
    setQuestionStates((prev) => {
      const next = [...prev];
      next[currentIndex] = {
        ...next[currentIndex],
        numericInput: val,
      };
      return next;
    });
  };

  const handleShortAnswerInput = (val: string) => {
    if (currentQState?.isAnswered) return;
    setValidationError('');
    setQuestionStates((prev) => {
      const next = [...prev];
      next[currentIndex] = {
        ...next[currentIndex],
        shortAnswerInput: val,
      };
      return next;
    });
  };

  const handleTeacherInput = (val: string) => {
    if (currentQState?.isAnswered) return;
    setValidationError('');
    setQuestionStates((prev) => {
      const next = [...prev];
      next[currentIndex] = {
        ...next[currentIndex],
        teacherInput: val,
      };
      return next;
    });
  };

  // Check Answer
  const playPracticeCue = () => { if (!staff) prepareSound()(['practice']); };
  const handleCheck = () => {
    if (!currentQ || !currentQState || currentQState.isAnswered) return;

    // Evaluate answer with validation
    const result: CheckAnswerResult = evaluateAnswer(currentQ, {
      selectedOption: currentQState.selectedOption,
      numericInput: currentQState.numericInput,
      shortAnswerInput: currentQState.shortAnswerInput,
    });

    if (!result.valid) {
      setValidationError(result.validationError || 'Please enter a valid answer.');
      return;
    }

    setValidationError('');
    const isCorrect = !!result.isCorrect;
    if (!staff) prepareSound()([isCorrect ? 'correct' : 'wrong']);

    // Update adaptive session difficulty
    const nextAdaptive = recordAdaptiveAnswer(adaptiveState, currentQ.id, isCorrect);
    setAdaptiveState(nextAdaptive);

    setQuestionStates((prev) => {
      const next = [...prev];
      next[currentIndex] = {
        ...next[currentIndex],
        isAnswered: true,
        isCorrect,
      };
      return next;
    });

    setShowExplanation(true);
  };

  // Next Question / Finish Session
  const handleNext = (state = adaptiveState) => {
    if (currentIndex < TARGET_PROBLEMS - 1) {
      // Pick next adaptive question based on updated difficulty
      const nextQ = getNextAdaptiveQuestion(attemptPool, state);
      if (nextQ) {
        const optionOrder = shuffledOptionIndices(nextQ.options, indicatorAttemptsData.allAttempts[0]?.questions.find((q) => q.questionId === nextQ.id)?.optionOrder);
        setQuestionStates((prev) => [
          ...prev,
          {
            question: nextQ,
            optionOrder,
            isAnswered: false,
            explanationViewed: false,
          },
        ]);
        setCurrentIndex((prev) => prev + 1);
        setRevealedHints(0);
        setShowExplanation(false);
        setValidationError('');
        return;
      }
    }

    // Complete session
    setSessionCompleted(true);
    const correctCount = questionStates.filter((s) => s.isCorrect).length;
    const totalCount = questionStates.length;
    const score = Math.round((correctCount / (totalCount || 1)) * 100);

    const isTeacherTask = mode === 'teacher_task';
    const category = isTeacherTask ? 'teacher' : 'auto';

    // Save attempt to history (allowing retakes and keeping auto & teacher scores separate)
    const record = savePracticeAttempt({
      id: crypto.randomUUID(),
      assignmentId: assignmentLessonId === indicatorLessonId(currentIndicator.subject, currentIndicatorCode) ? assignmentId : undefined,
      studentId,
      indicatorCode: currentIndicatorCode,
      subject: currentIndicator.subject,
      level: currentIndicator.level,
      strand: currentIndicator.strand,
      subStrand: currentIndicator.sub_strand,
      category,
      score,
      correctCount,
      totalCount,
      questions: questionStates.map((qs) => ({
        questionId: qs.question.id,
        optionOrder: qs.optionOrder,
        response: qs.isAnswered ? { selectedOption: qs.selectedOption, numericInput: qs.numericInput, shortAnswerInput: qs.shortAnswerInput } : {},
        type: qs.question.type,
        difficulty: qs.question.difficulty,
        isCorrect: qs.isCorrect,
        timestamp: new Date().toISOString(),
      })),
    });

    setHistoryKey((k) => k + 1);

    onRecordAttempt?.(record);
  };

  const handleSkip = () => {
    if (!currentQState || currentQState.isAnswered) {
      handleNext();
      return;
    }
    if (!staff) prepareSound()(['skipped']);
    // Record skipped as incorrect in adaptive progression
    const nextAdaptive = recordAdaptiveAnswer(adaptiveState, currentQ!.id, false);
    setAdaptiveState(nextAdaptive);

    setQuestionStates((prev) => {
      const next = [...prev];
      next[currentIndex] = {
        ...next[currentIndex],
        isAnswered: true,
        isCorrect: false,
        selectedOption: undefined,
        numericInput: undefined,
        shortAnswerInput: undefined,
      };
      return next;
    });

    handleNext(nextAdaptive);
  };

  const handleShowHint = () => {
    if (!currentQ?.hints?.length) return;
    setRevealedHints((prev) => Math.min(prev + 1, currentQ.hints.length));
  };

  return (
    <div className="practice-arena-app-container">
      {/* Top Header Bar */}
      <header className="practice-arena-top-header">
        <div className="practice-arena-header-left">
          <Button variant="ghost" className="practice-arena-header-back" onClick={onBack}>
            <ArrowLeft size={16} /> Learning Hub
          </Button>

          {/* Level Switcher (Basic 1, Basic 2) */}
          <div className="practice-arena-explore-badge" style={{ display: 'flex', gap: 6 }}>
            {availableLevels.map((lvl) => (
              <span
                key={lvl}
                style={{
                  padding: '2px 8px',
                  borderRadius: 4,
                  cursor: 'pointer',
                  background: selectedLevel === lvl ? 'rgba(255,255,255,0.25)' : 'transparent',
                  fontWeight: selectedLevel === lvl ? 700 : 500,
                  color: selectedLevel === lvl ? '#fff' : '#cce2f9',
                }}
                onClick={() => setSelectedLevel(lvl)}
              >
                {lvl}
              </span>
            ))}
          </div>
        </div>

        <div className="practice-arena-header-center">
          <div className="practice-arena-brand-logo">
            <span className="practice-arena-leaf-icon">🌿</span>
            <span className="practice-arena-logo-text">
              AYISATU OWEN · <em>NaCCA LMS</em>
            </span>
          </div>
        </div>

        <div className="practice-arena-header-right">
          <button
            onClick={() => setShowHistoryModal(true)}
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: 'none',
              color: '#d1e2fe',
              padding: '5px 10px',
              borderRadius: 4,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 12,
            }}
            title="View attempt history and retakes"
          >
            <History size={14} /> Attempt History ({indicatorAttemptsData.allAttempts.length})
          </button>
          <span className="practice-arena-curriculum-tag">
            {selectedLevel} {selectedSubject}
          </span>
          {staff && <span className="practice-arena-role-badge">Teacher Mode</span>}
        </div>
      </header>

      {/* Main Two-Column Practice Layout */}
      <div className={`practice-arena-layout ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        {/* Left Sidebar */}
        <aside className="practice-arena-sidebar">
          <div className="practice-arena-sidebar-header">
            <div className="practice-arena-course-card">
              <span className="practice-arena-course-icon">📘</span>
              <div>
                <h4>
                  {selectedLevel} {selectedSubject}
                </h4>
                <small>GES · NaCCA Standards ({filteredIndicators.length} Topics)</small>
              </div>
            </div>

            <div className="practice-arena-unit-breadcrumb">
              <span>
                COURSE: {selectedLevel.toUpperCase()} {selectedSubject.toUpperCase()}
              </span>{' '}
              › <span>UNIT: {currentUnit.name.toUpperCase()}</span>
            </div>

            <div className="practice-arena-lesson-title-bar">
              <h5>
                {currentIndicator.code}: {currentIndicator.sub_strand || currentIndicator.strand}
              </h5>
            </div>

            {/* Mastery Progress Bar (Configurable rule from src/nacca/mastery.ts) */}
            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: 6,
                padding: '8px 10px',
                marginTop: 8,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 4,
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: masteryResult.isMastered ? '#137333' : '#475569',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <Trophy size={13} color={masteryResult.isMastered ? '#137333' : '#94a3b8'} />
                  {masteryResult.isMastered ? 'Mastered 🏆' : 'Mastery Progress'}
                </span>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#1e293b' }}>
                  {masteryResult.progressPercent}%
                </span>
              </div>
              <div
                style={{
                  height: 6,
                  background: '#e2e8f0',
                  borderRadius: 3,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${masteryResult.progressPercent}%`,
                    background: masteryResult.isMastered ? '#137333' : '#1865f2',
                    transition: 'width 0.3s ease',
                  }}
                />
              </div>
              <div
                style={{
                  fontSize: 10,
                  color: '#64748b',
                  marginTop: 4,
                  display: 'flex',
                  justifyContent: 'space-between',
                }}
              >
                <span>Streak: {masteryResult.consecutiveCorrect}/5 in a row</span>
                <span>Attempts: {masteryResult.totalAttempts}</span>
              </div>
            </div>
          </div>

          {/* Mode Selector */}
          <div className="practice-arena-mode-tabs">
            <button
              className={mode === 'practice' ? 'active' : ''}
              onClick={() => { playPracticeCue(); setMode('practice'); }}
              title="Adaptive student practice"
            >
              Practice
            </button>
            <button
              className={mode === 'quiz' ? 'active' : ''}
              onClick={() => setMode('quiz')}
              title="Unit Quiz"
            >
              Quiz
            </button>
            <button
              className={mode === 'unit_test' ? 'active' : ''}
              onClick={() => setMode('unit_test')}
              title="Unit Test"
            >
              Unit test
            </button>
            <button
              className={mode === 'teacher_task' ? 'active' : ''}
              onClick={() => setMode('teacher_task')}
              title="Teacher-assessed tasks"
            >
              Rubrics
            </button>
          </div>

          {/* Topic List */}
          <div className="practice-arena-exercise-list">
            <div className="practice-arena-list-heading">
              TOPICS IN {currentUnit.name.toUpperCase()} ({currentUnit.indicators.length})
            </div>
            {currentUnit.indicators.map((ind) => {
              const active = ind.code === currentIndicatorCode;
              return (
                <button
                  key={`${ind.subject}:${ind.code}`}
                  className={`practice-arena-exercise-item ${active ? 'active' : ''}`}
                  onClick={() => {
                    playPracticeCue();
                    setCurrentIndicatorCode(ind.code);
                    restartSession();
                  }}
                >
                  <span className="practice-arena-item-indicator-icon">{active ? '✏️' : '○'}</span>
                  <div className="practice-arena-item-info">
                    <span className="practice-arena-item-code">{ind.code}</span>
                    <span className="practice-arena-item-name">{ind.sub_strand || ind.strand}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Bottom Breadcrumbs */}
          <div className="practice-arena-sidebar-footer">
            <div className="practice-arena-deep-breadcrumb">
              {selectedSubject} › {selectedLevel} › {currentIndicator.strand} ›{' '}
              {currentIndicator.sub_strand} › {currentIndicator.code}
            </div>
          </div>
        </aside>

        {/* Sidebar Collapse Toggle */}
        <button
          className="practice-arena-sidebar-toggle"
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
        >
          {sidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>

        {/* Center / Right Canvas */}
        <main className="practice-arena-main-stage">
          {sessionCompleted ? (
            /* Session Completed Screen */
            <div className="practice-arena-complete-card">
              <div className="practice-arena-celebration-badge">
                <Sparkles size={36} />
              </div>
              <h2>Good effort! Practice complete</h2>
              <p>
                You’ve finished this practice set on <strong>{currentIndicator.code}</strong>.
              </p>

              <div className="practice-arena-score-box">
                <div className="practice-arena-score-number">
                  {questionStates.filter((q) => q.isCorrect).length} / {questionStates.length}
                </div>
                <span>Questions Correct</span>
                <div className="practice-arena-score-percent">
                  {Math.round(
                    (questionStates.filter((q) => q.isCorrect).length /
                      (questionStates.length || 1)) *
                      100,
                  )}
                  % Accuracy
                </div>
              </div>

              {/* Mastery Progress Info */}
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: 8,
                  padding: '12px 16px',
                  maxWidth: 400,
                  margin: '0 auto 20px auto',
                  textAlign: 'left',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontWeight: 600,
                    marginBottom: 6,
                  }}
                >
                  <span>Indicator Mastery:</span>
                  <span style={{ color: masteryResult.isMastered ? '#137333' : '#1865f2' }}>
                    {masteryResult.progressPercent}%{' '}
                    {masteryResult.isMastered ? '(Mastered! 🏆)' : '(In Progress)'}
                  </span>
                </div>
                <div
                  style={{
                    height: 8,
                    background: '#e2e8f0',
                    borderRadius: 4,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${masteryResult.progressPercent}%`,
                      background: masteryResult.isMastered ? '#137333' : '#1865f2',
                    }}
                  />
                </div>
                <small style={{ color: '#64748b', display: 'block', marginTop: 6 }}>
                  Rule: Mastered after 5 correct in a row or 80% over the last 10 attempts.
                </small>
              </div>

              <div className="practice-arena-completion-actions">
                <Button onClick={() => { playPracticeCue(); restartSession(); }}>
                  <RotateCcw size={16} /> Practise again (Retake)
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    const currIdx = filteredIndicators.findIndex(
                      (ind) => ind.code === currentIndicatorCode,
                    );
                    const nextInd = filteredIndicators[(currIdx + 1) % filteredIndicators.length];
                    if (nextInd) {
                      setCurrentIndicatorCode(nextInd.code);
                      restartSession();
                    }
                  }}
                >
                  Next topic in curriculum <ChevronRight size={16} />
                </Button>
                <Button variant="ghost" onClick={() => setShowHistoryModal(true)}>
                  <History size={16} /> View all attempt history
                </Button>
              </div>
            </div>
          ) : !studentSafeQuestion ? (
            <div className="practice-arena-loading-stage">
              <p>No questions found for this indicator. Choose "Practice" or another topic.</p>
              <Button onClick={() => { playPracticeCue(); setMode('practice'); }}>Return to Practice</Button>
            </div>
          ) : (
            /* Active Question Screen */
            <div className="practice-arena-question-view">
              <div className="practice-arena-question-header-rule" />

              {/* Question Stem */}
              <div className="practice-arena-question-content">
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 10,
                  }}
                >
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: '#64748b',
                      textTransform: 'uppercase',
                      letterSpacing: 0.5,
                    }}
                  >
                    Question {currentIndex + 1} of {TARGET_PROBLEMS} · Difficulty Level{' '}
                    {studentSafeQuestion.difficulty}/4
                  </span>
                  <span
                    style={{
                      fontSize: 12,
                      color: '#1865f2',
                      background: '#eff6ff',
                      padding: '2px 8px',
                      borderRadius: 4,
                      fontWeight: 500,
                    }}
                  >
                    Adaptive Session
                  </span>
                </div>

                <h3 className="practice-arena-stem-text">{studentSafeQuestion.stem}</h3>

                {/* Sub-instruction label */}
                <div className="practice-arena-instruction-label">
                  {studentSafeQuestion.type === 'mcq' && 'Choose 1 answer:'}
                  {studentSafeQuestion.type === 'numeric' &&
                    'Enter your numeric answer (digits only):'}
                  {studentSafeQuestion.type === 'short_answer' && 'Type your answer:'}
                  {['written', 'oral', 'drawing', 'practical', 'role_play'].includes(
                    studentSafeQuestion.type,
                  ) && 'Teacher-assessed task (evaluated using rubric criteria):'}
                </div>

                {/* Validation Error Message */}
                {validationError && (
                  <div
                    style={{
                      background: '#fef2f2',
                      border: '1px solid #fecaca',
                      color: '#b91c1c',
                      padding: '8px 12px',
                      borderRadius: 6,
                      fontSize: 13,
                      marginBottom: 14,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <AlertCircle size={16} />
                    <span>{validationError}</span>
                  </div>
                )}

                {/* Question Inputs */}
                {studentSafeQuestion.type === 'mcq' && studentSafeQuestion.options && (
                  <div className="practice-arena-mcq-options">
                    {currentQState.optionOrder.map((optIdx, displayIndex) => {
                      const isSelected = currentQState.selectedOption === optIdx;
                      const isChecked = currentQState.isAnswered;
                      // Determine correct only AFTER check
                      const isOptionCorrect = isChecked && optIdx === currentQ?.answer;

                      let rowClass = 'practice-arena-option-row';
                      if (isSelected) rowClass += ' selected';
                      if (isChecked && isSelected) {
                        rowClass += currentQState.isCorrect ? ' correct' : ' incorrect';
                      } else if (isChecked && isOptionCorrect) {
                        rowClass += ' correct';
                      }

                      return (
                        <div
                          key={optIdx}
                          className={rowClass}
                          onClick={() => handleSelectOption(optIdx)}
                        >
                          <span className="practice-arena-opt-badge">{String.fromCharCode(65 + displayIndex)}</span>
                          <span className="practice-arena-opt-text">{studentSafeQuestion.options?.[optIdx]}</span>
                          {isChecked && isSelected && (
                            <span className="practice-arena-result-icon">
                              {currentQState.isCorrect ? (
                                <CheckCircle2 size={18} color="#137333" />
                              ) : (
                                <XCircle size={18} color="#c5221f" />
                              )}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Numeric Entry */}
                {studentSafeQuestion.type === 'numeric' && (
                  <div className="practice-arena-numeric-entry">
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="e.g. 5 or 5.0"
                      disabled={currentQState.isAnswered}
                      value={currentQState.numericInput || ''}
                      onChange={(e) => handleNumericInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          if (!currentQState.isAnswered) handleCheck();
                          else handleNext();
                        }
                      }}
                    />
                  </div>
                )}

                {/* Short Answer Entry */}
                {studentSafeQuestion.type === 'short_answer' && (
                  <div className="practice-arena-short-answer-entry">
                    <input
                      type="text"
                      placeholder="Type your answer here…"
                      disabled={currentQState.isAnswered}
                      value={currentQState.shortAnswerInput || ''}
                      onChange={(e) => handleShortAnswerInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          if (!currentQState.isAnswered) handleCheck();
                          else handleNext();
                        }
                      }}
                    />
                  </div>
                )}

                {/* Teacher-marked task input */}
                {['written', 'oral', 'drawing', 'practical', 'role_play'].includes(
                  studentSafeQuestion.type,
                ) && (
                  <div className="practice-arena-teacher-task-box">
                    <div className="practice-arena-rubric-table">
                      <strong>Marking Criteria:</strong>
                      <ul>
                        {currentQ?.rubric?.criteria.map((c, cIdx) => (
                          <li key={cIdx}>
                            <span>{c.description}</span>
                            <strong>
                              {c.marks} mark{c.marks !== 1 ? 's' : ''}
                            </strong>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <textarea
                      placeholder={
                        studentSafeQuestion.type === 'oral'
                          ? 'Transcribe your verbal response or notes here…'
                          : studentSafeQuestion.type === 'drawing'
                            ? 'Describe your drawing or upload a photo of your exercise book…'
                            : 'Type your detailed explanation or answer…'
                      }
                      rows={4}
                      disabled={currentQState.isAnswered}
                      value={currentQState.teacherInput || ''}
                      onChange={(e) => handleTeacherInput(e.target.value)}
                    />
                  </div>
                )}

                {/* Step-by-Step Hints BEFORE Answering */}
                {revealedHints > 0 && studentSafeQuestion.hints && (
                  <div className="practice-arena-hints-display">
                    {studentSafeQuestion.hints.slice(0, revealedHints).map((h, hIdx) => (
                      <div key={hIdx} className="practice-arena-hint-bubble">
                        <span className="practice-arena-hint-num">Hint {hIdx + 1}:</span>
                        <span>{h}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Worked Explanation AFTER Answering */}
                {showExplanation && currentQ?.explanation && (
                  <div className="practice-arena-explanation-display">
                    <strong>Worked Solution & Explanation:</strong>
                    <p>{currentQ.explanation}</p>
                    {currentQ.misconception && (
                      <p className="practice-arena-misconception-note">
                        💡 <strong>Common misconception note:</strong> {currentQ.misconception}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Bottom Sticky Action Bar */}
              <footer
                className={`practice-arena-bottom-bar ${
                  currentQState.isAnswered
                    ? currentQState.isCorrect
                      ? 'bar-correct'
                      : 'bar-incorrect'
                    : ''
                }`}
              >
                {/* Left tools / Hints */}
                <div className="practice-arena-bar-left">
                  {studentSafeQuestion.hints && studentSafeQuestion.hints.length > 0 && (
                    <button
                      className="practice-arena-hint-btn"
                      onClick={handleShowHint}
                      disabled={revealedHints >= studentSafeQuestion.hints.length}
                    >
                      <Lightbulb size={16} />
                      <span>
                        {revealedHints === 0
                          ? 'Get a hint'
                          : `Next hint (${revealedHints}/${studentSafeQuestion.hints.length})`}
                      </span>
                    </button>
                  )}
                  {currentQState.isAnswered && currentQ?.explanation && (
                    <button
                      className="practice-arena-hint-btn"
                      onClick={() => setShowExplanation(!showExplanation)}
                    >
                      <BookOpen size={16} />
                      <span>{showExplanation ? 'Hide explanation' : 'Show explanation'}</span>
                    </button>
                  )}
                </div>

                {/* Center: Problem progress circles */}
                <div className="practice-arena-bar-center">
                  <button
                    className="practice-arena-restart-btn"
                    onClick={() => { playPracticeCue(); restartSession(); }}
                    title="Restart this problem set"
                  >
                    <RotateCcw size={15} />
                  </button>
                  <span className="practice-arena-progress-label">Do {TARGET_PROBLEMS} problems</span>
                  <div className="practice-arena-progress-dots">
                    {Array.from({ length: TARGET_PROBLEMS }).map((_, dotIdx) => {
                      const st = questionStates[dotIdx];
                      let dotClass = 'practice-arena-dot';
                      if (dotIdx === currentIndex) dotClass += ' current';
                      if (st && st.isAnswered) {
                        dotClass += st.isCorrect ? ' dot-correct' : ' dot-incorrect';
                      }
                      return <span key={dotIdx} className={dotClass} />;
                    })}
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="practice-arena-bar-right">
                  {!currentQState.isAnswered ? (
                    <>
                      <button className="practice-arena-skip-btn" onClick={handleSkip}>
                        Skip
                      </button>
                      <button
                        className={`practice-arena-check-btn ${isInputSelected ? 'ready' : 'disabled'}`}
                        disabled={!isInputSelected}
                        onClick={handleCheck}
                      >
                        Check
                      </button>
                    </>
                  ) : currentQState.isCorrect ? (
                    <div className="practice-arena-feedback-group">
                      <span className="practice-arena-feedback-text correct">
                        <Check size={18} /> Great work!
                      </span>
                      <button className="practice-arena-next-btn" onClick={() => handleNext()}>
                        {currentIndex < TARGET_PROBLEMS - 1 ? 'Next question' : 'Show summary'}
                      </button>
                    </div>
                  ) : (
                    <div className="practice-arena-feedback-group">
                      <span className="practice-arena-feedback-text incorrect">
                        <AlertCircle size={18} /> Review explanation
                      </span>
                      <button className="practice-arena-next-btn" onClick={() => handleNext()}>
                        Move on
                      </button>
                    </div>
                  )}
                </div>
              </footer>
            </div>
          )}
        </main>
      </div>

      {/* Attempt History & Retakes Modal */}
      {showHistoryModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 20,
          }}
          onClick={() => setShowHistoryModal(false)}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 12,
              maxWidth: 650,
              width: '100%',
              maxHeight: '85vh',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: 18, color: '#0f172a' }}>
                  Attempt History: {currentIndicator.code}
                </h3>
                <small style={{ color: '#64748b' }}>
                  Auto-marked practice and teacher-marked tasks are tracked separately.
                </small>
              </div>
              <button
                onClick={() => setShowHistoryModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: 20,
                  cursor: 'pointer',
                  color: '#64748b',
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: 20, overflowY: 'auto' }}>
              <div style={{ marginBottom: 16 }}>
                <h4 style={{ margin: '0 0 8px 0', fontSize: 14, color: '#1e293b' }}>
                  Auto-Marked Practice Attempts ({indicatorAttemptsData.autoMarked.length})
                </h4>
                {indicatorAttemptsData.autoMarked.length === 0 ? (
                  <p style={{ fontSize: 13, color: '#94a3b8' }}>
                    No practice sessions completed yet.
                  </p>
                ) : (
                  <table
                    style={{
                      width: '100%',
                      borderCollapse: 'collapse',
                      fontSize: 13,
                      marginBottom: 16,
                    }}
                  >
                    <thead>
                      <tr
                        style={{
                          background: '#f8fafc',
                          textAlign: 'left',
                          borderBottom: '1px solid #e2e8f0',
                        }}
                      >
                        <th style={{ padding: '8px 10px' }}>Date</th>
                        <th style={{ padding: '8px 10px' }}>Score</th>
                        <th style={{ padding: '8px 10px' }}>Correct / Total</th>
                        <th style={{ padding: '8px 10px' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {indicatorAttemptsData.autoMarked.map((att) => (
                        <tr key={att.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '8px 10px', color: '#64748b' }}>
                            {new Date(att.completedAt).toLocaleString()}
                          </td>
                          <td style={{ padding: '8px 10px', fontWeight: 600 }}>{att.score}%</td>
                          <td style={{ padding: '8px 10px' }}>
                            {att.correctCount} / {att.totalCount}
                          </td>
                          <td style={{ padding: '8px 10px' }}>
                            <span
                              style={{
                                color: att.score >= 80 ? '#137333' : '#b45309',
                                background: att.score >= 80 ? '#e6f4ea' : '#fef3c7',
                                padding: '2px 6px',
                                borderRadius: 4,
                                fontSize: 11,
                              }}
                            >
                              {att.score >= 80 ? 'Mastered' : 'Needs practice'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              <div>
                <h4 style={{ margin: '0 0 8px 0', fontSize: 14, color: '#1e293b' }}>
                  Teacher-Assessed Tasks ({indicatorAttemptsData.teacherMarked.length})
                </h4>
                {indicatorAttemptsData.teacherMarked.length === 0 ? (
                  <p style={{ fontSize: 13, color: '#94a3b8' }}>
                    No teacher-marked tasks submitted for this indicator yet.
                  </p>
                ) : (
                  <table
                    style={{
                      width: '100%',
                      borderCollapse: 'collapse',
                      fontSize: 13,
                    }}
                  >
                    <thead>
                      <tr
                        style={{
                          background: '#f8fafc',
                          textAlign: 'left',
                          borderBottom: '1px solid #e2e8f0',
                        }}
                      >
                        <th style={{ padding: '8px 10px' }}>Date</th>
                        <th style={{ padding: '8px 10px' }}>Score</th>
                        <th style={{ padding: '8px 10px' }}>Assessed By</th>
                      </tr>
                    </thead>
                    <tbody>
                      {indicatorAttemptsData.teacherMarked.map((att) => (
                        <tr key={att.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '8px 10px', color: '#64748b' }}>
                            {new Date(att.completedAt).toLocaleString()}
                          </td>
                          <td style={{ padding: '8px 10px', fontWeight: 600 }}>{att.score}%</td>
                          <td style={{ padding: '8px 10px', color: '#64748b' }}>
                            Teacher Review Queue
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            <div
              style={{
                padding: '12px 20px',
                borderTop: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'flex-end',
                background: '#f8fafc',
              }}
            >
              <Button onClick={() => setShowHistoryModal(false)}>Close</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
