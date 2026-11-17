import { describe, expect, it } from 'vitest';
import grading from '../../supabase/functions/learning-hub/adaptive-bank.json';
import { canTeach } from '../backendAccess';
import type { User } from '../data';
import { computingIndicators, computingQuestions } from './computingBank';
import { indicatorLessonId } from './indicatorLessonId';
import { naccaHubLessons, naccaLevels, naccaSubjects } from './naccaBank';
import { getLessonPracticeIndicator } from './practiceNavigation';

const keys = new Map(
  grading.questions.filter((q) => q.subject === 'Computing').map((q) => [q.id, q]),
);
const serverLessons = new Set(
  grading.indicators.filter((i) => i.subject === 'Computing').map((i) => i.code),
);
const auto = new Set(['mcq', 'short_answer', 'numeric']);

describe('upper-primary Computing', () => {
  it('makes all printed objectives separately discoverable in courses and practice', () => {
    expect(naccaSubjects.filter((s) => s.name === 'Computing')).toHaveLength(1);
    for (const [i, count] of [27, 82, 99].entries()) {
      const level = 'Basic ' + (i + 4);
      expect(naccaLevels.some((l) => l.name === level)).toBe(true);
      const lessons = naccaHubLessons.filter((l) => l.subject === 'Computing' && l.level === level);
      expect(lessons).toHaveLength(count);
      for (const lesson of lessons) {
        const indicator = getLessonPracticeIndicator(lesson);
        expect(indicator?.subject).toBe('Computing');
        expect(serverLessons.has(indicator!.code)).toBe(true);
        expect(indicatorLessonId('Computing', indicator!.code)).toBe(lesson.id);
      }
    }
    expect(new Set(computingIndicators.map((i) => i.code)).size).toBe(208);
    expect(computingIndicators.filter((i) => i.code.startsWith('B6.1.1.1.3'))).toHaveLength(2);
    expect(new Set(computingQuestions.map((q) => q.id)).size).toBe(4160);
  });

  it('preserves skills, difficulty, rubrics, and server scoring for each indicator', () => {
    for (const i of computingIndicators) {
      const qs = computingQuestions.filter((q) => q.indicator_code === i.code);
      expect(qs, i.code).toHaveLength(20);
      expect(new Set(qs.map((q) => q.stem.trim().toLowerCase())).size, i.code).toBe(20);
      expect(
        [1, 2, 3, 4].map((d) => qs.filter((q) => q.difficulty === d).length),
        i.code,
      ).toEqual([5, 7, 5, 3]);
      const skills = i.spec?.skills ?? [];
      for (const s of skills) {
        expect(s.minQuestions).toBeGreaterThanOrEqual(2);
        expect(qs.filter((q) => q.skill_tag === s.tag).length, i.code).toBeGreaterThanOrEqual(
          s.minQuestions!,
        );
      }
      for (const q of qs) {
        expect(
          skills.some((s) => s.tag === q.skill_tag),
          q.id,
        ).toBe(true);
        expect(q.hints.length, q.id).toBeGreaterThan(0);
        expect(q.explanation?.trim(), q.id).toBeTruthy();
        if (auto.has(q.type)) {
          expect(keys.get(q.id), q.id).toMatchObject({
            subject: q.subject,
            indicator_code: i.code,
            type: q.type,
            answer: q.answer,
          });
          if (q.type === 'mcq') {
            expect(q.options, q.id).toHaveLength(4);
            expect(new Set(q.options!.map((s) => s.trim().toLowerCase())).size).toBe(4);
            expect(q.options![Number(q.answer)]).toBeTruthy();
          }
        } else {
          expect(keys.has(q.id)).toBe(false);
          expect(q.answer).toBeUndefined();
          expect(q.rubric?.criteria.length, q.id).toBeGreaterThan(0);
        }
      }
    }
  });

  it('honours Computing / ICT teaching access when assigning Computing', () => {
    const teacher = {
      role: 'Teacher',
      classes: ['Basic 4'],
      classAllowedSubjects: { 'Basic 4': ['sub_ict'] },
    } as unknown as User;
    expect(canTeach(teacher, 'Basic 4', 'Computing')).toBe(true);
    expect(canTeach(teacher, 'Basic 4', 'Mathematics')).toBe(false);
    expect(canTeach(teacher, 'Basic 5', 'Computing')).toBe(false);
  });
});
