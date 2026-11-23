import { describe, expect, it } from 'vitest';
import { naccaHubLessons, naccaIndicators, naccaQuestions } from './learningHub/naccaBank';
import { getLessonPracticeIndicator } from './learningHub/practiceNavigation';
import { createAdaptiveSession, getNextAdaptiveQuestion } from './nacca/adaptiveEngine';
import { getIndicatorAttempts, savePracticeAttempt } from './nacca/practiceHistory';

describe('indicator practice navigation', () => {
  it('resolves every imported lesson to its exact subject, level and indicator', () => {
    const pools = new Map<string, typeof naccaQuestions>();
    for (const q of naccaQuestions) {
      const key = q.subject + ':' + q.level;
      const pool = pools.get(key);
      if (pool) pool.push(q);
      else pools.set(key, [q]);
    }
    for (const lesson of naccaHubLessons) {
      const indicator = getLessonPracticeIndicator(lesson);
      expect(indicator).toBeDefined();
      expect(lesson.title.startsWith(`${indicator!.code} ·`)).toBe(true);
      expect(indicator!.subject).toBe(lesson.subject);
      expect(indicator!.level).toBe(lesson.level);
      const pool = pools.get(lesson.subject + ':' + lesson.level) ?? [];
      const question = getNextAdaptiveQuestion(pool, createAdaptiveSession(indicator!.code));
      if (question) {
        expect(question.indicator_code).toBe(indicator!.code);
        expect(question.subject).toBe(lesson.subject);
        expect(question.level).toBe(lesson.level);
      }
    }
    expect(naccaHubLessons).toHaveLength(naccaIndicators.length - 18);
  });

  it('keeps custom Basic 1 lessons in their own lesson player', () => {
    expect(
      getLessonPracticeIndicator({ id: 'custom-lesson', subject: 'Science', level: 'Basic 1' }),
    ).toBeUndefined();
  });

  it('does not mix mastery history for shared indicator codes across subjects', () => {
    for (const subject of ['Science', 'Mathematics']) {
      savePracticeAttempt({
        studentId: 'routing-test',
        indicatorCode: 'B1.1.1.1.1',
        subject,
        level: 'Basic 1',
        category: 'auto',
        score: 100,
        correctCount: 1,
        totalCount: 1,
        questions: [],
      });
    }
    const history = getIndicatorAttempts('B1.1.1.1.1', 'routing-test', 'Science', 'Basic 1');
    expect(history.allAttempts).toHaveLength(1);
    expect(history.allAttempts[0].subject).toBe('Science');
  });
});
