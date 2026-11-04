import { describe, it, expect } from 'vitest';
import {
  createAdaptiveSession,
  getNextAdaptiveQuestion,
  recordAdaptiveAnswer,
} from './nacca/adaptiveEngine';
import { evaluateAnswer, sanitizeQuestionForStudent } from './nacca/answerChecker';
import {
  calculateMastery,
  DEFAULT_MASTERY_RULE,
  type IndicatorAttemptRecord,
} from './nacca/mastery';
import {
  savePracticeAttempt,
  loadPracticeHistory,
  getIndicatorAttempts,
  type PracticeSessionRecord,
} from './nacca/practiceHistory';
import type { NaccaQuestion } from './nacca/types';

describe('NaCCA Student Practice Engine (Step 2)', () => {
  const sampleQuestions: NaccaQuestion[] = [
    {
      id: 'Q_D1_1',
      indicator_code: 'B1.1.1.1.1',
      subject: 'Mathematics',
      level: 'Basic 1',
      strand: 'Number',
      sub_strand: 'Counting',
      type: 'mcq',
      difficulty: 1,
      stem: 'How many apples are shown? 🍎🍎',
      options: ['1', '2', '3', '4'],
      answer: 1,
      hints: ['Count each apple one by one.'],
      explanation: 'There are two apples.',
    },
    {
      id: 'Q_D1_2',
      indicator_code: 'B1.1.1.1.1',
      subject: 'Mathematics',
      level: 'Basic 1',
      strand: 'Number',
      sub_strand: 'Counting',
      type: 'numeric',
      difficulty: 1,
      stem: 'Type the number that comes after 4.',
      hints: ['4 + 1 = ?'],
      answer: 5,
      explanation: '5 comes after 4.',
    },
    {
      id: 'Q_D2_1',
      indicator_code: 'B1.1.1.1.1',
      subject: 'Mathematics',
      level: 'Basic 1',
      strand: 'Number',
      sub_strand: 'Counting',
      type: 'numeric',
      difficulty: 2,
      stem: 'Calculate 3 + 2.',
      hints: ['Add 3 and 2.'],
      answer: 5,
      explanation: '3 + 2 = 5.',
    },
    {
      id: 'Q_D3_1',
      indicator_code: 'B1.1.1.1.1',
      subject: 'Mathematics',
      level: 'Basic 1',
      strand: 'Number',
      sub_strand: 'Counting',
      type: 'short_answer',
      difficulty: 3,
      stem: 'Write the number word for 8.',
      hints: ['Starts with E.'],
      answer: ['eight', 'Eight', 'EIGHT'],
      explanation: '8 is written as eight.',
    },
    {
      id: 'Q_D4_1',
      indicator_code: 'B1.1.1.1.1',
      subject: 'Mathematics',
      level: 'Basic 1',
      strand: 'Number',
      sub_strand: 'Counting',
      type: 'mcq',
      difficulty: 4,
      stem: 'What is 15 - 7?',
      options: ['6', '7', '8', '9'],
      answer: 2,
      hints: ['Count down from 15.'],
      explanation: '15 - 7 = 8.',
    },
  ];

  describe('Adaptive Question Progression and No-Repeat Guarantee', () => {
    it('starts practice session at difficulty 1', () => {
      const session = createAdaptiveSession('B1.1.1.1.1');
      expect(session.currentDifficulty).toBe(1);

      const firstQ = getNextAdaptiveQuestion(sampleQuestions, session);
      expect(firstQ).not.toBeNull();
      expect(firstQ?.difficulty).toBe(1);
    });

    it('moves up to difficulty 2 and higher when student answers correctly', () => {
      let session = createAdaptiveSession('B1.1.1.1.1');
      const q1 = getNextAdaptiveQuestion(sampleQuestions, session)!;
      expect(q1.difficulty).toBe(1);

      session = recordAdaptiveAnswer(session, q1.id, true);
      expect(session.currentDifficulty).toBe(2);

      const q2 = getNextAdaptiveQuestion(sampleQuestions, session)!;
      expect(q2.id).not.toBe(q1.id);
      expect(q2.difficulty).toBe(2);

      session = recordAdaptiveAnswer(session, q2.id, true);
      expect(session.currentDifficulty).toBe(3);

      const q3 = getNextAdaptiveQuestion(sampleQuestions, session)!;
      expect(q3.difficulty).toBe(3);
    });

    it('moves down difficulty after repeated mistakes', () => {
      let session = createAdaptiveSession('B1.1.1.1.1');
      session.currentDifficulty = 3;

      // First mistake: student gets a chance to recover at current difficulty
      session = recordAdaptiveAnswer(session, 'Q_D3_1', false);
      expect(session.currentDifficulty).toBe(3);
      expect(session.consecutiveWrongAtCurrentDifficulty).toBe(1);

      // Second consecutive mistake: triggers difficulty decrease down to 2
      session = recordAdaptiveAnswer(session, 'Q_D3_2', false);
      expect(session.currentDifficulty).toBe(2);
      expect(session.consecutiveWrongAtCurrentDifficulty).toBe(0);

      // Two more consecutive mistakes decrease difficulty down to 1
      session = recordAdaptiveAnswer(session, 'Q_D2_1', false);
      expect(session.currentDifficulty).toBe(2);
      session = recordAdaptiveAnswer(session, 'Q_D2_2', false);
      expect(session.currentDifficulty).toBe(1);
    });

    it('never repeats a question within the same session', () => {
      let session = createAdaptiveSession('B1.1.1.1.1');
      const seenIds = new Set<string>();

      for (let i = 0; i < 4; i++) {
        const nextQ = getNextAdaptiveQuestion(sampleQuestions, session);
        if (!nextQ) break;
        expect(seenIds.has(nextQ.id)).toBe(false);
        seenIds.add(nextQ.id);
        session = recordAdaptiveAnswer(session, nextQ.id, true);
      }

      expect(seenIds.size).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Answer Evaluation & Input Validation', () => {
    it('validates MCQ answers and prevents submitting invalid choices', () => {
      const q = sampleQuestions[0]; // mcq with answer: 1

      // Missing input
      const emptyRes = evaluateAnswer(q, {});
      expect(emptyRes.valid).toBe(false);
      expect(emptyRes.validationError).toContain('Please select');

      // Correct choice
      const correctRes = evaluateAnswer(q, { selectedOption: 1 });
      expect(correctRes.valid).toBe(true);
      expect(correctRes.isCorrect).toBe(true);
      expect(correctRes.explanation).toBe('There are two apples.');

      // Wrong choice
      const wrongRes = evaluateAnswer(q, { selectedOption: 0 });
      expect(wrongRes.valid).toBe(true);
      expect(wrongRes.isCorrect).toBe(false);
    });

    it('validates numeric answers and accepts equivalent numeric formats (e.g. 5 vs 5.0)', () => {
      const q = sampleQuestions[1]; // numeric with answer: 5

      // Missing input
      expect(evaluateAnswer(q, { numericInput: '' }).valid).toBe(false);

      // Non-numeric text
      const invalidRes = evaluateAnswer(q, { numericInput: 'abc' });
      expect(invalidRes.valid).toBe(false);
      expect(invalidRes.validationError).toContain('not a valid number');

      // Integer "5"
      const res1 = evaluateAnswer(q, { numericInput: '5' });
      expect(res1.valid).toBe(true);
      expect(res1.isCorrect).toBe(true);

      // Float "5.0"
      const res2 = evaluateAnswer(q, { numericInput: '5.0' });
      expect(res2.valid).toBe(true);
      expect(res2.isCorrect).toBe(true);

      // Padded "  5  "
      const res3 = evaluateAnswer(q, { numericInput: '  5  ' });
      expect(res3.valid).toBe(true);
      expect(res3.isCorrect).toBe(true);

      // Wrong number "6"
      const res4 = evaluateAnswer(q, { numericInput: '6' });
      expect(res4.valid).toBe(true);
      expect(res4.isCorrect).toBe(false);
    });

    it('validates short answer questions with space trimming and case insensitivity', () => {
      const q = sampleQuestions[3]; // short_answer with ['eight', 'Eight', 'EIGHT']

      expect(evaluateAnswer(q, { shortAnswerInput: '' }).valid).toBe(false);

      const res1 = evaluateAnswer(q, { shortAnswerInput: 'eight' });
      expect(res1.isCorrect).toBe(true);

      const res2 = evaluateAnswer(q, { shortAnswerInput: '  EIGHT  ' });
      expect(res2.isCorrect).toBe(true);

      const res3 = evaluateAnswer(q, { shortAnswerInput: 'EiGhT' });
      expect(res3.isCorrect).toBe(true);

      const resWrong = evaluateAnswer(q, { shortAnswerInput: 'seven' });
      expect(resWrong.isCorrect).toBe(false);
    });
  });

  describe('Security Check: Question Sanitization (Rule 2)', () => {
    it('removes answer and explanation before sending question to student', () => {
      const fullQ = sampleQuestions[0];
      const studentQ = sanitizeQuestionForStudent(fullQ);

      expect((studentQ as any).answer).toBeUndefined();
      expect((studentQ as any).explanation).toBeUndefined();
      expect(studentQ.stem).toBe(fullQ.stem);
      expect(studentQ.options).toEqual(fullQ.options);
      expect(studentQ.hints).toEqual(fullQ.hints);
    });
  });

  describe('Mastery Calculation (Configurable in ONE place)', () => {
    it('achieves mastery after 5 correct in a row', () => {
      const attempts: IndicatorAttemptRecord[] = [
        {
          questionId: '1',
          indicatorCode: 'B1.1.1.1.1',
          isCorrect: false,
          difficulty: 1,
          timestamp: '1',
        },
        {
          questionId: '2',
          indicatorCode: 'B1.1.1.1.1',
          isCorrect: true,
          difficulty: 1,
          timestamp: '2',
        },
        {
          questionId: '3',
          indicatorCode: 'B1.1.1.1.1',
          isCorrect: true,
          difficulty: 2,
          timestamp: '3',
        },
        {
          questionId: '4',
          indicatorCode: 'B1.1.1.1.1',
          isCorrect: true,
          difficulty: 2,
          timestamp: '4',
        },
        {
          questionId: '5',
          indicatorCode: 'B1.1.1.1.1',
          isCorrect: true,
          difficulty: 3,
          timestamp: '5',
        },
        {
          questionId: '6',
          indicatorCode: 'B1.1.1.1.1',
          isCorrect: true,
          difficulty: 4,
          timestamp: '6',
        },
      ];

      const mastery = calculateMastery('B1.1.1.1.1', attempts, DEFAULT_MASTERY_RULE);
      expect(mastery.isMastered).toBe(true);
      expect(mastery.status).toBe('mastered');
      expect(mastery.progressPercent).toBe(100);
      expect(mastery.consecutiveCorrect).toBe(5);
    });

    it('achieves mastery with 80% accuracy over 10 attempts even with an intermediate slip', () => {
      const attempts: IndicatorAttemptRecord[] = [
        {
          questionId: '1',
          indicatorCode: 'B1.1.1.1.1',
          isCorrect: true,
          difficulty: 1,
          timestamp: '1',
        },
        {
          questionId: '2',
          indicatorCode: 'B1.1.1.1.1',
          isCorrect: true,
          difficulty: 2,
          timestamp: '2',
        },
        {
          questionId: '3',
          indicatorCode: 'B1.1.1.1.1',
          isCorrect: true,
          difficulty: 2,
          timestamp: '3',
        },
        {
          questionId: '4',
          indicatorCode: 'B1.1.1.1.1',
          isCorrect: true,
          difficulty: 3,
          timestamp: '4',
        },
        {
          questionId: '5',
          indicatorCode: 'B1.1.1.1.1',
          isCorrect: false,
          difficulty: 4,
          timestamp: '5',
        },
        {
          questionId: '6',
          indicatorCode: 'B1.1.1.1.1',
          isCorrect: true,
          difficulty: 3,
          timestamp: '6',
        },
        {
          questionId: '7',
          indicatorCode: 'B1.1.1.1.1',
          isCorrect: true,
          difficulty: 3,
          timestamp: '7',
        },
        {
          questionId: '8',
          indicatorCode: 'B1.1.1.1.1',
          isCorrect: true,
          difficulty: 4,
          timestamp: '8',
        },
        {
          questionId: '9',
          indicatorCode: 'B1.1.1.1.1',
          isCorrect: true,
          difficulty: 4,
          timestamp: '9',
        },
        {
          questionId: '10',
          indicatorCode: 'B1.1.1.1.1',
          isCorrect: false,
          difficulty: 4,
          timestamp: '10',
        },
      ]; // 8 out of 10 = 80%

      const mastery = calculateMastery('B1.1.1.1.1', attempts, DEFAULT_MASTERY_RULE);
      expect(mastery.isMastered).toBe(true);
      expect(mastery.windowAccuracy).toBe(80);
      expect(mastery.progressPercent).toBe(100);
    });

    it('shows partial progress in progress bar when working towards mastery', () => {
      const attempts: IndicatorAttemptRecord[] = [
        {
          questionId: '1',
          indicatorCode: 'B1.1.1.1.1',
          isCorrect: true,
          difficulty: 1,
          timestamp: '1',
        },
        {
          questionId: '2',
          indicatorCode: 'B1.1.1.1.1',
          isCorrect: true,
          difficulty: 2,
          timestamp: '2',
        },
      ]; // 2 correct in a row out of 5 = 40%

      const mastery = calculateMastery('B1.1.1.1.1', attempts, DEFAULT_MASTERY_RULE);
      expect(mastery.isMastered).toBe(false);
      expect(mastery.status).toBe('in_progress');
      expect(mastery.consecutiveCorrect).toBe(2);
      expect(mastery.progressPercent).toBe(40);
    });
  });

  describe('Retakes and Score Separation (Rule 4)', () => {
    it('preserves attempt history across multiple retakes without overwriting', () => {
      const testStudent = 'test_student_123';
      const att1 = savePracticeAttempt({
        studentId: testStudent,
        indicatorCode: 'B1.1.1.1.1',
        subject: 'Mathematics',
        level: 'Basic 1',
        category: 'auto',
        score: 50,
        correctCount: 2,
        totalCount: 4,
        questions: [],
      });

      const att2 = savePracticeAttempt({
        studentId: testStudent,
        indicatorCode: 'B1.1.1.1.1',
        subject: 'Mathematics',
        level: 'Basic 1',
        category: 'auto',
        score: 100,
        correctCount: 4,
        totalCount: 4,
        questions: [],
      });

      const history = loadPracticeHistory(testStudent);
      expect(history.length).toBeGreaterThanOrEqual(2);
      expect(history.map((h) => h.id)).toContain(att1.id);
      expect(history.map((h) => h.id)).toContain(att2.id);
    });

    it('keeps auto-scored results and teacher-marked results strictly separated', () => {
      const testStudent = 'test_student_sep';
      savePracticeAttempt({
        studentId: testStudent,
        indicatorCode: 'B1.1.1.1.1',
        subject: 'Mathematics',
        level: 'Basic 1',
        category: 'auto',
        score: 75,
        correctCount: 3,
        totalCount: 4,
        questions: [],
      });

      savePracticeAttempt({
        studentId: testStudent,
        indicatorCode: 'B1.1.1.1.1',
        subject: 'Mathematics',
        level: 'Basic 1',
        category: 'teacher',
        score: 90,
        correctCount: 1,
        totalCount: 1,
        questions: [],
      });

      const attempts = getIndicatorAttempts('B1.1.1.1.1', testStudent);
      expect(attempts.autoMarked).toHaveLength(1);
      expect(attempts.autoMarked[0].score).toBe(75);

      expect(attempts.teacherMarked).toHaveLength(1);
      expect(attempts.teacherMarked[0].score).toBe(90);

      // Verify they are never combined into a single number
      expect(attempts.autoMarked[0].category).toBe('auto');
      expect(attempts.teacherMarked[0].category).toBe('teacher');
    });
  });
});
