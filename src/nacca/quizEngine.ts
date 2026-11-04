import type { NaccaQuestion, QuestionType, StudentNaccaQuestion } from './types';
import { evaluateAnswer, sanitizeQuestionForStudent } from './answerChecker';
import { naccaQuestions } from '../learningHub/naccaBank';

export type AssessmentKind = 'quiz' | 'unit_test';

export interface DifficultyMix {
  mode: 'any' | 'balanced' | 'custom';
  diff1?: number;
  diff2?: number;
  diff3?: number;
  diff4?: number;
}

export interface QuizDefinition {
  id: string;
  kind: AssessmentKind;
  title: string;
  subject: string;
  level: string;
  indicatorCodes: string[];
  questionCount: number;
  difficultyMix: DifficultyMix;
  randomizePerStudent: boolean;
  assignmentTarget: 'class' | 'students';
  classId?: string;
  className?: string;
  assignedStudentIds: string[];
  assignedStudentNames?: Record<string, string>;
  dueDate: string;
  fixedQuestionIds?: string[];
  hasTeacherMarkedQuestions: boolean;
  createdAt: string;
  createdBy: string;
}

export interface QuizSubmissionAnswer {
  questionId: string;
  type: QuestionType;
  difficulty: number;
  selectedOption?: number;
  numericInput?: string;
  shortAnswerInput?: string;
  writtenAnswer?: string;
  audioBlobUrl?: string;
  attachmentName?: string;
  // Result
  isAutoScored: boolean;
  isCorrect?: boolean;
  autoScore?: number; // 0 or 1
  autoFeedback?: string;
  teacherScore?: number;
  teacherMaxScore?: number;
  teacherComment?: string;
}

export interface QuizSubmissionRecord {
  id: string;
  quizId: string;
  quizTitle: string;
  kind: AssessmentKind;
  studentId: string;
  studentName: string;
  submittedAt: string;
  status: 'graded' | 'awaiting teacher marking';
  // Rule 4: Auto-scored results and teacher-marked results stored SEPARATELY
  autoScore: {
    pointsAwarded: number;
    pointsPossible: number;
    percentage: number;
  };
  teacherAssessed: {
    pointsAwarded: number;
    pointsPossible: number;
    percentage: number;
    isPending: boolean;
    status: 'awaiting marking' | 'marked' | 'none';
  };
  answers: QuizSubmissionAnswer[];
}

const QUIZZES_STORAGE_KEY = 'nacca_quizzes_v1';
const SUBMISSIONS_STORAGE_KEY = 'nacca_quiz_submissions_v1';
const inMemoryStore = new Map<string, string>();

function getStorage(key: string): string | null {
  try {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(key);
    }
  } catch {
    // fallback
  }
  return inMemoryStore.get(key) || null;
}

function setStorage(key: string, val: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, val);
      return;
    }
  } catch {
    // fallback
  }
  inMemoryStore.set(key, val);
}

/**
 * Filter questions from the approved question bank matching the chosen subject, level, and indicators.
 * Strictly adheres to Rule 5: Only approved questions from the imported file are used.
 */
export function getEligibleQuestions(
  subject: string,
  level: string,
  indicatorCodes: string[],
  pool: NaccaQuestion[] = naccaQuestions,
): NaccaQuestion[] {
  const normSubj = (subject || '').trim().toLowerCase();
  const normLvl = (level || '').trim().toLowerCase();
  const indicatorSet = new Set(indicatorCodes.map((c) => c.trim().toLowerCase()));

  return pool.filter((q) => {
    if (normSubj && q.subject.trim().toLowerCase() !== normSubj) return false;
    if (normLvl && q.level.trim().toLowerCase() !== normLvl) return false;
    if (indicatorSet.size > 0 && !indicatorSet.has(q.indicator_code.trim().toLowerCase())) {
      return false;
    }
    return true;
  });
}

/**
 * Picks random questions according to the desired count and difficulty mix.
 * Never invents questions (Rule 1 & 5). Does not repeat questions in a paper.
 */
