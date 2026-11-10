import { loadPracticeHistory, type PracticeSessionRecord } from '../nacca/practiceHistory';
import { indicatorLessonId } from './indicatorLessonId';
import { invokeBackend } from '../backend';
import type { HubLesson } from './catalog';
import type {
  HubAssignment,
  HubAttempt,
  HubPracticeResult,
  HubReading,
  HubSnapshot,
  LearningLesson,
} from './types';

import { hubLessons } from './catalog';
import { naccaHubLessons } from './naccaBank';

export function localHubAttempt(record: PracticeSessionRecord): HubAttempt {
  return {
    id: record.id,
    lessonId: indicatorLessonId(record.subject, record.indicatorCode),
    studentId: record.studentId,
    assignmentId: record.assignmentId ?? null,
    score: record.score,
    correct: record.correctCount,
    total: record.totalCount,
    createdAt: record.completedAt,
  };
}

export function submitAdaptive(record: PracticeSessionRecord): Promise<HubAttempt> {
  return invokeBackend('learning-hub', {
    action: 'submit-adaptive',
    attemptId: record.id,
    completedAt: record.completedAt,
    lessonId: indicatorLessonId(record.subject, record.indicatorCode),
    assignmentId: record.assignmentId,
    responses: record.questions.map((q) => ({ questionId: q.questionId, ...q.response })),
  });
}

export const loadHub = async (studentId?: string, background = false): Promise<HubSnapshot> => {
  let remote: HubSnapshot | null = null;
  try {
    remote = await invokeBackend('learning-hub', { action: 'load' });
  } catch (error) {
    if (background) throw error;
    // Backend offline / local fallback
  }

  const naccaLessonsMapped: LearningLesson[] = naccaHubLessons.map((l) => ({
    ...l,
    questions: l.questions.map((q) => ({
      id: q.id,
      prompt: q.prompt,
      options: q.options,
    })),
  }));

  const catalogLessons: LearningLesson[] = hubLessons.map((l) => ({
    ...l,
    questions: l.questions.map((q) => ({
      id: q.id,
      prompt: q.prompt,
      options: q.options,
    })),
  }));
  const remoteLessons = remote?.lessons ?? [];

  // Prefer curated catalog lessons when generated indicator entries share the same ID.
  const seen = new Set<string>();
  const combinedLessons: LearningLesson[] = [];
  for (const l of [...catalogLessons, ...naccaLessonsMapped, ...remoteLessons]) {
    if (!seen.has(l.id)) {
      seen.add(l.id);
      combinedLessons.push(l);
    }
  }

  const attempts = new Map((remote?.attempts ?? []).map((a) => [a.id, a]));
  if (studentId) {
    for (const record of loadPracticeHistory(studentId)) {
      if (record.studentId !== studentId || record.category !== 'auto' || attempts.has(record.id))
        continue;
      attempts.set(record.id, localHubAttempt(record));
      // Older records have totals only. Keep them on the originating device.
      if (
        remote &&
        record.questions.length &&
        record.questions.every((q) => q.response !== undefined)
      ) {
        try {
          attempts.set(record.id, await submitAdaptive(record));
        } catch {
          // The local history is the retry queue. A later load will retry this same ID.
        }
      }
    }
  }
  return {
    lessons: combinedLessons,
    assignments: remote?.assignments || [],
    attempts: [...attempts.values()],
    readings: remote?.readings || [],
  };
};
export const createHubLesson = (lesson: Omit<HubLesson, 'id'>): Promise<LearningLesson> =>
  invokeBackend('learning-hub', { action: 'create-lesson', lesson });
export const assignHubLesson = (assignment: {
  lessonId: string;
  classId: string;
  studentIds?: string[];
  dueDate: string;
}): Promise<HubAssignment> => invokeBackend('learning-hub', { action: 'assign', ...assignment });
export const completeHubReading = (lessonId: string, assignmentId?: string): Promise<HubReading> =>
  invokeBackend('learning-hub', { action: 'complete-reading', lessonId, assignmentId });
export const submitHubPractice = (
  lessonId: string,
  answers: number[],
  assignmentId?: string,
): Promise<HubPracticeResult> =>
  invokeBackend('learning-hub', { action: 'submit-practice', lessonId, answers, assignmentId });
