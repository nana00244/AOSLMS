import type { HubLesson } from './catalog';
import type { PracticeKind, MasteryLevel, QuestionOutcome } from './questionBank';

export type LearningLesson = Omit<HubLesson, 'questions'> & {
  questions: (Omit<HubLesson['questions'][number], 'answer' | 'explanation'> & {
    answer?: number;
    explanation?: string;
  })[];
};
export interface HubAssignment {
  id: string;
  lessonId: string;
  classId: string;
  studentIds: string[];
  dueDate: string;
  createdBy: string;
  createdAt: string;
}
export interface HubAttempt {
  kind?: PracticeKind | 'legacy';
  outcomes?: QuestionOutcome[];
  id: string;
  lessonId: string;
  studentId: string;
  assignmentId: string | null;
  score: number;
  correct: number;
  total: number;
  createdAt: string;
}
export interface HubReading {
  id: string;
  lessonId: string;
  studentId: string;
  assignmentId: string | null;
  createdAt: string;
}
export interface HubSnapshot {
  lessons: LearningLesson[];
  assignments: HubAssignment[];
  attempts: HubAttempt[];
  readings: HubReading[];
}
export interface HubPracticeResult {
  mastery?: { before: MasteryLevel; after: MasteryLevel; upgraded: boolean };
  attempt: HubAttempt;
  feedback: { questionId: string; correct: boolean; answer: number; explanation: string }[];
}
export interface PracticeSession {
  id: string;
  kind: PracticeKind;
  lessonId: string;
  assignmentId: string | null;
  expiresAt: string;
  questions: { id: string; lessonId: string; prompt: string; options: string[] }[];
}
