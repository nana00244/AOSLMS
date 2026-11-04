import { invokeBackend } from '../backend';
import type { HubLesson } from './catalog';
import type {
  HubAssignment,
  HubPracticeResult,
  HubReading,
  HubSnapshot,
  LearningLesson,
} from './types';

import { hubLessons } from './catalog';
import { naccaHubLessons } from './naccaBank';

export const loadHub = async (): Promise<HubSnapshot> => {
  let remote: HubSnapshot | null = null;
  try {
    remote = await invokeBackend('learning-hub', { action: 'load' });
  } catch {
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

  const baseLessons: LearningLesson[] = remote
    ? remote.lessons
    : hubLessons.map((l) => ({
        ...l,
        questions: l.questions.map((q) => ({
          id: q.id,
          prompt: q.prompt,
          options: q.options,
        })),
      }));

  // Ensure NaCCA curriculum lessons are always present alongside any remote lessons
  const seen = new Set<string>();
  const combinedLessons: LearningLesson[] = [];
  for (const l of [...naccaLessonsMapped, ...baseLessons]) {
    if (!seen.has(l.id)) {
      seen.add(l.id);
      combinedLessons.push(l);
    }
  }

  return {
    lessons: combinedLessons,
    assignments: remote?.assignments || [],
    attempts: remote?.attempts || [],
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
