import { describe, expect, it } from 'vitest';
import {
  gradePractice,
  learnerLesson,
  lessonSchema,
  manages,
  requestSchema,
} from '../supabase/functions/learning-hub/rules';
import type { HubLesson } from './learningHub/catalog';
import type { User } from './data';

const lesson: HubLesson = {
  id: 'fractions',
  title: 'Fractions',
  subject: 'Mathematics',
  level: 'B7',
  strand: 'Number',
  standard: 'Fractions',
  description: 'Compare fractions.',
  body: ['Use common denominators.'],
  sourceUrl: 'https://nacca.gov.gh/',
  sourceTitle: 'NaCCA',
  questions: [
    {
      id: 'q1',
      prompt: '1/2 + 1/4 = ?',
      options: ['1/6', '3/4'],
      answer: 1,
      explanation: '2/4 + 1/4 = 3/4.',
    },
    {
      id: 'q2',
      prompt: 'Which equals 1/2?',
      options: ['2/4', '1/4'],
      answer: 0,
      explanation: 'Divide both parts by 2.',
    },
  ],
};
const teacher: User = {
  id: 't',
  name: 'Teacher',
  email: 't@example.com',
  role: 'Teacher',
  active: true,
  classes: ['B7', 'B8'],
  classAllowedSubjects: { B8: ['sub_math'] },
};

describe('Learning Hub authorization and grading', () => {
  it('uses current class and subject scope and rejects inactive profiles', () => {
    expect(manages(teacher, 'B7', 'Science')).toBe(true);
    expect(manages(teacher, 'B8', 'Mathematics')).toBe(true);
    expect(manages(teacher, 'B8', 'Science')).toBe(false);
    expect(manages(teacher, 'B9', 'Mathematics')).toBe(false);
    expect(manages({ ...teacher, active: false }, 'B7', 'Mathematics')).toBe(false);
    expect(manages({ ...teacher, role: 'Student' }, 'B7', 'Mathematics')).toBe(false);
    expect(manages({ ...teacher, role: 'Administrator' }, 'B9', 'Mathematics')).toBe(true);
  });
  it('scores each submitted answer and supplies instructional feedback', () => {
    const result = gradePractice(lesson, [1, 1]);
    expect(result.score).toBe(50);
    expect(result.correct).toBe(1);
    expect(result.total).toBe(2);
    expect(result.feedback[1]).toMatchObject({ correct: false, answer: 0 });
    expect(gradePractice(lesson, [1, 0]).score).toBe(100);
    expect(() => gradePractice(lesson, [1])).toThrow('Answer every question');
    expect(() => gradePractice(lesson, [1, 5])).toThrow('valid answer');
    expect(() => gradePractice({ ...lesson, questions: [] }, [])).toThrow('no practice');
  });
  it('does not reveal keys or explanations before submission', () => {
    const visible = learnerLesson(lesson);
    expect(visible.questions[0]).toEqual({
      id: 'q1',
      prompt: '1/2 + 1/4 = ?',
      options: ['1/6', '3/4'],
    });
    expect(lesson.questions[0].answer).toBe(1);
  });
  it('rejects fabricated student identities/scores and invalid dates', () => {
    const input = { action: 'submit-practice', lessonId: 'fractions', answers: [1, 0] };
    expect(requestSchema.safeParse(input).success).toBe(true);
    expect(requestSchema.safeParse({ ...input, studentId: 'someone-else' }).success).toBe(false);
    expect(requestSchema.safeParse({ ...input, score: 100 }).success).toBe(false);
    expect(
      requestSchema.safeParse({
        action: 'assign',
        lessonId: 'fractions',
        classId: 'B7',
        dueDate: '2026-02-30',
      }).success,
    ).toBe(false);
    expect(
      requestSchema.safeParse({
        action: 'assign',
        lessonId: 'fractions',
        classId: 'B7',
        dueDate: '2026-11-01',
        studentIds: [],
      }).success,
    ).toBe(false);
  });
  it('validates original lesson keys and safe source URLs', () => {
    const { id: _id, ...input } = lesson;
    expect(lessonSchema.safeParse(input).success).toBe(true);
    expect(lessonSchema.safeParse({ ...input, sourceUrl: 'javascript:alert(1)' }).success).toBe(
      false,
    );
    expect(
      lessonSchema.safeParse({ ...input, questions: [{ ...lesson.questions[0], answer: 5 }] })
        .success,
    ).toBe(false);
    expect(
      lessonSchema.safeParse({ ...input, questions: [lesson.questions[0], lesson.questions[0]] })
        .success,
    ).toBe(false);
  });
});
