import type { NaccaQuestion } from './types';

export interface AdaptiveSessionState {
  indicatorCode: string;
  currentDifficulty: number;
  consecutiveWrongAtCurrentDifficulty: number;
  usedQuestionIds: Set<string>;
  answeredCount: number;
  correctCount: number;
  targetQuestionsCount: number;
}

export function createAdaptiveSession(
  indicatorCode: string,
  targetQuestionsCount = 4,
): AdaptiveSessionState {
  return {
    indicatorCode,
    currentDifficulty: 1, // Practice sessions start at difficulty 1
    consecutiveWrongAtCurrentDifficulty: 0,
    usedQuestionIds: new Set<string>(),
    answeredCount: 0,
    correctCount: 0,
    targetQuestionsCount,
  };
}

/**
 * Picks the next question adaptively from the question pool:
 * 1. Filters questions for the given indicator.
 * 2. Excludes any question already used in this session (no repetition within a session).
 * 3. Finds a question matching currentDifficulty.
 * 4. If none available at currentDifficulty, finds the closest available difficulty (preferring lower, then higher).
 */
export function getNextAdaptiveQuestion(
  pool: NaccaQuestion[],
  state: AdaptiveSessionState,
): NaccaQuestion | null {
  const eligible = pool.filter(
    (q) =>
      q.indicator_code === state.indicatorCode &&
      !state.usedQuestionIds.has(q.id) &&
      ['mcq', 'numeric', 'short_answer'].includes(q.type),
  );

  if (eligible.length === 0) {
    return null;
  }

  // Exact difficulty match
  const exact = eligible.filter((q) => q.difficulty === state.currentDifficulty);
  if (exact.length > 0) {
    // Return first available (or could be deterministic index)
    return exact[0];
  }

  // Nearest difficulty fallback
  const sortedByDiffDist = [...eligible].sort((a, b) => {
    const distA = Math.abs(a.difficulty - state.currentDifficulty);
    const distB = Math.abs(b.difficulty - state.currentDifficulty);
    if (distA !== distB) return distA - distB;
    return a.difficulty - b.difficulty;
  });

  return sortedByDiffDist[0];
}

/**
 * Updates adaptive session state after an answer is submitted:
 * - If correct: difficulty moves up (max 4), reset wrong counter
 * - If incorrect: tracks mistakes. If repeated mistakes (>= 2) or difficulty > 1, moves down (min 1)
 */
export function recordAdaptiveAnswer(
  state: AdaptiveSessionState,
  questionId: string,
  isCorrect: boolean,
): AdaptiveSessionState {
  const nextUsed = new Set(state.usedQuestionIds);
  nextUsed.add(questionId);

  let nextDifficulty = state.currentDifficulty;
  let nextConsecutiveWrong = state.consecutiveWrongAtCurrentDifficulty;

  if (isCorrect) {
    // Move up as the student answers correctly (max difficulty 4)
    nextDifficulty = Math.min(4, state.currentDifficulty + 1);
    nextConsecutiveWrong = 0;
  } else {
    // Move down after repeated mistakes (2 consecutive wrong)
    nextConsecutiveWrong += 1;
    if (nextConsecutiveWrong >= 2) {
      nextDifficulty = Math.max(1, state.currentDifficulty - 1);
      nextConsecutiveWrong = 0;
    }
  }

  return {
    ...state,
    usedQuestionIds: nextUsed,
    currentDifficulty: nextDifficulty,
    consecutiveWrongAtCurrentDifficulty: nextConsecutiveWrong,
    answeredCount: state.answeredCount + 1,
    correctCount: isCorrect ? state.correctCount + 1 : state.correctCount,
  };
}
