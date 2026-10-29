import { describe, expect, it } from 'vitest';
import type { HubLesson } from './learningHub/catalog';
import {
  assessmentLessons,
  drawQuestions,
  gradeSession,
  masteryForLesson,
  reviewQueue,
  setSizes,
  shuffle,
  type PracticeHistory,
  type PracticeKind,
} from './learningHub/questionBank';

const now = new Date('2026-11-10T12:00:00Z');
const random = () => 0.25;
function topic(id: string, overrides: Partial<HubLesson> = {}): HubLesson {
  return {
    id,
    title: id,
    subject: 'Mathematics',
    level: 'B4',
    strand: 'Number',
    standard: 'B4.1.1.1',
    description: 'Fixture',
    body: ['Fixture'],
    sourceUrl: 'https://nacca.gov.gh/',
    sourceTitle: 'Fixture',
    questions: Array.from({ length: 12 }, (_, i) => ({
      id: `q${i}`,
      prompt: `${id} question ${i}`,
      options: [`correct-${i}`, `other-${i}`, `third-${i}`, `fourth-${i}`],
      answer: 0,
      explanation: `Reason for ${i}`,
    })),
    ...overrides,
  };
}
const first = topic('first'),
  second = topic('second'),
  third = topic('third');
function history(
  kind: PracticeKind,
  score: number,
  correct: number,
  total: number,
  lessonId = 'first',
  createdAt = '2026-11-09T10:00:00Z',
): PracticeHistory {
  return {
    kind,
    score,
    total,
    createdAt,
    outcomes: Array.from({ length: total }, (_, i) => ({
      questionId: `${lessonId}::q${i}`,
      lessonId,
      correct: i < correct,
    })),
  };
}

describe('randomized Learning Hub question bank', () => {
  it('orders quiz prerequisites by numeric curriculum code rather than catalogue insertion', () => {
    const early = topic('early', { standard: 'B4.1.1.1.2' });
    const anchor = topic('anchor', { standard: 'B4.1.1.1.3' });
    const later = topic('later', { standard: 'B4.1.1.1.10' });
    expect(assessmentLessons(anchor, [later, anchor, early], 'quiz').map((l) => l.id)).toEqual([
      'early',
      'anchor',
    ]);
  });
  it.each<PracticeKind>(['practice', 'quiz', 'unit-test'])(
    'draws the exact unique %s size',
    (kind) => {
      const selected = drawQuestions(second, [first, second, third], kind, [], [], now, random);
      expect(selected).toHaveLength(setSizes[kind]);
      expect(new Set(selected.map((q) => q.id)).size).toBe(setSizes[kind]);
    },
  );
  it('exhausts unseen questions before successful repeats, including served unfinished sets', () => {
    const completed = history('practice', 100, 4, 4);
    const served = ['first::q4', 'first::q5', 'first::q6', 'first::q7'];
    const selected = drawQuestions(first, [first], 'practice', [completed], served, now, random);
    expect(new Set(selected.map((q) => q.id))).toEqual(
      new Set(['first::q8', 'first::q9', 'first::q10', 'first::q11']),
    );
    const repeat = drawQuestions(
      first,
      [first],
      'practice',
      [completed],
      first.questions.map((q) => `first::${q.id}`),
      now,
      random,
    );
    expect(repeat).toHaveLength(4);
    expect(new Set(repeat.map((q) => q.id)).size).toBe(4);
  });
  it('prioritizes missed recovery over unseen items and delays it after success', () => {
    const miss = { ...history('practice', 0, 0, 1), total: 1 };
    expect(reviewQueue([miss], now)[0]).toMatchObject({
      questionId: 'first::q0',
      misses: 1,
      streak: 0,
    });
    expect(
      drawQuestions(first, [first], 'practice', [miss], [], now, random).map((q) => q.id),
    ).toContain('first::q0');
    const recovered = history('practice', 100, 1, 1, 'first', now.toISOString());
    expect(reviewQueue([miss, recovered], now)).toEqual([]);
    expect(
      drawQuestions(first, [first], 'practice', [miss, recovered], [], now, random).map(
        (q) => q.id,
      ),
    ).not.toContain('first::q0');
    expect(reviewQueue([miss, recovered], new Date('2026-11-11T12:00:00Z'))[0]).toMatchObject({
      streak: 1,
      dueAt: '2026-11-11T12:00:00.000Z',
    });
    const again = history('practice', 100, 1, 1, 'first', '2026-11-11T12:00:00Z');
    expect(reviewQueue([miss, recovered, again], new Date('2026-11-13T12:00:00Z'))).toEqual([]);
    expect(reviewQueue([miss, recovered, again], new Date('2026-11-14T12:00:00Z'))[0].streak).toBe(
      2,
    );
  });
  it('resets recovery streak on a new miss and processes unordered history chronologically', () => {
    const attempts = [
      history('practice', 0, 0, 1, 'first', '2026-11-10T11:00:00Z'),
      history('practice', 100, 1, 1, 'first', '2026-11-09T11:00:00Z'),
      history('practice', 0, 0, 1, 'first', '2026-11-08T11:00:00Z'),
    ];
    expect(reviewQueue(attempts, now)[0]).toMatchObject({ misses: 2, streak: 0 });
  });
  it('balances selected topics and excludes later quiz topics, other grades and other subjects', () => {
    const otherStrand = topic('shape', { strand: 'Geometry' });
    const otherGrade = topic('other-grade', { level: 'B5' });
    const otherSubject = topic('science', { subject: 'Science' });
    const all = [first, second, third, otherStrand, otherGrade, otherSubject];
    expect(assessmentLessons(second, all, 'practice').map((l) => l.id)).toEqual(['second']);
    expect(assessmentLessons(second, all, 'quiz').map((l) => l.id)).toEqual(['first', 'second']);
    const quiz = drawQuestions(second, all, 'quiz', [], [], now, random);
    expect(new Set(quiz.map((q) => q.lessonId))).toEqual(new Set(['first', 'second']));
    const counts = ['first', 'second'].map((id) => quiz.filter((q) => q.lessonId === id).length);
    expect(Math.abs(counts[0] - counts[1])).toBeLessThanOrEqual(1);
    const unit = drawQuestions(second, all, 'unit-test', [], [], now, random);
    expect(new Set(unit.map((q) => q.lessonId))).toEqual(
      new Set(['first', 'second', 'third', 'shape']),
    );
  });
  it('rejects insufficient banks rather than padding a test with duplicate questions', () => {
    const short = topic('short', { questions: first.questions.slice(0, 3) });
    expect(() => drawQuestions(short, [short], 'practice', [], [], now, random)).toThrow(
      'at least 4 distinct questions',
    );
  });
  it('performs Fisher-Yates swaps, preserves option keys, and does not mutate inputs', () => {
    expect(shuffle([0, 1, 2, 3], () => 0)).toEqual([1, 2, 3, 0]);
    const original = JSON.stringify([first, second]);
    const attempts = [history('practice', 50, 2, 4)];
    const historyBefore = JSON.stringify(attempts);
    const questions = drawQuestions(first, [first, second], 'practice', attempts, [], now, () => 0);
    for (const q of questions) {
      const source = first.questions.find((item) => q.id === `first::${item.id}`)!;
      expect(q.options[q.answer]).toBe(source.options[source.answer]);
      expect(q.answer).not.toBe(source.answer);
    }
    expect(JSON.stringify([first, second])).toBe(original);
    expect(JSON.stringify(attempts)).toBe(historyBefore);
    expect(
      gradeSession(
        questions,
        questions.map((q) => q.answer),
      ).score,
    ).toBe(100);
    expect(() => gradeSession(questions, [])).toThrow('every question');
    expect(() => gradeSession(questions, [99, 0, 0, 0])).toThrow('valid answer');
  });
});

