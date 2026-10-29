import { describe, expect, it } from 'vitest';
import { hubLessons } from './learningHub/catalog';
import * as publicSources from './learningHub/sources';

// Protect stable references used by saved assignments and server-graded attempts.
describe('Learning Hub curriculum integrity', () => {
  it('has unique references, valid answer options and level-consistent standard codes', () => {
    expect(new Set(hubLessons.map((lesson) => lesson.id)).size).toBe(hubLessons.length);
    for (const lesson of hubLessons) {
      expect(lesson.standard.split('.')[0], lesson.id).toBe(lesson.level);
      expect(lesson.standard, lesson.id).toMatch(/^B[1-9](?:\.[1-9]\d*){3,4}$/);
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
