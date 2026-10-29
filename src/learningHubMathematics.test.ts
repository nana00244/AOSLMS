import { describe, expect, it } from 'vitest';
import {
  generatedMathematicsLessons as lessons,
  mathematicsIndicatorCoverage,
} from './learningHub/generated/mathematics';

describe('Indicator-linked mathematics accuracy', () => {
  it('checks counting, arithmetic, missing quantities and multiplication independently from generated feedback', () => {
    let checked = 0;
    for (const lesson of lessons)
      for (const q of lesson.questions) {
        const answer = Number(q.options[q.answer]);
        const counting = q.prompt.match(
          /^Count (forwards|backwards) by (\d+): (\d+), (\d+), __, (\d+)\./,
        );
        if (counting) {
          const [, direction, step, first, second, last] = counting;
          const delta = +step * (direction === 'forwards' ? 1 : -1);
          expect(+second).toBe(+first + delta);
          expect(answer).toBe(+second + delta);
          expect(+last).toBe(answer + delta);
          checked++;
        }
        const basic = q.prompt.match(/^Find (\d+) ([+−×]) (\d+)\.$/);
        if (basic) {
          const [, a, operator, b] = basic;
          expect(answer).toBe(operator === '+' ? +a + +b : operator === '−' ? +a - +b : +a * +b);
          checked++;
        }
        const missing = q.prompt.match(/^Fill the gap: (\d+) \+ __ = (\d+)\.$/);
        if (missing) {
          expect(+missing[1] + answer).toBe(+missing[2]);
          checked++;
        }
        const story = q.prompt.match(/^A class has (\d+) counters\. It puts (\d+) counters away/);
        if (story) {
          expect(answer).toBe(+story[1] - +story[2]);
          checked++;
        }
        const array = q.prompt.match(/^There are (\d+) rows of (\d+) beads/);
        if (array) {
          expect(answer).toBe(+array[1] * +array[2]);
          checked++;
        }
        const factor = q.prompt.match(/^Find the missing factor: (\d+) × __ = (\d+)\.$/);
        if (factor) {
          expect(answer * +factor[1]).toBe(+factor[2]);
          checked++;
        }
        const mental = q.prompt.match(/find (\d+) × (\d+)\.$/);
        if (mental) {
          expect(answer).toBe(+mental[1] * +mental[2]);
          checked++;
        }
      }
    expect(checked).toBe(416);
  });
  it('checks decimals, signed substitutions and equation solutions', () => {
    let checked = 0;
    for (const lesson of lessons)
      for (const q of lesson.questions) {
        const answer = Number(q.options[q.answer]);
        const power = q.prompt.match(/^Calculate ([\d.]+) ([×÷]) (\d+)\.$/);
        if (power) {
          expect(answer).toBeCloseTo(
            power[2] === '×' ? +power[1] * +power[3] : +power[1] / +power[3],
            6,
          );
          checked++;
        }
        const linear = q.prompt.match(/^Evaluate (\d+)x \+ (\d+) when x = (-?\d+)\.$/);
        if (linear) {
          expect(answer).toBe(+linear[1] * +linear[3] + +linear[2]);
          checked++;
        }
        const square = q.prompt.match(/^Evaluate (\d+)x² \+ (\d+) when x = (-?\d+)\.$/);
        if (square) {
          expect(answer).toBe(+square[1] * (+square[3]) ** 2 + +square[2]);
          checked++;
        }
        const fraction = q.prompt.match(/^Evaluate \((\d+)x \+ (\d+)\)\/(\d+) when x = (-?\d+)\.$/);
        if (fraction) {
          expect(answer).toBe((+fraction[1] * +fraction[4] + +fraction[2]) / +fraction[3]);
          checked++;
        }
        const equation = q.prompt.match(/^Solve (\d+)x \+ (\d+) = (-?\d+)\./);
        if (equation) {
          expect(+equation[1] * answer + +equation[2]).toBe(+equation[3]);
          checked++;
        }
      }
    expect(checked).toBe(192);
  });
  it('checks unit rates, discount amounts and simple interest', () => {
    let checked = 0;
    for (const lesson of lessons)
      for (const q of lesson.questions) {
        const answer = Number(q.options[q.answer]);
        const price = q.prompt.match(/^(\d+) identical exercise books cost GH₵(\d+)/);
        if (price) {
          expect(answer * +price[1]).toBe(+price[2]);
          checked++;
        }
        const speed = q.prompt.match(/^A cyclist travels (\d+) km in (\d+) hours/);
        if (speed) {
          expect(answer * +speed[2]).toBe(+speed[1]);
          checked++;
        }
        const discount = q.prompt.match(/^A bag costs GH₵(\d+)\. A (\d+)% discount/);
        if (discount) {
          expect(answer).toBe((+discount[1] * (100 - +discount[2])) / 100);
          checked++;
        }
        const interest = q.prompt.match(
          /^In a simple-interest exercise, GH₵(\d+) earns (\d+)% per year for (\d+) years/,
        );
        if (interest) {
          expect(answer).toBe((+interest[1] * +interest[2] * +interest[3]) / 100);
          checked++;
        }
      }
    expect(checked).toBe(64);
  });
  it('keeps lower-primary calculation quantities within stated indicator limits', () => {
    const limits: Record<string, number> = {
      'B1.1.2.1.1': 20,
      'B2.1.2.1.1': 100,
      'B3.1.2.1.1': 1000,
    };
    for (const lesson of lessons.filter((l) => limits[l.standard]))
      for (const q of lesson.questions) {
        for (const n of q.prompt.match(/\d+/g) || [])
          expect(+n).toBeLessThanOrEqual(limits[lesson.standard]);
        for (const option of q.options) expect(Number(option)).toBeGreaterThanOrEqual(0);
      }
    expect(lessons.find((l) => l.standard === 'B1.1.2.1.1')!.body.join(' ')).not.toContain('37');
    for (const q of lessons.find((l) => l.standard === 'B8.1.2.2.1')!.questions) {
      expect(Math.max(...(q.prompt.match(/\d+/g) || []).map(Number))).toBeGreaterThanOrEqual(10000);
    }
  });
  it('reports partial indicator facets honestly and has source pages for all nine grade levels', () => {
    expect(new Set(lessons.map((l) => l.level)).size).toBe(9);
    expect(mathematicsIndicatorCoverage).toHaveLength(lessons.length);
    for (const coverage of mathematicsIndicatorCoverage) {
      expect(coverage.coverage).toBe('partial-indicator');
      const lesson = lessons.find((l) => l.standard === coverage.indicator)!;
      expect(lesson.sourceTitle).toContain(`PDF page ${coverage.page}`);
      expect(lesson.questions).toHaveLength(coverage.questionCount);
    }
  });
});
