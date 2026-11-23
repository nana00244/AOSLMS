import { describe, expect, it } from 'vitest';
import grading from '../../supabase/functions/learning-hub/adaptive-bank.json';
import { canTeach } from '../backendAccess';
import type { User } from '../data';
import { computingIndicators, computingQuestions } from './computingBank';
import { historyIndicators, historyQuestions } from './historyBank';
import { creativeArtsIndicators, creativeArtsQuestions, rmeIndicators, rmeQuestions } from './primaryCurriculumBank';
import { currentPracticeCode, indicatorLessonId } from './indicatorLessonId';
import { naccaHubLessons, naccaLevels, naccaSubjects } from './naccaBank';
import { getLessonPracticeIndicator } from './practiceNavigation';

const keys = new Map(grading.questions.map((q) => [q.id, q]));
const serverLessons = new Set(grading.indicators.map((i) => indicatorLessonId(i.subject, i.code)));
const auto = new Set(['mcq', 'short_answer', 'numeric']);

describe.each([
  {
    subject: 'Creative Arts',
    firstGrade: 1,
    counts: [42, 42, 40, 48, 48, 49],
    indicators: creativeArtsIndicators,
    questions: creativeArtsQuestions,
    subjectId: 'sub_cad',
  },
  {
    subject: 'Religious and Moral Education',
    firstGrade: 1,
    counts: [9, 13, 14, 13, 15, 14],
    indicators: rmeIndicators,
    questions: rmeQuestions,
    subjectId: 'sub_rme',
  },
  {
    subject: 'Computing',
    firstGrade: 4,
    counts: [27, 82, 99],
    indicators: computingIndicators,
    questions: computingQuestions,
    subjectId: 'sub_ict',
  },
  {
    subject: 'History',
    firstGrade: 1,
    counts: [8, 5, 7, 11, 13, 9],
    indicators: historyIndicators,
    questions: historyQuestions,
    subjectId: 'sub_hist',
  },
])(
  '$subject curriculum bank',
  ({ subject, firstGrade, counts, indicators, questions, subjectId }) => {
    it('makes all printed objectives separately discoverable in courses and practice', () => {
      expect(naccaSubjects.filter((s) => s.name === subject)).toHaveLength(1);
      for (const [i, count] of counts.entries()) {
        const level = 'Basic ' + (i + firstGrade);
        expect(naccaLevels.some((l) => l.name === level)).toBe(true);
        const lessons = naccaHubLessons.filter((l) => l.subject === subject && l.level === level);
        expect(lessons).toHaveLength(count);
        for (const lesson of lessons) {
          const indicator = getLessonPracticeIndicator(lesson);
          expect(indicator?.subject).toBe(subject);
          expect(serverLessons.has(lesson.id)).toBe(true);
          expect(indicatorLessonId(subject, indicator!.code)).toBe(lesson.id);
        }
      }
      const entries = counts.reduce((sum, n) => sum + n, 0);
      expect(new Set(indicators.map((i) => i.code)).size).toBe(entries);
      expect(new Set(questions.map((q) => q.id)).size).toBe(20 * entries);
    });

    it('preserves skills, difficulty, rubrics, and server scoring for each indicator', () => {
      for (const i of indicators) {
        const qs = questions.filter((q) => q.indicator_code === i.code);
        expect(qs, i.code).toHaveLength(20);
        if (subject === 'Creative Arts') {
          expect(qs.filter((q) => q.type === 'mcq'), i.code).toHaveLength(19);
          expect(i.source_page, i.code).toBeGreaterThan(0);
        }
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

    it('honours subject-specific teaching access', () => {
      const teacher = {
        role: 'Teacher',
        classes: ['Basic 4'],
        classAllowedSubjects: { 'Basic 4': [subjectId] },
      } as unknown as User;
      expect(canTeach(teacher, 'Basic 4', subject)).toBe(true);
      expect(canTeach(teacher, 'Basic 4', 'Mathematics')).toBe(false);
      expect(canTeach(teacher, 'Basic 5', subject)).toBe(false);
    });
  },
);

it('keeps repeated printed codes distinct and honours curriculum section placement', () => {
  for (const [current, previous] of [
    ['B4.2.4.7.2 (Topical issues)', 'B4.2.4.7.3'],
    ['B3.1.1.1.1', 'B3.VA.1*'],
  ]) {
    expect(creativeArtsIndicators.some((indicator) => indicator.code === current)).toBe(true);
    expect(currentPracticeCode('Creative Arts', previous)).toBe(current);
    expect(indicatorLessonId('Creative Arts', current)).toBe(indicatorLessonId('Creative Arts', previous));
  }
  expect(creativeArtsIndicators.filter((i) => i.code.startsWith('B6.2.3.4.2'))).toHaveLength(2);
  expect(computingIndicators.filter((i) => i.code.startsWith('B6.1.1.1.3'))).toHaveLength(2);
  expect(historyIndicators.filter((i) => i.code.startsWith('B2.2.1.1.1'))).toHaveLength(2);
  expect(historyIndicators.find((i) => i.code === 'B4.5.3.1.2')?.level).toBe('Basic 5');
});

it('shows source limitations alongside the History lesson', () => {
  for (const indicator of historyIndicators) {
    const lesson = naccaHubLessons.find(
      (item) => item.id === indicatorLessonId(indicator.subject, indicator.code),
    )!;
    for (const note of indicator.sourceNotes ?? []) {
      expect(lesson.body.join('\n')).toContain(note);
    }
  }
});
