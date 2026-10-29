import { describe, expect, it } from 'vitest';
import { generatedMathematicsLessons } from './learningHub/generated/mathematics';
import { livingCellLessons } from './learningHub/generated/livingCells';
import { drawQuestions } from './learningHub/questionBank';

describe('Original indicator question banks', () => {
  it('provides distinct valid choices and at least sixteen different situations for each included indicator', () => {
    for (const lesson of [...generatedMathematicsLessons, ...livingCellLessons]) {
      expect(lesson.standard).toMatch(/^B[1-9](?:\.\d+){4}$/);
      expect(lesson.questions.length).toBeGreaterThanOrEqual(16);
      const signatures = lesson.questions.map(
        (q) => `${q.prompt}|${[...q.options].sort().join('|')}`,
      );
      expect(new Set(signatures).size, lesson.standard).toBe(signatures.length);
      for (const q of lesson.questions) {
        expect(new Set(q.options).size, `${lesson.standard}/${q.id}`).toBe(4);
        expect(q.options[q.answer]).toBeTruthy();
        expect(q.explanation.length).toBeGreaterThan(25);
      }
    }
  });
  it('keeps generated comparison and rounding answer keys correct', () => {
    for (const lesson of generatedMathematicsLessons)
      for (const q of lesson.questions) {
        const answer = q.options[q.answer];
        if (q.prompt === 'Which comparison is correct?') {
          const [, a, sign, b] = answer.match(/^(\d+) ([<>=]) (\d+)$/)!;
          expect(sign === '<' ? +a < +b : sign === '>' ? +a > +b : +a === +b).toBe(true);
        }
        const round = q.prompt.match(/^Round (\d+) to the nearest (\d+)\.$/);
        if (q.prompt.startsWith('Round ')) {
          expect(round).not.toBeNull();
          expect(Number(answer)).toBe(
            Math.round(Number(round![1]) / Number(round![2])) * Number(round![2]),
          );
        }
        const root = q.prompt.match(/^Simplify √(\d+)\.$/);
        if (root) {
          const [, coefficient, radicand] = answer.match(/^(\d+)√(\d+)$/)!;
          expect(Number(coefficient) ** 2 * Number(radicand)).toBe(Number(root[1]));
          for (const wrong of q.options.filter((_, i) => i !== q.answer)) {
            const [, c, r] = wrong.match(/^(\d+)√(\d+)$/)!;
            expect(Number(c) ** 2 * Number(r)).not.toBe(Number(root[1]));
          }
        }
      }
  });
  it('can serve four unseen practice sets from each new bank', () => {
    for (const lesson of [...generatedMathematicsLessons, ...livingCellLessons]) {
      const served: string[] = [];
      for (let i = 0; i < 4; i++) {
        const questions = drawQuestions(lesson, [lesson], 'practice', [], served);
        expect(questions).toHaveLength(4);
        expect(questions.every((q) => !served.includes(q.id))).toBe(true);
        served.push(...questions.map((q) => q.id));
      }
    }
  });
});
