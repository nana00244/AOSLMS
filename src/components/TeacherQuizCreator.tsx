import { useState, useMemo } from 'react';
import {
  X,
  FileQuestion,
  Sparkles,
  Calendar,
  Users,
  CheckCircle2,
  AlertCircle,
  Clock,
  Layers,
  ChevronRight,
} from 'lucide-react';
import { Button, Field } from './ui';
import {
  naccaIndicators,
  naccaSubjects,
  naccaLevels,
  naccaQuestions,
} from '../learningHub/naccaBank';
import {
  createQuiz,
  getEligibleQuestions,
  type AssessmentKind,
  type DifficultyMix,
  type QuizDefinition,
} from '../nacca/quizEngine';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onQuizCreated: (quiz: QuizDefinition) => void;
  classes: { id: string; name: string }[];
  students: { id: string; name: string; classId: string }[];
  currentUser?: { id: string; name: string };
  initialLevel?: string;
  initialIndicator?: string;
}

export function TeacherQuizCreator({
  isOpen,
  onClose,
  onQuizCreated,
  classes,
  students,
  currentUser,
  initialLevel,
  initialIndicator,
}: Props) {
  const [kind, setKind] = useState<AssessmentKind>('quiz');
  const [subject, setSubject] = useState('Mathematics');
  const [level, setLevel] = useState(initialLevel || 'Basic 1');
  const [title, setTitle] = useState('');
  const [selectedIndicators, setSelectedIndicators] = useState<string[]>(
    initialIndicator ? [initialIndicator] : [],
  );
  const [questionCount, setQuestionCount] = useState<number>(5);
  const [mixMode, setMixMode] = useState<'any' | 'balanced' | 'custom'>('balanced');
  const [diffCounts, setDiffCounts] = useState({ 1: 2, 2: 2, 3: 1, 4: 0 });
  const [randomizePerStudent, setRandomizePerStudent] = useState<boolean>(true);
  const [targetType, setTargetType] = useState<'class' | 'students'>('class');
  const [selectedClassId, setSelectedClassId] = useState<string>(classes[0]?.id || '');
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);

  // Default due date: 7 days from now
  const [dueDate, setDueDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  });
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Update available indicators for selected subject and level
  const availableIndicators = useMemo(() => {
    return naccaIndicators.filter(
      (ind) =>
        ind.subject.toLowerCase() === subject.toLowerCase() &&
        ind.level.toLowerCase() === level.toLowerCase(),
    );
  }, [subject, level]);

  // Available students for selected class or whole list
  const availableStudents = useMemo(() => {
    if (targetType === 'class' && selectedClassId) {
      return students.filter((s) => s.classId === selectedClassId);
    }
    return students;
  }, [students, targetType, selectedClassId]);

  // Compute eligible questions from bank
  const eligibleQuestions = useMemo(() => {
    return getEligibleQuestions(subject, level, selectedIndicators, naccaQuestions);
  }, [subject, level, selectedIndicators]);

  // Check how many are auto-scorable vs teacher-marked
  const autoScorableCount = useMemo(() => {
    return eligibleQuestions.filter((q) => ['mcq', 'numeric', 'short_answer'].includes(q.type))
      .length;
  }, [eligibleQuestions]);

  const teacherMarkedCount = useMemo(() => {
    return eligibleQuestions.filter((q) =>
      ['written', 'oral', 'drawing', 'practical', 'role_play'].includes(q.type),
    ).length;
  }, [eligibleQuestions]);

  if (!isOpen) return null;

  const toggleIndicator = (code: string) => {
    setSelectedIndicators((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
    );
  };

  const selectAllIndicators = () => {
    if (selectedIndicators.length === availableIndicators.length) {
      setSelectedIndicators([]);
    } else {
      setSelectedIndicators(availableIndicators.map((i) => i.code));
    }
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (selectedIndicators.length === 0) {
      setErrorMsg('Please select at least one indicator/topic for the test.');
      return;
    }

    if (eligibleQuestions.length === 0) {
      setErrorMsg('No approved questions found for the selected indicators.');
      return;
    }

    if (questionCount <= 0) {
      setErrorMsg('Please choose at least 1 question.');
      return;
    }

    if (!dueDate) {
      setErrorMsg('Please choose a valid due date.');
      return;
    }

    const assignedClassName = classes.find((c) => c.id === selectedClassId)?.name || 'All Classes';
    const assignedIds =
      targetType === 'class' ? availableStudents.map((s) => s.id) : selectedStudentIds;

    if (assignedIds.length === 0 && students.length > 0) {
      setErrorMsg('Please select at least one student or a class with enrolled students.');
      return;
    }

    const defaultTitle =
      title.trim() ||
      `${level} ${subject} ${kind === 'unit_test' ? 'Unit Test' : 'Quiz'} (${selectedIndicators.join(', ')})`;

    const diffMix: DifficultyMix = {
      mode: mixMode,
      ...(mixMode === 'custom'
        ? {
            diff1: diffCounts[1],
            diff2: diffCounts[2],
            diff3: diffCounts[3],
            diff4: diffCounts[4],
          }
        : {}),
    };

    const studentNames: Record<string, string> = {};
    students.forEach((s) => {
      studentNames[s.id] = s.name;
    });

    try {
      const created = createQuiz({
        kind,
        title: defaultTitle,
        subject,
        level,
        indicatorCodes: selectedIndicators,
        questionCount,
        difficultyMix: diffMix,
        randomizePerStudent,
        assignmentTarget: targetType,
        classId: targetType === 'class' ? selectedClassId : undefined,
        className: targetType === 'class' ? assignedClassName : undefined,
        assignedStudentIds: assignedIds,
        assignedStudentNames: studentNames,
        dueDate,
        createdBy: currentUser?.name || 'Teacher',
      });

      onQuizCreated(created);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create assessment.');
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        backgroundColor: 'rgba(10, 37, 64, 0.65)',
        backdropFilter: 'blur(3px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        overflowY: 'auto',
      }}
    >
      <div
        style={{
          backgroundColor: '#fff',
          borderRadius: '12px',
          width: '100%',
          maxWidth: '760px',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
          border: '1px solid #e2e8f0',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '18px 24px',
            borderBottom: '1px solid #e2e8f0',
            backgroundColor: '#0a2540',
            color: '#fff',
            borderTopLeftRadius: '12px',
            borderTopRightRadius: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span
              style={{
                width: 36,
                height: 36,
                borderRadius: '8px',
                background: 'rgba(255,255,255,0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <FileQuestion size={20} color="#57d598" />
            </span>
            <div>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#fff' }}>
                Create Quiz or Unit Test
              </h2>
              <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#94a3b8' }}>
                NaCCA Ghana Curriculum · Pick approved questions from verified bank
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '6px',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleCreate} style={{ overflowY: 'auto', padding: '24px', flex: 1 }}>
          {errorMsg && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                backgroundColor: '#fef2f2',
                color: '#b91c1c',
                padding: '10px 14px',
                borderRadius: 8,
                marginBottom: 16,
                fontSize: 13,
                border: '1px solid #fecaca',
              }}
            >
              <AlertCircle size={16} />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Assessment Kind & Level Row */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: '16px',
              marginBottom: '18px',
            }}
          >
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#334155',
                  marginBottom: 6,
                }}
              >
                Assessment Kind
              </label>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  type="button"
                  onClick={() => setKind('quiz')}
                  style={{
                    flex: 1,
                    padding: '8px 10px',
                    borderRadius: 6,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                    border: kind === 'quiz' ? '2px solid #1865f2' : '1px solid #cbd5e1',
                    background: kind === 'quiz' ? '#eff6ff' : '#fff',
                    color: kind === 'quiz' ? '#1865f2' : '#475569',
                  }}
                >
                  ⚡ Quick Quiz
                </button>
                <button
                  type="button"
                  onClick={() => setKind('unit_test')}
                  style={{
                    flex: 1,
                    padding: '8px 10px',
                    borderRadius: 6,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                    border: kind === 'unit_test' ? '2px solid #1865f2' : '1px solid #cbd5e1',
                    background: kind === 'unit_test' ? '#eff6ff' : '#fff',
                    color: kind === 'unit_test' ? '#1865f2' : '#475569',
                  }}
                >
                  🏆 Unit Test
                </button>
              </div>
            </div>

            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#334155',
                  marginBottom: 6,
                }}
              >
                Subject
              </label>
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: 6,
                  border: '1px solid #cbd5e1',
                  fontSize: 13,
                  backgroundColor: '#fff',
                }}
              >
                {naccaSubjects.map((s) => (
                  <option key={s.id} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#334155',
                  marginBottom: 6,
                }}
              >
                Level
              </label>
              <select
                value={level}
                onChange={(e) => {
                  setLevel(e.target.value);
                  setSelectedIndicators([]);
                }}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: 6,
                  border: '1px solid #cbd5e1',
                  fontSize: 13,
                  backgroundColor: '#fff',
                }}
              >
                {naccaLevels.map((l) => (
                  <option key={l.id} value={l.name}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Assessment Title */}
          <div style={{ marginBottom: '18px' }}>
            <label
              style={{
                display: 'block',
                fontSize: '12px',
                fontWeight: 600,
                color: '#334155',
                marginBottom: 6,
              }}
            >
              Assessment Title (Optional - auto-generated if left blank)
            </label>
            <input
              type="text"
              placeholder={`e.g. ${level} ${subject} Mid-Term ${kind === 'unit_test' ? 'Unit Test' : 'Quiz'}`}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: 6,
                border: '1px solid #cbd5e1',
                fontSize: 13,
              }}
            />
          </div>

          {/* Indicator Selection */}
          <div style={{ marginBottom: '18px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 6,
              }}
            >
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>
                Select Topics / Indicators ({selectedIndicators.length} of{' '}
                {availableIndicators.length} selected)
              </label>
              <button
                type="button"
                onClick={selectAllIndicators}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#1865f2',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {selectedIndicators.length === availableIndicators.length
                  ? 'Deselect All'
                  : 'Select All'}
              </button>
            </div>

            <div
              style={{
                maxHeight: '170px',
                overflowY: 'auto',
                border: '1px solid #e2e8f0',
                borderRadius: 8,
                padding: '8px 12px',
                backgroundColor: '#f8fafc',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              {availableIndicators.map((ind) => {
                const isSelected = selectedIndicators.includes(ind.code);
                const qCount = naccaQuestions.filter(
                  (q) =>
                    q.indicator_code === ind.code &&
                    q.subject.toLowerCase() === subject.toLowerCase(),
                ).length;
                return (
                  <label
                    key={`${ind.subject}:${ind.code}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      fontSize: 12,
                      cursor: 'pointer',
                      padding: '4px 6px',
                      borderRadius: 4,
                      backgroundColor: isSelected ? '#eff6ff' : 'transparent',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleIndicator(ind.code)}
                    />
                    <span style={{ fontWeight: 600, color: '#1e293b' }}>{ind.code}</span>
                    <span
                      style={{
                        color: '#64748b',
                        flex: 1,
                        textOverflow: 'ellipsis',
                        overflow: 'hidden',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {ind.strand} · {ind.objective || ind.sub_strand}
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        backgroundColor: '#e2e8f0',
                        color: '#475569',
                        padding: '1px 6px',
                        borderRadius: 10,
                      }}
                    >
                      {qCount} qs
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Number of Questions & Difficulty Mix */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 2fr',
              gap: '16px',
              marginBottom: '18px',
            }}
          >
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#334155',
                  marginBottom: 6,
                }}
              >
                Number of Questions
              </label>
              <select
                value={questionCount}
                onChange={(e) => setQuestionCount(Number(e.target.value))}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: 6,
                  border: '1px solid #cbd5e1',
                  fontSize: 13,
                  backgroundColor: '#fff',
                }}
              >
                <option value={3}>3 questions (Micro quiz)</option>
                <option value={5}>5 questions (Standard quiz)</option>
                <option value={10}>10 questions (Full assessment)</option>
                <option value={15}>15 questions (Comprehensive)</option>
                <option value={20}>20 questions (Unit benchmark)</option>
              </select>
            </div>

            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#334155',
                  marginBottom: 6,
                }}
              >
                Difficulty Mix
              </label>
              <div style={{ display: 'flex', gap: 6 }}>
                {(['balanced', 'any', 'custom'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMixMode(m)}
                    style={{
                      flex: 1,
                      padding: '8px 6px',
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      border: mixMode === m ? '2px solid #1865f2' : '1px solid #cbd5e1',
                      background: mixMode === m ? '#eff6ff' : '#fff',
                      color: mixMode === m ? '#1865f2' : '#475569',
                    }}
                  >
                    {m === 'balanced'
                      ? '⚖️ Balanced (1-4)'
                      : m === 'any'
                        ? '🎲 Any Difficulty'
                        : '⚙️ Custom Mix'}
                  </button>
                ))}
              </div>

              {mixMode === 'custom' && (
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  {[1, 2, 3, 4].map((d) => (
                    <div key={d} style={{ flex: 1, textAlign: 'center' }}>
                      <span style={{ fontSize: 10, color: '#64748b' }}>Diff {d}</span>
                      <input
                        type="number"
                        min={0}
                        max={10}
                        value={diffCounts[d as 1 | 2 | 3 | 4]}
                        onChange={(e) =>
                          setDiffCounts((prev) => ({
                            ...prev,
                            [d]: Math.max(0, Number(e.target.value)),
                          }))
                        }
                        style={{
                          width: '100%',
                          textAlign: 'center',
                          padding: '4px',
                          borderRadius: 4,
                          border: '1px solid #cbd5e1',
                          fontSize: 12,
                        }}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Randomization & Assignment Target */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '16px',
              marginBottom: '18px',
            }}
          >
            <div
              style={{
                border: '1px solid #e2e8f0',
                borderRadius: 8,
                padding: '12px',
                backgroundColor: '#f8fafc',
              }}
            >
              <label
                style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer' }}
              >
                <input
                  type="checkbox"
                  checked={randomizePerStudent}
                  onChange={(e) => setRandomizePerStudent(e.target.checked)}
                  style={{ marginTop: 3 }}
                />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>
                    Randomize questions per student
                  </div>
                  <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                    Each student gets a unique random set of questions from the approved bank,
                    preventing copying.
                  </div>
                </div>
              </label>
            </div>

            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#334155',
                  marginBottom: 6,
                }}
              >
                Due Date
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: 6,
                    border: '1px solid #cbd5e1',
                    fontSize: 13,
                  }}
                />
              </div>
            </div>
          </div>

          {/* Assign To (Class or Students) */}
          <div style={{ marginBottom: '18px' }}>
            <label
              style={{
                display: 'block',
                fontSize: '12px',
                fontWeight: 600,
                color: '#334155',
                marginBottom: 6,
              }}
            >
              Assign Assessment To
            </label>
            <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                <input
                  type="radio"
                  name="targetType"
                  checked={targetType === 'class'}
                  onChange={() => setTargetType('class')}
                />
                Whole Class
              </label>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                <input
                  type="radio"
                  name="targetType"
                  checked={targetType === 'students'}
                  onChange={() => setTargetType('students')}
                />
                Specific Students
              </label>
            </div>

            {targetType === 'class' ? (
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: 6,
                  border: '1px solid #cbd5e1',
                  fontSize: 13,
                  backgroundColor: '#fff',
                }}
              >
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({students.filter((s) => s.classId === c.id).length} students)
                  </option>
                ))}
              </select>
            ) : (
              <div
                style={{
                  maxHeight: '120px',
                  overflowY: 'auto',
                  border: '1px solid #cbd5e1',
                  borderRadius: 6,
                  padding: '8px',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: 6,
                }}
              >
                {students.map((s) => (
                  <label
                    key={s.id}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedStudentIds.includes(s.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedStudentIds((prev) => [...prev, s.id]);
                        } else {
                          setSelectedStudentIds((prev) => prev.filter((id) => id !== s.id));
                        }
                      }}
                    />
                    {s.name}
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Bank Summary Preview */}
          <div
            style={{
              padding: '12px 16px',
              backgroundColor: '#f0fdf4',
              borderRadius: 8,
              border: '1px solid #bbf7d0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 16,
            }}
          >
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#166534' }}>
                Approved Pool: {eligibleQuestions.length} Questions Available
              </div>
              <div style={{ fontSize: 11, color: '#15803d', marginTop: 2 }}>
                {autoScorableCount} auto-scored (mcq, numeric, short_answer) · {teacherMarkedCount}{' '}
                teacher-marked tasks
              </div>
            </div>
            {teacherMarkedCount > 0 ? (
              <span
                style={{
                  fontSize: 11,
                  backgroundColor: '#fef3c7',
                  color: '#92400e',
                  padding: '4px 8px',
                  borderRadius: 4,
                  fontWeight: 600,
                }}
              >
                Includes Teacher Marking
              </span>
            ) : (
              <span
                style={{
                  fontSize: 11,
                  backgroundColor: '#dcfce7',
                  color: '#15803d',
                  padding: '4px 8px',
                  borderRadius: 4,
                  fontWeight: 600,
                }}
              >
                100% Instant Auto-Grading
              </span>
            )}
          </div>

          {/* Action Buttons */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 12,
              paddingTop: 12,
              borderTop: '1px solid #e2e8f0',
            }}
          >
            <Button variant="secondary" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">
              Publish & Assign {kind === 'unit_test' ? 'Unit Test' : 'Quiz'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
