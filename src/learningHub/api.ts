import { invokeBackend } from '../backend';
import type { HubLesson } from './catalog';
import type { PracticeKind } from './questionBank';
import type { PracticeSession } from './types';
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
export const startHubPractice = (
  lessonId: string,
  kind: PracticeKind,
  requestId: string,
  assignmentId?: string,
): Promise<PracticeSession> =>
  invokeBackend('learning-hub', {
    action: 'start-practice',
    lessonId,
    kind,
    requestId,
    assignmentId,
  });
export const submitHubSession = (
  lessonId: string,
  sessionId: string,
  answers: number[],
  assignmentId?: string,
): Promise<HubPracticeResult> =>
  invokeBackend('learning-hub', {
    action: 'submit-session',
    lessonId,
    sessionId,
    answers,
    assignmentId,
  });
