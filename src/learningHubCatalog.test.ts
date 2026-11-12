import { describe, expect, it } from 'vitest';
import { hubLessons } from './learningHub/catalog';
import * as publicSources from './learningHub/sources';
import {
  basicFourEnglishLessons,
  basicThreeEnglishLessons,
  basicTwoEnglishLessons,
} from './learningHub/englishBank';
import { getLessonPracticeIndicator } from './learningHub/practiceNavigation';
import { naccaQuestions, naccaIndicators, naccaLevels } from './learningHub/naccaBank';
import { summarizeQuestionBank } from './learningHub/questionBankSummary';
import englishB3Bank from './learningHub/englishB3Bank.json';
import englishB4Bank from './learningHub/englishB4Bank.json';

// Protect stable references used by saved assignments and server-graded attempts.
describe('Learning Hub curriculum integrity', () => {
  it('includes catalog JHS lessons in the question bank and displays all represented levels', () => {
    const jhsIndicators = naccaIndicators.filter((indicator) => /^B[789]$/.test(indicator.level));
    const jhsQuestions = naccaQuestions.filter((question) => /^B[789]$/.test(question.level));
    expect(jhsIndicators).toHaveLength(18);
    expect(jhsQuestions).toHaveLength(54);
    expect(naccaLevels.filter((level) => /^B[789]$/.test(level.name))).toHaveLength(3);
    expect(new Set(jhsIndicators.map((indicator) => indicator.subject))).toEqual(
      new Set(['Mathematics', 'Science']),
    );
    const summary = summarizeQuestionBank(naccaQuestions, naccaIndicators);
    expect(summary.questionCount).toBe(10408);
    expect(summary.indicatorCount).toBe(610);
    expect(summary.subjects).toEqual(['English Language', 'Mathematics', 'Science']);
    expect(summary.levels).toEqual([
      'Basic 1',
      'Basic 2',
      'Basic 3',
      'Basic 4',
      'Basic 5',
      'Basic 6',
      'JHS 1',
      'JHS 2',
      'JHS 3',
    ]);
  });
  it('includes the 49 supplied Basic 2 English indicators and only scores authentic MCQs', () => {
    expect(basicTwoEnglishLessons).toHaveLength(49);
    expect(new Set(basicTwoEnglishLessons.map((lesson) => lesson.standard)).size).toBe(49);
    expect(basicTwoEnglishLessons.every((lesson) => lesson.subject === 'English Language')).toBe(
      true,
    );
    expect(basicTwoEnglishLessons.every((lesson) => lesson.level === 'B2')).toBe(true);
    expect(
      basicTwoEnglishLessons.reduce((total, lesson) => total + lesson.questions.length, 0),
    ).toBe(502);
    expect(
      basicTwoEnglishLessons.some((lesson) => lesson.body.join(' ').includes('teacher-assessed')),
    ).toBe(true);
  });
  it('routes Basic 2 English course practice into the one-question-at-a-time bank', () => {
    const lesson = basicTwoEnglishLessons.find((item) => item.standard === 'B2.6.1.1.1')!;
    const indicator = getLessonPracticeIndicator(lesson);
    expect(indicator?.code).toBe(lesson.standard);
    expect(indicator?.level).toBe('Basic 2');
    expect(
      naccaQuestions.filter((question) => question.indicator_code === lesson.standard),
    ).toHaveLength(lesson.questions.length);
    expect(
      naccaIndicators.filter(
        (item) => item.level === 'Basic 2' && item.subject === 'English Language',
      ),
    ).toHaveLength(49);
  });
  it('includes the 66 supplied Basic 3 English indicators in the adaptive practice bank', () => {
    expect(basicThreeEnglishLessons).toHaveLength(66);
    expect(new Set(basicThreeEnglishLessons.map((lesson) => lesson.standard)).size).toBe(66);
    expect(basicThreeEnglishLessons.every((lesson) => lesson.subject === 'English Language')).toBe(
      true,
    );
    expect(basicThreeEnglishLessons.every((lesson) => lesson.level === 'B3')).toBe(true);
    expect(
      basicThreeEnglishLessons.reduce((total, lesson) => total + lesson.questions.length, 0),
    ).toBe(839);
    expect(englishB3Bank.reduce((total, bank) => total + bank.excludedMcqCount, 0)).toBe(2);
    const lesson = basicThreeEnglishLessons.find((item) => item.standard === 'B3.6.1.1.1')!;
    const indicator = getLessonPracticeIndicator(lesson);
    expect(indicator?.code).toBe(lesson.standard);
    expect(indicator?.level).toBe('Basic 3');
    expect(
      naccaQuestions.filter((question) => question.indicator_code === lesson.standard),
    ).toHaveLength(lesson.questions.length);
    expect(
      naccaIndicators.filter(
        (item) => item.level === 'Basic 3' && item.subject === 'English Language',
      ),
    ).toHaveLength(66);
  });
  it('includes the supplied Basic 4 English question banks in one-question practice', () => {
    expect(englishB4Bank).toHaveLength(120);
    expect(englishB4Bank.reduce((total, bank) => total + (bank.duplicateSourceCount || 0), 0)).toBe(
      1,
    );
    expect(basicFourEnglishLessons).toHaveLength(120);
    expect(new Set(basicFourEnglishLessons.map((lesson) => lesson.standard)).size).toBe(120);
    expect(basicFourEnglishLessons.every((lesson) => lesson.subject === 'English Language')).toBe(
      true,
    );
    expect(basicFourEnglishLessons.every((lesson) => lesson.level === 'B4')).toBe(true);
    expect(
      basicFourEnglishLessons.reduce((total, lesson) => total + lesson.questions.length, 0),
    ).toBe(1925);
    expect(englishB4Bank.reduce((total, bank) => total + bank.questionCount, 0)).toBe(2375);
    expect(englishB4Bank.reduce((total, bank) => total + bank.excludedMcqCount, 0)).toBe(20);
    const lesson = basicFourEnglishLessons.find((item) => item.standard === 'B4.3.2.1.1')!;
    const indicator = getLessonPracticeIndicator(lesson);
    expect(indicator?.code).toBe(lesson.standard);
    expect(indicator?.level).toBe('Basic 4');
    expect(
      naccaQuestions.filter(
        (question) =>
          question.indicator_code === lesson.standard &&
          question.level === 'Basic 4' &&
          question.subject === 'English Language',
      ),
    ).toHaveLength(lesson.questions.length);
    expect(
      naccaIndicators.filter(
        (item) => item.level === 'Basic 4' && item.subject === 'English Language',
      ),
    ).toHaveLength(120);
  });
  it('has unique references, valid answer options and level-consistent standard codes', () => {
    expect(new Set(hubLessons.map((lesson) => lesson.id)).size).toBe(hubLessons.length);
    for (const lesson of hubLessons) {
      expect(lesson.standard.split('.')[0], lesson.id).toBe(lesson.level);
      expect(lesson.standard, lesson.id).toMatch(/^B[1-9](?:\.[1-9]\d*){3,5}$/);
      expect(lesson.body.length, lesson.id).toBeGreaterThan(0);
      expect(lesson.questions.length, lesson.id).toBeGreaterThan(0);
      expect(new Set(lesson.questions.map((question) => question.id)).size, lesson.id).toBe(
        lesson.questions.length,
      );
      for (const question of lesson.questions) {
        expect(Number.isInteger(question.answer), `${lesson.id}/${question.id}`).toBe(true);
        expect(question.answer).toBeGreaterThanOrEqual(0);
        expect(question.answer).toBeLessThan(question.options.length);
        expect(question.options.length).toBeGreaterThan(1);
        expect(new Set(question.options.map((option) => option.trim())).size).toBe(
          question.options.length,
        );
        expect(question.explanation.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('keeps the public reference directory free of lesson answer keys and connects lesson citations', () => {
    expect(Object.keys(publicSources)).toEqual(['curriculumSources']);
    const sources = publicSources.curriculumSources;
    expect(new Set(sources.map((source) => source.url)).size).toBe(sources.length);
    for (const source of sources) {
      const url = new URL(source.url);
      expect(url.protocol).toBe('https:');
      expect([
        'nacca.gov.gh',
        'curriculumresources.edu.gh',
        'mingycomputersgh.wordpress.com',
      ]).toContain(url.hostname);
      expect(source.levels.length).toBeGreaterThan(0);
      expect(source.subjects.length).toBeGreaterThan(0);
      expect(Object.keys(source).sort()).toEqual(
        ['title', 'url', 'description', 'levels', 'subjects'].sort(),
      );
    }
    for (const lesson of hubLessons) {
      const source = sources.find((source) => source.url === lesson.sourceUrl);
      expect(source, lesson.id).toBeDefined();
      expect(source!.levels).toContain(lesson.level);
      expect(source!.subjects).toContain(lesson.subject);
    }
  });

  it('keys representative multi-step numeric questions to independently calculated results', () => {
    const answer = (lessonId: string, questionId: string) => {
      const question = hubLessons
        .find((lesson) => lesson.id === lessonId)!
        .questions.find((question) => question.id === questionId)!;
      return question.options[question.answer];
    };
    expect(answer('b9-math-proportion', 'r2')).toBe(`GH₵${120 * (1 - 25 / 100)}`);
    expect(answer('b9-math-proportion', 'r3')).toBe(`GH₵${200 * (5 / 100) * 3}`);
    expect(Number(answer('b7-math-equations', 'e2'))).toBe((25 - 4) / 3);
    expect(Number(answer('b8-math-operations', 'o2'))).toBe(1.5 / 0.25);
    expect(Number(answer('b9-math-statistics', 's1'))).toBe((4 + 6 + 8) / 3);
  });
});
