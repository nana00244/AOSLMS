import type { NaccaQuestion } from '../nacca/types';

export function questionIndicatorKey(subject: string, indicatorCode: string): string {
  return `${subject}:${indicatorCode}`;
}

export function matchesSelectedIndicators(
  question: Pick<NaccaQuestion, 'subject' | 'indicator_code'>,
  selectedIndicators: ReadonlySet<string>,
): boolean {
  return (
    selectedIndicators.size === 0 ||
    selectedIndicators.has(questionIndicatorKey(question.subject, question.indicator_code))
  );
}
