import type { NaccaIndicator, NaccaQuestion } from '../nacca/types';
import { compareHubLevels, compareHubSubjects, displayHubLevel } from './displayOrder';

export function displayQuestionBankLevel(level: string): string {
  const normalized = level.trim();
  const jhsMatch = normalized.match(/^(?:B([789])(?:\s*·\s*JHS\s*\d+)?|JHS\s*([123]))$/i);
  if (jhsMatch) return `JHS ${jhsMatch[2] || Number(jhsMatch[1]) - 6}`;
  return displayHubLevel(level);
}

export interface QuestionBankSummary {
  questionCount: number;
  indicatorCount: number;
  subjects: string[];
  levels: string[];
}

export function summarizeQuestionBank(
  questions: NaccaQuestion[],
  indicators: NaccaIndicator[],
): QuestionBankSummary {
  return {
    questionCount: questions.length,
    indicatorCount: indicators.length,
    subjects: [
      ...new Set([
        ...indicators.map((indicator) => indicator.subject),
        ...questions.map((question) => question.subject),
      ]),
    ].sort(compareHubSubjects),
    levels: [
      ...new Set([
        ...indicators.map((indicator) => displayQuestionBankLevel(indicator.level)),
        ...questions.map((question) => displayQuestionBankLevel(question.level)),
      ]),
    ].sort(compareHubLevels),
  };
}
