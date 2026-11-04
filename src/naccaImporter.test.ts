import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { processQuestionBank } from './nacca/importer';

describe('NaCCA Question Bank Importer (Step 1)', () => {
  const publishedQuestionsPath = resolve(__dirname, '../published_questions.json');
  const rawData = JSON.parse(readFileSync(publishedQuestionsPath, 'utf8'));

  it('successfully processes 5849 questions across 295 indicators from Basic 1 to Basic 6 (Mathematics & Science)', () => {
    const result = processQuestionBank(rawData);

    expect(result.questions).toHaveLength(5849);
    expect(result.indicators).toHaveLength(295);
    expect(result.subjects).toHaveLength(2);
    expect(result.subjects.map((s) => s.name)).toContain('Mathematics');
    expect(result.subjects.map((s) => s.name)).toContain('Science');
    expect(result.levels).toHaveLength(6);
    expect(result.levels.map((l) => l.name)).toContain('Basic 1');
    expect(result.levels.map((l) => l.name)).toContain('Basic 2');
    expect(result.levels.map((l) => l.name)).toContain('Basic 3');
    expect(result.levels.map((l) => l.name)).toContain('Basic 4');
    expect(result.levels.map((l) => l.name)).toContain('Basic 5');
    expect(result.levels.map((l) => l.name)).toContain('Basic 6');
    // Rule 1: malformed item skipped and recorded (2 malformed items across B1-B6)
    expect(result.report.totalSkipped).toBe(2);
    expect(
      result.report.skippedItems.every((item) =>
        item.reason.includes('Numeric question must have a numeric answer'),
      ),
    ).toBe(true);
  });

  it('guarantees idempotency: re-processing updates existing questions and produces identical unique count', () => {
    const run1 = processQuestionBank(rawData);
    const run2 = processQuestionBank(rawData);

    expect(run1.questions.length).toBe(run2.questions.length);
    expect(run1.indicators.length).toBe(run2.indicators.length);

    // Verify all question IDs are unique
    const uniqueIds = new Set(run1.questions.map((q) => q.id));
    expect(uniqueIds.size).toBe(5849);
  });

  it('sorts indicators in ascending curriculum order with B1.1.1.1.1 on top (not BI.4.1.1.1)', () => {
    const result = processQuestionBank(rawData);
    expect(result.indicators[0].code).toBe('B1.1.1.1.1');
    expect(result.indicators[0].strand).toBe('Number');
    expect(result.indicators[0].level).toBe('Basic 1');

    const b1MathIndicators = result.indicators.filter(
      (i) => i.level === 'Basic 1' && i.subject === 'Mathematics',
    );
    expect(b1MathIndicators[0].code).toBe('B1.1.1.1.1');
    expect(b1MathIndicators[b1MathIndicators.length - 1].code).toBe('BI.4.1.1.1');

    const b1ScienceIndicators = result.indicators.filter(
      (i) => i.level === 'Basic 1' && i.subject === 'Science',
    );
    expect(b1ScienceIndicators[0].code).toBe('B1.1.1.1.1');
    expect(b1ScienceIndicators[0].strand).toBe('DIVERSITY OF MATTER');
    expect(b1ScienceIndicators[b1ScienceIndicators.length - 1].code).toBe('B1.5.3.1.1');

    const b2MathIndicators = result.indicators.filter(
      (i) => i.level === 'Basic 2' && i.subject === 'Mathematics',
    );
    expect(b2MathIndicators[0].code).toBe('B2.1.1.1.1');
    expect(b2MathIndicators[b2MathIndicators.length - 1].code).toBe('B2.4.1.1.1');

    const b2ScienceIndicators = result.indicators.filter(
      (i) => i.level === 'Basic 2' && i.subject === 'Science',
    );
    expect(b2ScienceIndicators[0].code).toBe('B2.1.1.1.1');
    expect(b2ScienceIndicators[0].strand).toBe('DIVERSITY OF MATTER');
    expect(b2ScienceIndicators[b2ScienceIndicators.length - 1].code).toBe('B2.5.3.2.1');

    const b3MathIndicators = result.indicators.filter(
      (i) => i.level === 'Basic 3' && i.subject === 'Mathematics',
    );
    expect(b3MathIndicators[0].code).toBe('B3.1.1.1.1');
    expect(b3MathIndicators[b3MathIndicators.length - 1].code).toBe('B3.4.1.2.1');

    const b3ScienceIndicators = result.indicators.filter(
      (i) => i.level === 'Basic 3' && i.subject === 'Science',
    );
    expect(b3ScienceIndicators[0].code).toBe('B3.1.1.1.1');
    expect(b3ScienceIndicators[0].strand).toBe('DIVERSITY OF MATTER');
    expect(b3ScienceIndicators[b3ScienceIndicators.length - 1].code).toBe('B3.5.4.1.1');

    const b4MathIndicators = result.indicators.filter(
      (i) => i.level === 'Basic 4' && i.subject === 'Mathematics',
    );
    expect(b4MathIndicators[0].code).toBe('B4.1.1.1.1');

    const b4ScienceIndicators = result.indicators.filter(
      (i) => i.level === 'Basic 4' && i.subject === 'Science',
    );
    expect(b4ScienceIndicators[0].code).toBe('B4.1.1.1.1');
    expect(b4ScienceIndicators[0].strand).toBe('DIVERSITY OF MATTER');
    expect(b4ScienceIndicators[b4ScienceIndicators.length - 1].code).toBe('B4.5.4.1.1');

    const b5MathIndicators = result.indicators.filter(
      (i) => i.level === 'Basic 5' && i.subject === 'Mathematics',
    );
    expect(b5MathIndicators[0].code).toBe('B5.1.1.1.1');
    expect(b5MathIndicators[b5MathIndicators.length - 1].code).toBe('B5.4.2.1.2');

    const b5ScienceIndicators = result.indicators.filter(
      (i) => i.level === 'Basic 5' && i.subject === 'Science',
    );
    expect(b5ScienceIndicators[0].code).toBe('B5.1.1.1.1');
    expect(b5ScienceIndicators[0].strand).toBe('DIVERSITY OF MATTER');
    expect(b5ScienceIndicators[b5ScienceIndicators.length - 1].code).toBe('B5.5.4.1.1');

    const b5Indicators = result.indicators.filter((i) => i.level === 'Basic 5');
    expect(b5Indicators[0].code).toBe('B5.1.1.1.1');
    expect(b5Indicators[b5Indicators.length - 1].code).toBe('B5.5.4.1.1');

    const b6MathIndicators = result.indicators.filter(
      (i) => i.level === 'Basic 6' && i.subject === 'Mathematics',
    );
    expect(b6MathIndicators[0].code).toBe('B6.1.1.1.1');
    expect(b6MathIndicators[b6MathIndicators.length - 1].code).toBe('B6.4.2.2.2');

    const b6ScienceIndicators = result.indicators.filter(
      (i) => i.level === 'Basic 6' && i.subject === 'Science',
    );
    expect(b6ScienceIndicators[0].code).toBe('B6.1.1.1.1');
    expect(b6ScienceIndicators[0].strand).toBe('DIVERSITY OF MATTER');
    expect(b6ScienceIndicators[b6ScienceIndicators.length - 1].code).toBe('B6.5.4.1.1');

    const b6Indicators = result.indicators.filter((i) => i.level === 'Basic 6');
    expect(b6Indicators[0].code).toBe('B6.1.1.1.1');
    expect(b6Indicators[b6Indicators.length - 1].code).toBe('B6.5.4.1.1');
  });

  it('correctly calculates counts per subject, level, and indicator', () => {
    const result = processQuestionBank(rawData);
    const { report } = result;

    expect(report.countsBySubject['Mathematics']).toBe(3357);
    expect(report.countsBySubject['Science']).toBe(2492);
    expect(report.countsByLevel['Basic 1']).toBe(888); // 352 Math + 536 Science
    expect(report.countsByLevel['Basic 2']).toBe(708); // 349 Math + 359 Science
    expect(report.countsByLevel['Basic 3']).toBe(1051); // 670 Math + 381 Science
    expect(report.countsByLevel['Basic 4']).toBe(1129); // 768 Math + 361 Science
    expect(report.countsByLevel['Basic 5']).toBe(1050); // 672 Math + 378 Science
    expect(report.countsByLevel['Basic 6']).toBe(1023); // 546 Math + 477 Science
    expect(report.countsBySubjectAndLevel['Mathematics']['Basic 1']).toBe(352);
    expect(report.countsBySubjectAndLevel['Science']['Basic 1']).toBe(536);
    expect(report.countsBySubjectAndLevel['Mathematics']['Basic 2']).toBe(349);
    expect(report.countsBySubjectAndLevel['Science']['Basic 2']).toBe(359);
    expect(report.countsBySubjectAndLevel['Mathematics']['Basic 3']).toBe(670);
    expect(report.countsBySubjectAndLevel['Science']['Basic 3']).toBe(381);
    expect(report.countsBySubjectAndLevel['Mathematics']['Basic 4']).toBe(768);
    expect(report.countsBySubjectAndLevel['Science']['Basic 4']).toBe(361);
    expect(report.countsBySubjectAndLevel['Mathematics']['Basic 5']).toBe(672);
    expect(report.countsBySubjectAndLevel['Science']['Basic 5']).toBe(378);
    expect(report.countsBySubjectAndLevel['Mathematics']['Basic 6']).toBe(546);
    expect(report.countsBySubjectAndLevel['Science']['Basic 6']).toBe(477);

    expect(report.indicatorsCount).toBe(295);
    // Spot-check known indicators from Basic 1 through Basic 6
    expect(report.questionsPerIndicator['BI.4.1.1.1']).toBe(19);
    expect(report.questionsPerIndicator['B1.3.3.1.1']).toBe(20);
    expect(report.questionsPerIndicator['B1.5.3.1.1']).toBe(20); // Science B1
    expect(report.questionsPerIndicator['B2.4.1.1.1']).toBe(40); // 20 Math + 20 Science
    expect(report.questionsPerIndicator['B2.5.3.2.1']).toBe(20); // Science B2
    expect(report.questionsPerIndicator['B2.1.2.1.1']).toBe(21); // Science B2
    expect(report.questionsPerIndicator['B3.4.1.2.1']).toBe(40); // 19 Math + 21 Science
    expect(report.questionsPerIndicator['B3.1.1.1.1']).toBe(40); // 20 Math + 20 Science
    expect(report.questionsPerIndicator['B3.5.4.1.1']).toBe(20); // Science B3
    expect(report.questionsPerIndicator['B4.1.1.1.1']).toBe(39); // 19 Math + 20 Science
    expect(report.questionsPerIndicator['B4.2.1.1.1']).toBe(40); // 20 Math + 20 Science
    expect(report.questionsPerIndicator['B4.5.4.1.1']).toBe(19); // Science B4
    expect(report.questionsPerIndicator['B4.1.1.4.2']).toBe(21);
    expect(report.questionsPerIndicator['B4.1.2.1.1']).toBe(20);
    expect(report.questionsPerIndicator['B5.1.1.1.1']).toBe(40); // 19 Math + 21 Science
    expect(report.questionsPerIndicator['B5.4.2.1.2']).toBe(19); // Math B5
    expect(report.questionsPerIndicator['B5.4.1.2.2']).toBe(39); // 19 Math + 20 Science
    expect(report.questionsPerIndicator['B5.5.4.1.1']).toBe(19); // Science B5
    expect(report.questionsPerIndicator['B6.1.1.1.1']).toBe(21); // 1 Math + 20 Science
    expect(report.questionsPerIndicator['B6.2.1.1.4']).toBe(13); // Math B6
    expect(report.questionsPerIndicator['B6.4.2.2.2']).toBe(19); // Math B6
    expect(report.questionsPerIndicator['B6.5.3.1.1']).toBe(18); // Science B6
    expect(report.questionsPerIndicator['B6.5.4.1.1']).toBe(20); // Science B6
  });

  it('skips malformed questions and records specific failure reasons', () => {
    const malformedData = [
      {
        file_name: 'test.json',
        indicator: {
          code: 'TEST.1.1',
          subject: 'Science',
          level: 'Basic 2',
          strand: 'Living Things',
          sub_strand: 'Plants',
        },
        questions: [
          // Valid MCQ
          {
            stem: 'What is a flower?',
            type: 'mcq',
            difficulty: 1,
            options: ['Plant part', 'Animal', 'Rock'],
            answer: 0,
          },
          // Missing stem
          {
            stem: '',
            type: 'mcq',
            difficulty: 1,
            options: ['A', 'B'],
            answer: 0,
          },
          // Unsupported type
          {
            stem: 'Draw a plant',
            type: 'telepathic',
            difficulty: 2,
          },
          // MCQ answer index out of bounds
          {
            stem: 'Select the color',
            type: 'mcq',
            difficulty: 1,
            options: ['Red', 'Blue'],
            answer: 5,
          },
          // Numeric question with non-numeric answer
          {
            stem: 'How many legs does a spider have?',
            type: 'numeric',
            difficulty: 1,
            answer: 'eight legs',
          },
          // Invalid difficulty
          {
            stem: 'Count',
            type: 'numeric',
            difficulty: 99,
            answer: 5,
          },
        ],
      },
    ];

    const result = processQuestionBank(malformedData);

    expect(result.questions).toHaveLength(1);
    expect(result.questions[0].stem).toBe('What is a flower?');
    expect(result.report.totalSkipped).toBe(5);

    const reasons = result.report.skippedItems.map((s) => s.reason);
    expect(reasons.some((r) => r.includes('Missing or empty question stem'))).toBe(true);
    expect(reasons.some((r) => r.includes('Unsupported question type'))).toBe(true);
    expect(reasons.some((r) => r.includes('out of bounds'))).toBe(true);
    expect(reasons.some((r) => r.toLowerCase().includes('numeric answer'))).toBe(true);
    expect(reasons.some((r) => r.includes('Invalid difficulty'))).toBe(true);
  });

  it('preserves exact question stem, options, and explanation without alteration (Rule 1)', () => {
    const result = processQuestionBank(rawData);
    const q1 = result.questions.find(
      (q) => q.indicator_code === 'BI.4.1.1.1' && q.difficulty === 1,
    );

    expect(q1).toBeDefined();
    expect(q1?.stem).toBe(
      'Sort these into two groups: apples, bananas, oranges, carrots. Which item does NOT belong with the fruits?',
    );
    expect(q1?.options).toEqual(['Apple', 'Banana', 'Carrot', 'Orange']);
    expect(q1?.answer).toBe(2);
    expect(q1?.explanation).toBe('Carrot is not a fruit.');
  });
});
