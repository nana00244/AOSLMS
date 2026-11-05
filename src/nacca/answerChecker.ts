import { matchesShortAnswer } from './shortAnswer';
import type { NaccaQuestion, StudentNaccaQuestion } from './types';

export interface CheckAnswerResult {
  valid: boolean;
  validationError?: string;
  isCorrect?: boolean;
  explanation?: string;
  feedback?: string;
}

/**
 * Strips the `answer` and `explanation` fields from a question so students
 * cannot inspect them via DevTools/Network before submitting (Rule 2).
 */
export function sanitizeQuestionForStudent(q: NaccaQuestion): StudentNaccaQuestion {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { answer, explanation, ...safeQuestion } = q;
  return safeQuestion;
}

/**
 * Validates and checks a student's answer against the canonical question record.
 * Supports:
 * - mcq: selected index 0-3
 * - numeric: numeric value, accepting equivalents like "5" and "5.0"
 * - short_answer: text input, trimmed and case-insensitive check against accepted answers array
 */
export function evaluateAnswer(
  question: NaccaQuestion,
  submission: {
    selectedOption?: number;
    numericInput?: string;
    shortAnswerInput?: string;
  },
): CheckAnswerResult {
  if (!question) {
    return { valid: false, validationError: 'Question not found' };
  }

  // 1. MCQ
  if (question.type === 'mcq') {
    const selected = submission.selectedOption;
    if (selected === undefined || selected === null) {
      return {
        valid: false,
        validationError: 'Please select one of the choices before checking.',
      };
    }

    if (
      !Number.isInteger(selected) ||
      selected < 0 ||
      selected >= (question.options?.length || 4)
    ) {
      return {
        valid: false,
        validationError: 'Invalid choice selected.',
      };
    }

    const isCorrect = selected === question.answer;
    return {
      valid: true,
      isCorrect,
      explanation: question.explanation,
      feedback: isCorrect ? 'Correct! Excellent work.' : 'Not quite. Review the explanation below.',
    };
  }

  // 2. Numeric
  if (question.type === 'numeric') {
    const rawVal = submission.numericInput?.trim();
    if (!rawVal || rawVal === '') {
      return {
        valid: false,
        validationError: 'Please enter a number before checking.',
      };
    }

    // Check if the input is a valid numeric string
    const studentNum = Number(rawVal);
    if (Number.isNaN(studentNum)) {
      return {
        valid: false,
        validationError: `"${rawVal}" is not a valid number. Please enter digits only (e.g. 5, 12, 3.5).`,
      };
    }

    const expectedNum = Number(question.answer);
    if (Number.isNaN(expectedNum)) {
      return {
        valid: false,
        validationError: 'Question answer configuration error.',
      };
    }

    // Floating-point safe comparison accepting "5" and "5.0"
    const isCorrect = Math.abs(studentNum - expectedNum) < 1e-6;

    return {
      valid: true,
      isCorrect,
      explanation: question.explanation,
      feedback: isCorrect
        ? 'Correct! Well done.'
        : `Not quite. Review the step-by-step explanation below.`,
    };
  }

  // 3. Short Answer
  if (question.type === 'short_answer') {
    const rawVal = submission.shortAnswerInput?.trim();
    if (!rawVal || rawVal === '') {
      return {
        valid: false,
        validationError: 'Please type an answer before checking.',
      };
    }

    const isCorrect = matchesShortAnswer(question, rawVal);

    return {
      valid: true,
      isCorrect,
      explanation: question.explanation,
      feedback: isCorrect
        ? 'Correct! Great job.'
        : 'Not quite. Check the accepted answers in the explanation.',
    };
  }

  // Teacher tasks (written, oral, drawing, practical) - marked by teacher only
  return {
    valid: true,
    isCorrect: undefined,
    explanation: question.explanation,
    feedback: 'Task submitted for teacher review.',
  };
}
