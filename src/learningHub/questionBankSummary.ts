import type { NaccaIndicator, NaccaQuestion } from '../nacca/types';
import { compareHubLevels, compareHubSubjects, displayHubLevel } from './displayOrder';

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
        ...indicators.map((indicator) => displayHubLevel(indicator.level)),
        ...questions.map((question) => displayHubLevel(question.level)),
      ]),
    ].sort(compareHubLevels),
  };
}
