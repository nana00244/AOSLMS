import type { HubLesson } from './catalog';

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
  attempt: HubAttempt;
  feedback: { questionId: string; correct: boolean; answer: number; explanation: string }[];
}
