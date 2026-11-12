import { describe, expect, it } from 'vitest';
import type { NaccaIndicator, NaccaQuestion } from '../nacca/types';
import { buildQuestionBankDocument } from './questionBankExport';
import { summarizeQuestionBank } from './questionBankSummary';

describe('Learning Hub question bank summaries and exports', () => {
  it('derives subjects and levels from the supplied bank data', () => {
    const indicators = [
      { code: 'B7.1.1.1', subject: 'Science', level: 'B7' },
      { code: 'B4.1.1.1', subject: 'Mathematics', level: 'Basic 4' },
      { code: 'B1.1.1.1', subject: 'English Language', level: 'Basic 1' },
    ] as NaccaIndicator[];
    const questions = [
      { id: 'q1', subject: 'English Language', level: 'Basic 1' },
      { id: 'q2', subject: 'English Language', level: 'Basic 1' },
    ] as NaccaQuestion[];

    expect(summarizeQuestionBank(questions, indicators)).toEqual({
      questionCount: 2,
      indicatorCount: 3,
      subjects: ['English Language', 'Mathematics', 'Science'],
      levels: ['Basic 1', 'Basic 4', 'B7 · JHS 1'],
    });
  });

  it('builds a teacher document with choices, answer key and escaped source text', () => {
    const questions = [
      {
        id: 'q1',
        indicator_code: 'B4.1.1.1',
        subject: 'English Language',
        level: 'Basic 4',
        type: 'mcq',
        difficulty: 1,
        stem: 'Which word means <kind>?',
        options: ['kind', 'cruel'],
        answer: 0,
        hints: [],
        explanation: 'The answer is kind.',
      },
    ] as NaccaQuestion[];
    const document = buildQuestionBankDocument(questions, 'English Language', 'Basic 4');

    expect(document).toContain('Basic 4 English Language Question Bank');
    expect(document).toContain('Which word means &lt;kind&gt;?');
    expect(document).toContain('<li>kind</li>');
    expect(document).toContain('Teacher Answer Key');
    expect(document).toContain('<strong>1. A. kind</strong>');
  });
});
