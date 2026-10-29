import { invokeBackend } from '../backend';
import type { HubLesson } from './catalog';
import type {
  HubAssignment,
  HubPracticeResult,
  HubReading,
  HubSnapshot,
  LearningLesson,
} from './types';

export const loadHub = (): Promise<HubSnapshot> =>
  invokeBackend('learning-hub', { action: 'load' });
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
