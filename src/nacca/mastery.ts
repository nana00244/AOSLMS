/**
 * NaCCA Curriculum Mastery Calculation Rules (Step 2)
 *
 * Configurable in ONE place as required by the specification:
 * - "Mastered after 5 correct in a row, or 80% over the last 10 attempts."
 * - Can be adjusted here without touching UI or database components.
 */

export interface MasteryRuleConfig {
  /** Number of consecutive correct questions required to achieve mastery */
  consecutiveCorrectRequired: number;
  /** Size of recent attempt sliding window */
  windowAttempts: number;
  /** Percentage accuracy (0.0 to 1.0) needed within the window */
  windowAccuracyThreshold: number;
}

export const DEFAULT_MASTERY_RULE: MasteryRuleConfig = {
  consecutiveCorrectRequired: 5,
  windowAttempts: 10,
  windowAccuracyThreshold: 0.8, // 80%
};

export type MasteryStatus = 'not_started' | 'in_progress' | 'mastered';

export interface IndicatorAttemptRecord {
  id?: string;
  questionId: string;
  indicatorCode: string;
  isCorrect: boolean;
  difficulty: number;
  timestamp: string;
}

export interface MasteryResult {
  indicatorCode: string;
  status: MasteryStatus;
  isMastered: boolean;
  progressPercent: number; // 0 to 100 for progress bar
  consecutiveCorrect: number;
  consecutiveRequired: number;
  windowAccuracy: number; // 0 to 100
  windowAttempts: number;
  totalAttempts: number;
  totalCorrect: number;
}

/**
 * Computes mastery status for an indicator given a sequence of student attempts.
 * Attempts should be sorted chronologically (oldest to newest).
 */
export function calculateMastery(
  indicatorCode: string,
  attempts: IndicatorAttemptRecord[],
  config: MasteryRuleConfig = DEFAULT_MASTERY_RULE,
): MasteryResult {
  if (!attempts || attempts.length === 0) {
    return {
      indicatorCode,
      status: 'not_started',
      isMastered: false,
      progressPercent: 0,
      consecutiveCorrect: 0,
      consecutiveRequired: config.consecutiveCorrectRequired,
      windowAccuracy: 0,
      windowAttempts: 0,
      totalAttempts: 0,
      totalCorrect: 0,
    };
  }

  // 1. Calculate consecutive correct from the end of the history
  let consecutive = 0;
  for (let i = attempts.length - 1; i >= 0; i--) {
    if (attempts[i].isCorrect) {
      consecutive++;
    } else {
      break;
    }
  }

  // 2. Calculate accuracy over recent window (last N attempts)
  const windowSlice = attempts.slice(-config.windowAttempts);
  const windowCorrect = windowSlice.filter((a) => a.isCorrect).length;
  const windowAccuracy = windowSlice.length > 0 ? windowCorrect / windowSlice.length : 0;

  // 3. Check mastery criteria: 5 correct in a row OR 80% over last 10
  const masteredByStreak = consecutive >= config.consecutiveCorrectRequired;
  const masteredByWindow =
    windowSlice.length >= config.windowAttempts && windowAccuracy >= config.windowAccuracyThreshold;

  const isMastered = masteredByStreak || masteredByWindow;

  // 4. Progress percentage for the simple progress bar:
  // Take whichever path is closer to completion
  const streakProgress = Math.min(
    100,
    Math.round((consecutive / config.consecutiveCorrectRequired) * 100),
  );
  // Target correct count needed to reach the threshold in the window
  const targetWindowCorrect = Math.ceil(config.windowAttempts * config.windowAccuracyThreshold);
  const windowProgress = Math.min(100, Math.round((windowCorrect / targetWindowCorrect) * 100));
  const progressPercent = isMastered ? 100 : Math.max(streakProgress, windowProgress);

  const totalCorrect = attempts.filter((a) => a.isCorrect).length;

  return {
    indicatorCode,
    status: isMastered ? 'mastered' : progressPercent > 0 ? 'in_progress' : 'not_started',
    isMastered,
    progressPercent,
    consecutiveCorrect: consecutive,
    consecutiveRequired: config.consecutiveCorrectRequired,
    windowAccuracy: Math.round(windowAccuracy * 100),
    windowAttempts: windowSlice.length,
    totalAttempts: attempts.length,
    totalCorrect,
  };
}
