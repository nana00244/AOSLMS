export interface QuestionAttemptLog {
  questionId: string;
  type: string;
  difficulty: number;
  isCorrect?: boolean;
  score?: number;
  feedback?: string;
  timestamp: string;
}

export interface PracticeSessionRecord {
  id: string;
  studentId: string;
  indicatorCode: string;
  subject: string;
  level: string;
  strand?: string;
  subStrand?: string;
  category: 'auto' | 'teacher'; // Rule 4: strictly separate auto vs teacher
  score: number; // 0 to 100
  correctCount: number;
  totalCount: number;
  questions: QuestionAttemptLog[];
  completedAt: string;
}

const STORAGE_KEY = 'nacca_student_practice_history';
const inMemoryStore = new Map<string, string>();

function getStorageItem(key: string): string | null {
  try {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(key);
    }
  } catch {
    // fallback
  }
  return inMemoryStore.get(key) || null;
}

function setStorageItem(key: string, val: string): void {
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
 * Loads all practice session records for a student.
 */
export function loadPracticeHistory(studentId = 'guest_student'): PracticeSessionRecord[] {
  try {
    const raw = getStorageItem(`${STORAGE_KEY}_${studentId}`);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

/**
 * Saves a new practice session attempt, preserving full history (allowing retakes).
 */
export function savePracticeAttempt(
  record: Omit<PracticeSessionRecord, 'id' | 'completedAt'> & { id?: string; completedAt?: string },
): PracticeSessionRecord {
  const fullRecord: PracticeSessionRecord = {
    ...record,
    id: record.id || `attempt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    completedAt: record.completedAt || new Date().toISOString(),
  };

  try {
    const existing = loadPracticeHistory(fullRecord.studentId);
    const updated = [fullRecord, ...existing];
    setStorageItem(`${STORAGE_KEY}_${fullRecord.studentId}`, JSON.stringify(updated));
  } catch (err) {
    console.error('Failed to save practice history:', err);
  }

  return fullRecord;
}

/**
 * Returns attempts filtered by indicator, separated by auto-scored vs teacher-marked.
 */
export function getIndicatorAttempts(
  indicatorCode: string,
  studentId = 'guest_student',
  subject?: string,
  level?: string,
) {
  const all = loadPracticeHistory(studentId).filter(
    (r) =>
      r.indicatorCode === indicatorCode &&
      (!subject || r.subject === subject) &&
      (!level || r.level === level),
  );
  return {
    autoMarked: all.filter((r) => r.category === 'auto'),
    teacherMarked: all.filter((r) => r.category === 'teacher'),
    allAttempts: all,
  };
}

/**
 * Clears attempt history for an indicator (useful for resetting practice during testing).
 */
export function resetIndicatorHistory(indicatorCode: string, studentId = 'guest_student') {
  try {
    const all = loadPracticeHistory(studentId).filter((r) => r.indicatorCode !== indicatorCode);
    setStorageItem(`${STORAGE_KEY}_${studentId}`, JSON.stringify(all));
  } catch (err) {
    console.error('Failed to reset indicator history:', err);
  }
}
