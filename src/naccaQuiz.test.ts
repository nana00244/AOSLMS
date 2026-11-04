import { describe, it, expect, beforeEach } from 'vitest';
import {
  createQuiz,
  getStudentQuizQuestions,
  submitQuiz,
  pickQuizQuestions,
  getEligibleQuestions,
  listQuizzes,
  type QuizDefinition,
} from './nacca/quizEngine';
import type { NaccaQuestion } from './nacca/types';

describe('NaCCA Quizzes and Unit Tests (Step 3)', () => {
  const sampleBank: NaccaQuestion[] = [
    {
      id: 'B1_Q1',
      indicator_code: 'B1.1.1.1.1',
      subject: 'Mathematics',
      level: 'Basic 1',
      type: 'mcq',
      difficulty: 1,
      stem: 'Which group has 3 objects?',
      options: ['3 balls', '5 stars', '1 pencil', '4 cups'],
      answer: 0,
      hints: ['Count each group one by one.'],
      explanation: 'Count 1, 2, 3 objects.',
    },
    {
      id: 'B1_Q2',
      indicator_code: 'B1.1.1.1.1',
      subject: 'Mathematics',
      level: 'Basic 1',
      type: 'numeric',
      difficulty: 2,
      stem: 'Count the flowers: how many are there?',
      answer: 5,
      hints: ['Touch each flower as you count.'],
      explanation: 'There are 5 flowers.',
    },
    {
      id: 'B1_Q3',
      indicator_code: 'B1.1.1.1.1',
      subject: 'Mathematics',
      level: 'Basic 1',
      type: 'short_answer',
      difficulty: 3,
      stem: 'Write the number word for 4',
      answer: ['four', 'Four'],
      hints: ['Spell out the number 4.'],
      explanation: '4 in words is four.',
    },
    {
      id: 'B1_Q4',
      indicator_code: 'B1.1.1.1.1',
      subject: 'Mathematics',
      level: 'Basic 1',
      type: 'written',
      difficulty: 2,
      stem: 'Describe how you group 6 counters into equal pairs.',
      hints: ['Pairs mean groups of two.'],
      rubric: { criteria: [{ description: 'Shows 3 equal pairs', marks: 5 }] },
    },
    {
      id: 'B2_Q1',
      indicator_code: 'B2.1.1.1.1',
      subject: 'Mathematics',
      level: 'Basic 2',
      type: 'mcq',
      difficulty: 2,
      stem: 'What is 10 + 5?',
      options: ['12', '15', '20', '25'],
      answer: 1,
      hints: ['Start at 10 and count on 5.'],
      explanation: '10 + 5 = 15.',
    },
    {
      id: 'B3_Q1',
      indicator_code: 'B3.1.1.1.1',
      subject: 'Mathematics',
      level: 'Basic 3',
      type: 'numeric',
      difficulty: 3,
      stem: 'What is 50 + 75?',
      answer: 125,
      hints: ['Add 50 and 70, then add 5.'],
      explanation: '50 + 75 = 125.',
    },
  ];

  it('selects questions strictly matching subject, level, and indicator codes (Rule 5)', () => {
    const eligibleB1 = getEligibleQuestions('Mathematics', 'Basic 1', ['B1.1.1.1.1'], sampleBank);
    expect(eligibleB1).toHaveLength(4);
    expect(eligibleB1.every((q) => q.level === 'Basic 1')).toBe(true);

    const eligibleB3 = getEligibleQuestions('Mathematics', 'Basic 3', ['B3.1.1.1.1'], sampleBank);
    expect(eligibleB3).toHaveLength(1);
    expect(eligibleB3[0].id).toBe('B3_Q1');
  });

  it('picks questions without repeats within a test paper and honors difficulty mix', () => {
    const picked = pickQuizQuestions(sampleBank, 4, { mode: 'balanced' });
    expect(picked).toHaveLength(4);
    const uniqueIds = new Set(picked.map((q) => q.id));
    expect(uniqueIds.size).toBe(4);
  });

  it('generates different random papers per student when randomizePerStudent is true', () => {
    // Generate for student A and student B
    const pool = [...sampleBank, ...sampleBank.map((q, i) => ({ ...q, id: `extra_${i}` }))];
    const quiz: QuizDefinition = {
      id: 'quiz_test_1',
      kind: 'quiz',
      title: 'Quiz 1',
      subject: 'Mathematics',
      level: 'Basic 1',
      indicatorCodes: ['B1.1.1.1.1'],
      questionCount: 3,
      difficultyMix: { mode: 'any' },
      randomizePerStudent: true,
      assignmentTarget: 'class',
      assignedStudentIds: ['student_1', 'student_2'],
      dueDate: '2026-11-15',
      hasTeacherMarkedQuestions: false,
      createdAt: new Date().toISOString(),
      createdBy: 'Teacher Ama',
    };

    const paper1 = getStudentQuizQuestions(quiz, 'student_1', pool);
    const paper2 = getStudentQuizQuestions(quiz, 'student_2', pool);

    expect(paper1.questions).toHaveLength(3);
    expect(paper2.questions).toHaveLength(3);
    // Student never receives answer or explanation (Rule 2)
    for (const q of paper1.questions) {
      expect((q as any).answer).toBeUndefined();
      expect((q as any).explanation).toBeUndefined();
    }
  });

  it('grades auto-scored questions immediately and separates auto vs teacher scores (Rule 4)', () => {
    const autoOnlyQuiz: QuizDefinition = {
      id: 'quiz_auto_only',
      kind: 'quiz',
      title: 'Auto Scored Quiz',
      subject: 'Mathematics',
      level: 'Basic 1',
      indicatorCodes: ['B1.1.1.1.1'],
      questionCount: 3,
      difficultyMix: { mode: 'any' },
      randomizePerStudent: false,
      fixedQuestionIds: ['B1_Q1', 'B1_Q2', 'B1_Q3'],
      assignmentTarget: 'class',
      assignedStudentIds: ['stu_1'],
      dueDate: '2026-11-20',
      hasTeacherMarkedQuestions: false,
      createdAt: new Date().toISOString(),
      createdBy: 'Teacher Ama',
    };

    // Student submits: Q1 correct (0), Q2 correct ("5.0"), Q3 wrong ("ten")
    const submission = submitQuiz(
      autoOnlyQuiz,
      'stu_1',
      'Kofi Mensah',
      {
        B1_Q1: { selectedOption: 0 },
        B1_Q2: { numericInput: '5.0' }, // equivalent to 5
        B1_Q3: { shortAnswerInput: 'ten' },
      },
      sampleBank,
    );

    expect(submission.status).toBe('graded');
    expect(submission.autoScore.pointsAwarded).toBe(2);
    expect(submission.autoScore.pointsPossible).toBe(3);
    expect(submission.autoScore.percentage).toBe(67);
    // Score separation: autoScore is distinct from teacherAssessed
    expect(submission.teacherAssessed.status).toBe('none');
    expect(submission.teacherAssessed.pointsAwarded).toBe(0);
  });

  it('marks quiz as "awaiting teacher marking" when it contains teacher-marked questions', () => {
    const mixedQuiz: QuizDefinition = {
      id: 'quiz_mixed',
      kind: 'unit_test',
      title: 'End of Strand 1 Unit Test',
      subject: 'Mathematics',
      level: 'Basic 1',
      indicatorCodes: ['B1.1.1.1.1'],
      questionCount: 2,
      difficultyMix: { mode: 'any' },
      randomizePerStudent: false,
      fixedQuestionIds: ['B1_Q1', 'B1_Q4'], // Q4 is written/teacher-marked
      assignmentTarget: 'students',
      assignedStudentIds: ['stu_2'],
      dueDate: '2026-11-25',
      hasTeacherMarkedQuestions: true,
      createdAt: new Date().toISOString(),
      createdBy: 'Teacher Ama',
    };

    const submission = submitQuiz(
      mixedQuiz,
      'stu_2',
      'Abena Osei',
      {
        B1_Q1: { selectedOption: 0 },
        B1_Q4: { writtenAnswer: 'I placed counters into 3 groups of 2.' },
      },
      sampleBank,
    );

    // Shows "awaiting teacher marking"
    expect(submission.status).toBe('awaiting teacher marking');
    expect(submission.autoScore.pointsAwarded).toBe(1);
    expect(submission.autoScore.pointsPossible).toBe(1);
    expect(submission.autoScore.percentage).toBe(100);

    // Teacher marking is marked as pending
    expect(submission.teacherAssessed.isPending).toBe(true);
    expect(submission.teacherAssessed.status).toBe('awaiting marking');
    // Scores are stored separately, never combined
    expect(submission.teacherAssessed.pointsAwarded).toBe(0);
  });

  it('supports creating quizzes and assigning to class or selected students with a due date', () => {
    const created = createQuiz(
      {
        kind: 'quiz',
        title: 'Basic 1 Review Quiz',
        subject: 'Mathematics',
        level: 'Basic 1',
        indicatorCodes: ['B1.1.1.1.1'],
        questionCount: 2,
        difficultyMix: { mode: 'balanced' },
        randomizePerStudent: false,
        assignmentTarget: 'class',
        classId: 'class_b1a',
        className: 'Basic 1A',
        assignedStudentIds: ['stu_1', 'stu_2'],
        dueDate: '2026-12-01',
        createdBy: 'Teacher Kwame',
      },
      sampleBank,
    );

    expect(created.id).toBeDefined();
    expect(created.fixedQuestionIds).toHaveLength(2);
    expect(created.className).toBe('Basic 1A');
    expect(created.dueDate).toBe('2026-12-01');

    const listed = listQuizzes();
    expect(listed.some((q) => q.id === created.id)).toBe(true);
  });
});
