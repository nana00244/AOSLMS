import { z } from 'zod';
import { canTeach } from '../../../src/backendAccess.ts';
import type { User } from '../../../src/data.ts';
import type { HubLesson } from '../../../src/learningHub/catalog.ts';

const text = (max: number) => z.string().trim().min(1).max(max);
const questionSchema = z
  .object({
    id: text(100),
    prompt: text(2000),
    options: z.array(text(1000)).min(2).max(6),
    answer: z.number().int().min(0).max(5),
    explanation: text(2000),
  })
  .strict()
  .refine((q) => q.answer < q.options.length, 'Answer must identify an option');
export const lessonSchema = z
  .object({
    title: text(200),
    subject: text(100),
    level: text(40),
    strand: text(200),
    standard: text(300),
    description: text(2000),
    body: z.array(text(10000)).min(1).max(40),
    sourceUrl: z
      .string()
      .url()
      .max(2000)
      .refine((url) => {
        const value = new URL(url);
        return value.protocol === 'https:' && !value.username && !value.password;
      }, 'Use an HTTPS curriculum source URL'),
    sourceTitle: text(200),
    questions: z.array(questionSchema).max(30),
  })
  .strict()
  .refine(
    (l) => new Set(l.questions.map((q) => q.id)).size === l.questions.length,
    'Question identifiers must be unique',
  );
const activity = { lessonId: text(150), assignmentId: z.string().uuid().optional() };
export const requestSchema = z.discriminatedUnion('action', [
  z
    .object({
      action: z.literal('start-practice'),
      ...activity,
      kind: z.enum(['practice', 'quiz', 'unit-test']),
      requestId: z.string().uuid(),
    })
    .strict(),
  z
    .object({
      action: z.literal('submit-session'),
      ...activity,
      sessionId: z.string().uuid(),
      answers: z.array(z.number().int().min(0).max(5)).min(1).max(10),
    })
    .strict(),
  z.object({ action: z.literal('load') }).strict(),
  z.object({ action: z.literal('create-lesson'), lesson: lessonSchema }).strict(),
  z
    .object({
      action: z.literal('assign'),
      lessonId: text(150),
      classId: text(150),
      studentIds: z.array(text(150)).min(1).max(2000).optional(),
      dueDate: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .refine((v) => {
          const date = new Date(`${v}T00:00:00Z`);
          return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === v;
        }, 'Choose a valid due date'),
    })
    .strict(),
  z.object({ action: z.literal('complete-reading'), ...activity }).strict(),
  z
    .object({
      action: z.literal('submit-practice'),
      ...activity,
      answers: z.array(z.number().int().min(0).max(5)).min(1).max(30),
    })
    .strict(),
]);
export function profileUser(p: any): User {
  return {
    id: p.id,
    name: p.full_name,
    email: p.email,
    role: p.role,
    active: p.active,
    classes: p.classes || [],
    classAllowedSubjects: p.class_allowed_subjects || {},
    studentId: p.student_id || undefined,
  };
}
export function manages(user: User, classId: string, subject: string): boolean {
  return user.active && (user.role === 'Administrator' || canTeach(user, classId, subject));
}
export function gradePractice(lesson: HubLesson, answers: number[]) {
  if (!lesson.questions.length) throw new Error('This lesson has no practice questions');
  if (answers.length !== lesson.questions.length) throw new Error('Answer every question');
  const feedback = lesson.questions.map((q, i) => {
    if (!Number.isInteger(answers[i]) || answers[i] < 0 || answers[i] >= q.options.length)
      throw new Error('Choose a valid answer for every question');
    return {
      questionId: q.id,
      correct: answers[i] === q.answer,
      answer: q.answer,
      explanation: q.explanation,
    };
  });
  const correct = feedback.filter((f) => f.correct).length;
  return {
    correct,
    total: feedback.length,
    score: Math.round((correct / feedback.length) * 100),
    feedback,
  };
}
export function learnerLesson(lesson: HubLesson) {
  return {
    ...lesson,
    questions: lesson.questions.map(({ id, prompt, options }) => ({ id, prompt, options })),
  };
}