describe('evidence-based mastery levels', () => {
  it('moves through attempts and familiar practice without upgrading untested skills', () => {
    expect(masteryForLesson('first', [])).toBe('Not started');
    expect(masteryForLesson('first', [history('practice', 50, 2, 4)])).toBe('Attempted');
    expect(masteryForLesson('first', [history('practice', 75, 3, 4)])).toBe('Familiar');
    expect(masteryForLesson('untested', [history('unit-test', 100, 10, 10)])).toBe('Not started');
  });
  it('requires both quiz/unit aggregate threshold and tested skill correctness', () => {
    expect(masteryForLesson('first', [history('quiz', 80, 4, 5)])).toBe('Proficient');
    expect(masteryForLesson('first', [history('quiz', 60, 3, 5)])).toBe('Attempted');
    const mixed = history('quiz', 80, 4, 5, 'second');
    mixed.outcomes[4] = { questionId: 'first::q0', lessonId: 'first', correct: false };
    expect(masteryForLesson('first', [mixed])).toBe('Attempted');
    expect(masteryForLesson('second', [mixed])).toBe('Proficient');
    expect(masteryForLesson('first', [history('unit-test', 90, 9, 10)])).toBe('Mastered');
    expect(masteryForLesson('first', [history('unit-test', 80, 8, 10)])).toBe('Attempted');
  });
  it('requires consecutive qualifying practice and retains a previously earned level', () => {
    const perfect = history('practice', 100, 4, 4);
    const secondPerfect = history('practice', 100, 4, 4, 'first', '2026-11-10T10:00:00Z');
    expect(masteryForLesson('first', [perfect])).toBe('Familiar');
    expect(masteryForLesson('first', [perfect, secondPerfect])).toBe('Mastered');
    const failed = history('practice', 0, 0, 4, 'first', '2026-11-09T12:00:00Z');
    expect(masteryForLesson('first', [perfect, failed, secondPerfect])).toBe('Familiar');
    expect(
      masteryForLesson('first', [
        perfect,
        secondPerfect,
        history('practice', 0, 0, 4, 'first', '2026-11-11T12:00:00Z'),
      ]),
    ).toBe('Mastered');
  });
});