export function pickQuizQuestions(
  eligiblePool: NaccaQuestion[],
  count: number,
  mix: DifficultyMix,
  seed?: string,
): NaccaQuestion[] {
  if (!eligiblePool || eligiblePool.length === 0) return [];
  const targetCount = Math.min(count, eligiblePool.length);

  // Simple pseudo-random shuffle optionally seeded by student identifier
  const shuffled = [...eligiblePool].sort((a, b) => {
    if (seed) {
      const hashA = hashString(`${seed}_${a.id}`);
      const hashB = hashString(`${seed}_${b.id}`);
      return hashA - hashB;
    }
    return Math.random() - 0.5;
  });

  if (mix.mode === 'any' || !mix.mode) {
    return shuffled.slice(0, targetCount);
  }

  // Difficulty grouped
  const byDiff: Record<number, NaccaQuestion[]> = { 1: [], 2: [], 3: [], 4: [] };
  for (const q of shuffled) {
    const d = q.difficulty >= 1 && q.difficulty <= 4 ? q.difficulty : 1;
    byDiff[d].push(q);
  }

  const selected: NaccaQuestion[] = [];
  const selectedIds = new Set<string>();

  if (mix.mode === 'balanced') {
    // Balance evenly across difficulties 1 to 4
    let currentDiff = 1;
    while (selected.length < targetCount) {
      let foundOne = false;
      for (let i = 0; i < 4; i++) {
        const d = ((currentDiff - 1 + i) % 4) + 1;
        const candidate = byDiff[d].find((q) => !selectedIds.has(q.id));
        if (candidate) {
          selected.push(candidate);
          selectedIds.add(candidate.id);
          foundOne = true;
          currentDiff = (d % 4) + 1;
          break;
        }
      }
      if (!foundOne) break; // Exhausted available pool
    }
    return selected;
  }

  if (mix.mode === 'custom') {
    const targets: Record<number, number> = {
      1: mix.diff1 || 0,
      2: mix.diff2 || 0,
      3: mix.diff3 || 0,
      4: mix.diff4 || 0,
    };

    for (const d of [1, 2, 3, 4]) {
      const needed = targets[d] || 0;
      const candidates = byDiff[d].slice(0, needed);
      for (const q of candidates) {
        if (!selectedIds.has(q.id) && selected.length < targetCount) {
          selected.push(q);
          selectedIds.add(q.id);
        }
      }
    }

    // If still need more to reach targetCount, fill with remaining
    for (const q of shuffled) {
      if (selected.length >= targetCount) break;
      if (!selectedIds.has(q.id)) {
        selected.push(q);
        selectedIds.add(q.id);
      }
    }

    return selected;
  }

  return shuffled.slice(0, targetCount);
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

/**
 * Creates and stores a new quiz or unit test definition.
 */
export function createQuiz(
  params: Omit<
    QuizDefinition,
    'id' | 'createdAt' | 'hasTeacherMarkedQuestions' | 'fixedQuestionIds'
  > & {
    id?: string;
  },
  pool: NaccaQuestion[] = naccaQuestions,
): QuizDefinition {
  const eligible = getEligibleQuestions(params.subject, params.level, params.indicatorCodes, pool);

  // Pick fixed question IDs if not randomizing per student
  let fixedQuestionIds: string[] | undefined;
  if (!params.randomizePerStudent) {
    const fixed = pickQuizQuestions(eligible, params.questionCount, params.difficultyMix);
    fixedQuestionIds = fixed.map((q) => q.id);
  }

  // Check if eligible questions contain teacher-marked question types
  const chosenOrEligibleQuestions = fixedQuestionIds
    ? pool.filter((q) => fixedQuestionIds?.includes(q.id))
    : eligible;

  const hasTeacherMarked = chosenOrEligibleQuestions.some((q) =>
    ['written', 'oral', 'drawing', 'practical', 'role_play'].includes(q.type),
  );

  const quiz: QuizDefinition = {
    ...params,
    id: params.id || `quiz_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    fixedQuestionIds,
    hasTeacherMarkedQuestions: hasTeacherMarked,
    createdAt: new Date().toISOString(),
  };

  const existing = listQuizzes();
  setStorage(QUIZZES_STORAGE_KEY, JSON.stringify([quiz, ...existing]));
  return quiz;
}

/**
 * Default seeded assessments covering Basic 1, 2, and 3.
 */
function getDefaultSeededQuizzes(): QuizDefinition[] {
  return [
    {
      id: 'quiz_seed_b6_unit_test',
      kind: 'unit_test',
      title: 'Basic 6 Algebra, Fractions & Probability Comprehensive Unit Test',
      subject: 'Mathematics',
      level: 'Basic 6',
      indicatorCodes: ['B6.1.1.1.2', 'B6.1.3.1.1', 'B6.2.2.1.1', 'B6.4.2.2.1'],
      questionCount: 8,
      difficultyMix: { mode: 'balanced' },
      randomizePerStudent: true,
      assignmentTarget: 'class',
      className: 'Basic 6 Class',
      assignedStudentIds: ['student_demo'],
      dueDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
      hasTeacherMarkedQuestions: true,
      createdAt: new Date().toISOString(),
      createdBy: 'GES Lead Teacher',
    },
    {
      id: 'quiz_seed_b5_unit_test',
      kind: 'unit_test',
      title: 'Basic 5 Fractions, Decimals & Data Mastery Unit Test',
      subject: 'Mathematics',
      level: 'Basic 5',
      indicatorCodes: ['B5.1.1.1.1', 'B5.1.2.1.1', 'B5.2.1.1.1', 'B5.4.1.1.1'],
      questionCount: 8,
      difficultyMix: { mode: 'balanced' },
      randomizePerStudent: true,
      assignmentTarget: 'class',
      className: 'Basic 5 Class',
      assignedStudentIds: ['student_demo'],
      dueDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
      hasTeacherMarkedQuestions: true,
      createdAt: new Date().toISOString(),
      createdBy: 'GES Lead Teacher',
    },
    {
      id: 'quiz_seed_b4_unit_test',
      kind: 'unit_test',
      title: 'Basic 4 Decimals, Fractions & Geometry Unit Test',
      subject: 'Mathematics',
      level: 'Basic 4',
      indicatorCodes: ['B4.1.1.4.2', 'B4.1.2.1.1', 'B4.1.3.1.1', 'B4.3.3.1.3'],
      questionCount: 8,
      difficultyMix: { mode: 'balanced' },
      randomizePerStudent: true,
      assignmentTarget: 'class',
      className: 'Basic 4 Class',
      assignedStudentIds: ['student_demo'],
      dueDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
      hasTeacherMarkedQuestions: true,
      createdAt: new Date().toISOString(),
      createdBy: 'GES Lead Teacher',
    },
    {
      id: 'quiz_seed_b3_unit_test',
      kind: 'unit_test',
      title: 'Basic 3 Mathematics Comprehensive Unit Test',
      subject: 'Mathematics',
      level: 'Basic 3',
      indicatorCodes: ['B3.1.1.1.1', 'B3.1.2.1.1', 'B3.1.3.1.1', 'B3.3.1.1.1'],
      questionCount: 8,
      difficultyMix: { mode: 'balanced' },
      randomizePerStudent: true,
      assignmentTarget: 'class',
      className: 'Basic 3 Class',
      assignedStudentIds: ['student_demo'],
      dueDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
      hasTeacherMarkedQuestions: true,
      createdAt: new Date().toISOString(),
      createdBy: 'GES Lead Teacher',
    },
    {
      id: 'quiz_seed_b2_operations',
      kind: 'quiz',
      title: 'Basic 2 Addition & Subtraction Practice Quiz',
      subject: 'Mathematics',
      level: 'Basic 2',
      indicatorCodes: ['B2.1.2.4.1', 'B2.1.2.3', 'B2.1.1.1.1'],
      questionCount: 5,
      difficultyMix: { mode: 'balanced' },
      randomizePerStudent: true,
      assignmentTarget: 'class',
      className: 'Basic 2 Class',
      assignedStudentIds: ['student_demo'],
      dueDate: new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0],
      hasTeacherMarkedQuestions: false,
      createdAt: new Date().toISOString(),
      createdBy: 'Curriculum Team',
    },
    {
      id: 'quiz_seed_b1_counting',
      kind: 'quiz',
      title: 'Basic 1 Counting & Quantities Quick Quiz',
      subject: 'Mathematics',
      level: 'Basic 1',
      indicatorCodes: ['B1.1.1.1.1', 'B1.1.1.1.2'],
      questionCount: 5,
      difficultyMix: { mode: 'balanced' },
      randomizePerStudent: false,
      assignmentTarget: 'class',
      className: 'Basic 1 Class',
      assignedStudentIds: ['student_demo'],
      dueDate: new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0],
      hasTeacherMarkedQuestions: false,
      createdAt: new Date().toISOString(),
      createdBy: 'Curriculum Team',
    },
    {
      id: 'quiz_seed_b1_science_diversity',
      kind: 'quiz',
      title: 'Basic 1 Science: Living & Non-Living Things Quick Check',
      subject: 'Science',
      level: 'Basic 1',
      indicatorCodes: ['B1.1.1.1.1', 'B1.1.1.2.2', 'B1.1.1.2.3'],
      questionCount: 5,
      difficultyMix: { mode: 'balanced' },
      randomizePerStudent: true,
      assignmentTarget: 'class',
      className: 'Basic 1 Class',
      assignedStudentIds: ['student_demo'],
      dueDate: new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0],
      hasTeacherMarkedQuestions: false,
      createdAt: new Date().toISOString(),
      createdBy: 'GES Science Curriculum Lead',
    },
    {
      id: 'quiz_seed_b2_science_structures',
      kind: 'quiz',
      title: 'Basic 2 Science: Plant & Animal Structures Quick Quiz',
      subject: 'Science',
      level: 'Basic 2',
      indicatorCodes: ['B2.1.1.1.1', 'B2.1.1.2.1', 'B2.1.2.1.1'],
      questionCount: 5,
      difficultyMix: { mode: 'balanced' },
      randomizePerStudent: true,
      assignmentTarget: 'class',
      className: 'Basic 2 Class',
      assignedStudentIds: ['student_demo'],
      dueDate: new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0],
      hasTeacherMarkedQuestions: false,
      createdAt: new Date().toISOString(),
      createdBy: 'GES Science Curriculum Lead',
    },
    {
      id: 'quiz_seed_b3_science_ecosystems',
      kind: 'quiz',
      title: 'Basic 3 Science: Living Things & Ecosystems Quick Check',
      subject: 'Science',
      level: 'Basic 3',
      indicatorCodes: ['B3.1.1.1.1', 'B3.3.1.1.1', 'B3.3.3.1.1'],
      questionCount: 5,
      difficultyMix: { mode: 'balanced' },
      randomizePerStudent: true,
      assignmentTarget: 'class',
      className: 'Basic 3 Class',
      assignedStudentIds: ['student_demo'],
      dueDate: new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0],
      hasTeacherMarkedQuestions: false,
      createdAt: new Date().toISOString(),
      createdBy: 'GES Science Curriculum Lead',
    },
    {
      id: 'quiz_seed_b4_science_systems',
      kind: 'quiz',
      title: 'Basic 4 Science: Human Body, Plants & Energy Quick Check',
      subject: 'Science',
      level: 'Basic 4',
      indicatorCodes: ['B4.1.1.1.1', 'B4.2.2.1.1', 'B4.3.1.1.1'],
      questionCount: 5,
      difficultyMix: { mode: 'balanced' },
      randomizePerStudent: true,
      assignmentTarget: 'class',
      className: 'Basic 4 Class',
      assignedStudentIds: ['student_demo'],
      dueDate: new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0],
      hasTeacherMarkedQuestions: false,
      createdAt: new Date().toISOString(),
      createdBy: 'GES Science Curriculum Lead',
    },
    {
      id: 'quiz_seed_b5_science_systems',
      kind: 'quiz',
      title: 'Basic 5 Science: Energy, Mixtures & Environment Quick Check',
      subject: 'Science',
      level: 'Basic 5',
      indicatorCodes: ['B5.1.2.1.1', 'B5.4.1.1.1', 'B5.5.4.1.1'],
      questionCount: 5,
      difficultyMix: { mode: 'balanced' },
      randomizePerStudent: true,
      assignmentTarget: 'class',
      className: 'Basic 5 Class',
      assignedStudentIds: ['student_demo'],
      dueDate: new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0],
      hasTeacherMarkedQuestions: false,
      createdAt: new Date().toISOString(),
      createdBy: 'GES Science Curriculum Lead',
    },
    {
      id: 'quiz_seed_b6_science_systems',
      kind: 'quiz',
      title: 'Basic 6 Science: Electricity, Solar System & Environment Quick Check',
      subject: 'Science',
      level: 'Basic 6',
      indicatorCodes: ['B6.3.2.1.1', 'B6.4.2.1.1', 'B6.5.4.1.1'],
      questionCount: 5,
      difficultyMix: { mode: 'balanced' },
      randomizePerStudent: true,
      assignmentTarget: 'class',
      className: 'Basic 6 Class',
      assignedStudentIds: ['student_demo'],
      dueDate: new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0],
      hasTeacherMarkedQuestions: false,
      createdAt: new Date().toISOString(),
      createdBy: 'GES Science Curriculum Lead',
    },
  ];
}

/**
 * Loads all saved quiz definitions.
 */
export function listQuizzes(): QuizDefinition[] {
  try {
    const raw = getStorage(QUIZZES_STORAGE_KEY);
    if (!raw) {
      const defaults = getDefaultSeededQuizzes();
      setStorage(QUIZZES_STORAGE_KEY, JSON.stringify(defaults));
      return defaults;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      const defaults = getDefaultSeededQuizzes();
      const existingIds = new Set(parsed.map((q: QuizDefinition) => q.id));
      const missingDefaults = defaults.filter((d) => !existingIds.has(d.id));
      if (missingDefaults.length > 0) {
        const merged = [...parsed, ...missingDefaults];
        setStorage(QUIZZES_STORAGE_KEY, JSON.stringify(merged));
        return merged;
      }
      return parsed;
    }
    const defaults = getDefaultSeededQuizzes();
    setStorage(QUIZZES_STORAGE_KEY, JSON.stringify(defaults));
    return defaults;
  } catch {
    return getDefaultSeededQuizzes();
  }
}

/**
 * Gets a quiz by ID.
 */
export function getQuizById(id: string): QuizDefinition | undefined {
  return listQuizzes().find((q) => q.id === id);
}

/**
 * Retrieves the test questions for a student.
 * If randomizePerStudent is true, questions are seeded by studentId.
 * RULE 2: Questions returned to student are SANITIZED (answer and explanation withheld).
 */
export function getStudentQuizQuestions(
  quiz: QuizDefinition,
  studentId: string,
  pool: NaccaQuestion[] = naccaQuestions,
): { questions: StudentNaccaQuestion[]; hasTeacherMarked: boolean } {
  let fullQuestions: NaccaQuestion[] = [];

  if (quiz.randomizePerStudent) {
    const eligible = getEligibleQuestions(quiz.subject, quiz.level, quiz.indicatorCodes, pool);
    fullQuestions = pickQuizQuestions(eligible, quiz.questionCount, quiz.difficultyMix, studentId);
  } else if (quiz.fixedQuestionIds && quiz.fixedQuestionIds.length > 0) {
    const idSet = new Set(quiz.fixedQuestionIds);
    fullQuestions = pool.filter((q) => idSet.has(q.id));
  } else {
    const eligible = getEligibleQuestions(quiz.subject, quiz.level, quiz.indicatorCodes, pool);
    fullQuestions = pickQuizQuestions(eligible, quiz.questionCount, quiz.difficultyMix);
  }

  const hasTeacherMarked = fullQuestions.some((q) =>
    ['written', 'oral', 'drawing', 'practical', 'role_play'].includes(q.type),
  );

  const sanitized = fullQuestions.map(sanitizeQuestionForStudent);
  return { questions: sanitized, hasTeacherMarked };
}

/**
 * Evaluates and saves a quiz submission.
 * - Auto-scored questions (mcq, numeric, short_answer) are graded immediately.
 * - If any question is teacher-marked, status is 'awaiting teacher marking'.
 * - RULE 4: Auto-score and teacher-score are strictly separated.
 */
export function submitQuiz(
  quiz: QuizDefinition,
  studentId: string,
  studentName: string,
  rawResponses: Record<
    string,
    {
      selectedOption?: number;
      numericInput?: string;
      shortAnswerInput?: string;
      writtenAnswer?: string;
      audioBlobUrl?: string;
      attachmentName?: string;
    }
  >,
  pool: NaccaQuestion[] = naccaQuestions,
): QuizSubmissionRecord {
  // Find canonical full questions for the student
  let fullQuestions: NaccaQuestion[] = [];
  if (quiz.randomizePerStudent) {
    const eligible = getEligibleQuestions(quiz.subject, quiz.level, quiz.indicatorCodes, pool);
    fullQuestions = pickQuizQuestions(eligible, quiz.questionCount, quiz.difficultyMix, studentId);
  } else if (quiz.fixedQuestionIds && quiz.fixedQuestionIds.length > 0) {
    const idSet = new Set(quiz.fixedQuestionIds);
    fullQuestions = pool.filter((q) => idSet.has(q.id));
  } else {
    const eligible = getEligibleQuestions(quiz.subject, quiz.level, quiz.indicatorCodes, pool);
    fullQuestions = pickQuizQuestions(eligible, quiz.questionCount, quiz.difficultyMix);
  }

  let autoPointsAwarded = 0;
  let autoPointsPossible = 0;
  let hasPendingTeacherMarking = false;

  const processedAnswers: QuizSubmissionAnswer[] = fullQuestions.map((q) => {
    const userResp = rawResponses[q.id] || {};
    const isAuto = ['mcq', 'numeric', 'short_answer'].includes(q.type);

    if (isAuto) {
      autoPointsPossible += 1;
      const evalRes = evaluateAnswer(q, userResp);
      const isCorrect = Boolean(evalRes.valid && evalRes.isCorrect);
      if (isCorrect) {
        autoPointsAwarded += 1;
      }

      return {
        questionId: q.id,
        type: q.type,
        difficulty: q.difficulty,
        selectedOption: userResp.selectedOption,
        numericInput: userResp.numericInput,
        shortAnswerInput: userResp.shortAnswerInput,
        isAutoScored: true,
        isCorrect,
        autoScore: isCorrect ? 1 : 0,
        autoFeedback: evalRes.feedback,
      };
    } else {
      // Teacher-marked type (written, oral, drawing, practical)
      hasPendingTeacherMarking = true;
      return {
        questionId: q.id,
        type: q.type,
        difficulty: q.difficulty,
        writtenAnswer: userResp.writtenAnswer,
        audioBlobUrl: userResp.audioBlobUrl,
        attachmentName: userResp.attachmentName,
        isAutoScored: false,
        teacherScore: undefined,
        teacherMaxScore: 10, // rubric default
        teacherComment: undefined,
      };
    }
  });

  const autoPercentage =
    autoPointsPossible > 0 ? Math.round((autoPointsAwarded / autoPointsPossible) * 100) : 100;

  const record: QuizSubmissionRecord = {
    id: `sub_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    quizId: quiz.id,
    quizTitle: quiz.title,
    kind: quiz.kind,
    studentId,
    studentName,
    submittedAt: new Date().toISOString(),
    status: hasPendingTeacherMarking ? 'awaiting teacher marking' : 'graded',
    autoScore: {
      pointsAwarded: autoPointsAwarded,
      pointsPossible: autoPointsPossible,
      percentage: autoPercentage,
    },
    teacherAssessed: {
      pointsAwarded: 0,
      pointsPossible: hasPendingTeacherMarking ? 10 : 0,
      percentage: 0,
      isPending: hasPendingTeacherMarking,
      status: hasPendingTeacherMarking ? 'awaiting marking' : 'none',
    },
    answers: processedAnswers,
  };

  const existingSubs = listQuizSubmissions();
  setStorage(SUBMISSIONS_STORAGE_KEY, JSON.stringify([record, ...existingSubs]));
  return record;
}

/**
 * Loads all quiz submissions, optionally filtered by studentId or quizId.
 */
export function listQuizSubmissions(filter?: {
  studentId?: string;
  quizId?: string;
}): QuizSubmissionRecord[] {
  try {
    const raw = getStorage(SUBMISSIONS_STORAGE_KEY);
    if (!raw) return [];
    let list: QuizSubmissionRecord[] = JSON.parse(raw);
    if (filter?.studentId) {
      list = list.filter((s) => s.studentId === filter.studentId);
    }
    if (filter?.quizId) {
      list = list.filter((s) => s.quizId === filter.quizId);
    }
    return list;
  } catch {
    return [];
  }
}
