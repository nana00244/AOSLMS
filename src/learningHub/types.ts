/** Original learning material mapped to the cited NaCCA curriculum; not an official textbook. */
export interface HubQuestion {
  id: string;
  prompt: string;
  options: string[];
  /** Zero-based correct option. Only trusted grading code should accept scores. */
  answer: number;
  explanation: string;
}
export interface HubLesson {
  id: string;
  title: string;
  subject: string;
  level: string;
  strand: string;
  standard: string;
  description: string;
  body: string[];
  sourceUrl: string;
  sourceTitle: string;
  questions: HubQuestion[];
  /** Includes typed responses and rubric activities opened in indicator practice. */
  practiceQuestionCount?: number;
}
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
