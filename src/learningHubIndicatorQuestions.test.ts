import { describe, expect, it } from 'vitest';
import {
  auditIndicatorQuestions,
  type CurriculumIndicator,
  type IndicatorQuestion,
} from './learningHub/indicatorQuestions';

// Artificial fixture metadata, not a published or verified NaCCA curriculum mapping.
const indicator: CurriculumIndicator = {
  subject: 'Fixture mathematics',
  grade: 1,
  standard: 'B1.1.1.1',
  code: 'B1.1.1.1.1',
  strand: 'Fixture strand',
  subStrand: 'Fixture sub-strand',
  objective: 'Fixture objective',
  sourceUrl: 'https://example.com/fixture.pdf',
  sourcePage: 1,
  sourceVerified: true,
  assessmentModes: ['multiple-choice'],
  requiredDemands: ['understand', 'apply'],
  requiredDifficulties: ['foundation', 'developing'],
};
const items = (): IndicatorQuestion[] =>
  Array.from({ length: 16 }, (_, i) => ({
    id: `fixture-addition-${i}`,
    prompt: `What is ${i} + 1?`,
    options: [String(i), String(i + 1), String(i + 2)],
    answer: 1,
    explanation: `The number after ${i} is ${i + 1}.`,
    type: 'multiple-choice',
    subject: indicator.subject,
    grade: indicator.grade,
    standard: indicator.standard,
    indicatorCode: indicator.code,
    sourceUrl: indicator.sourceUrl,
    sourcePage: indicator.sourcePage,
    demand: i < 8 ? 'understand' : 'apply',
    difficulty: i < 8 ? 'foundation' : 'developing',
    variationKey: `add-one-to-${i}`,
    misconceptionFeedback: {
      0: 'Add one rather than leave the number unchanged.',
      2: 'Add one, not two.',
    },
    authorship: {
      original: true,
      author: 'Test fixture author',
      reviewedBy: 'Test fixture reviewer',
    },
  }));

describe('indicator question publication audit', () => {
  it('requires explicit inventory completeness separately from ready individual banks', () => {
    const result = auditIndicatorQuestions([indicator], items());
    expect(result.coverage[0].ready).toBe(true);
    expect(result.ready).toBe(false);
    expect(auditIndicatorQuestions([indicator], items(), { inventoryComplete: true }).ready).toBe(
      true,
    );
    expect(auditIndicatorQuestions([], [], { inventoryComplete: true }).ready).toBe(false);
  });
  it('reports the exact missing indicator without filling it with generic content', () => {
    const missing = { ...indicator, code: 'B1.1.1.1.2' };
    const result = auditIndicatorQuestions([indicator, missing], items(), {
      inventoryComplete: true,
    });
    expect(result.coverage[1]).toMatchObject({
      indicatorCode: missing.code,
      validQuestions: 0,
      missingQuestions: 16,
      ready: false,
    });
    expect(result.acceptedQuestions).toHaveLength(16);
    expect(result.ready).toBe(false);
  });
  it('rejects cross-grade, standard and provenance mismatches', () => {
    const questions = items();
    questions[0].grade = 9;
    questions[1].standard = 'B1.2.1.1';
    questions[2].sourcePage = 2;
    const result = auditIndicatorQuestions([indicator], questions);
    expect(result.acceptedQuestions).toHaveLength(13);
    expect(result.coverage[0].missingQuestions).toBe(3);
  });
  it('rejects duplicate IDs, reordered duplicate options and repeated variation keys', () => {
    const questions = items();
    questions[1].id = questions[0].id;
    questions[3] = {
      ...questions[2],
      id: questions[3].id,
      variationKey: 'different-key',
      options: [...questions[2].options].reverse(),
    };
    questions[5].variationKey = questions[4].variationKey;
    expect(auditIndicatorQuestions([indicator], questions).acceptedQuestions).toHaveLength(10);
  });
  it('requires editorial review, explanation and feedback for each distractor', () => {
    const questions = items();
    questions[0].authorship.reviewedBy = '';
    questions[1].explanation = '';
    questions[2].misconceptionFeedback = { 0: 'Feedback' };
    expect(auditIndicatorQuestions([indicator], questions).acceptedQuestions).toHaveLength(13);
  });
  it('keeps oral and performance evidence gaps visible despite a complete MCQ bank', () => {
    const result = auditIndicatorQuestions(
      [{ ...indicator, assessmentModes: ['multiple-choice', 'oral', 'performance'] }],
      items(),
      { inventoryComplete: true },
    );
    expect(result.coverage[0]).toMatchObject({
      validQuestions: 16,
      missingQuestions: 0,
      unsupportedModes: ['oral', 'performance'],
      ready: false,
    });
  });
  it('checks progression and never treats a large one-demand bank as complete', () => {
    const questions = items().map((q) => ({
      ...q,
      demand: 'recall' as const,
      difficulty: 'foundation' as const,
    }));
    expect(auditIndicatorQuestions([indicator], questions).coverage[0]).toMatchObject({
      missingDemands: ['understand', 'apply'],
      missingDifficulties: ['developing'],
      ready: false,
    });
  });
  it('rejects unverified and structurally inconsistent inventory entries', () => {
    expect(
      auditIndicatorQuestions([{ ...indicator, sourceVerified: false }], items()).acceptedQuestions,
    ).toHaveLength(0);
    expect(
      auditIndicatorQuestions([{ ...indicator, grade: 2 }], items()).acceptedQuestions,
    ).toHaveLength(0);
    expect(auditIndicatorQuestions([indicator, indicator], items()).acceptedQuestions).toHaveLength(
      0,
    );
    expect(() => auditIndicatorQuestions([indicator], items(), { minimumQuestions: 4 })).toThrow(
      'sixteen',
    );
  });
});
