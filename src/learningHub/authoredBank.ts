import type { NaccaIndicator, NaccaQuestion } from '../nacca/types.ts';
import { indicatorLessonId } from './indicatorLessonId.ts';

interface Entry {
  indicator: NaccaIndicator;
  spec: NonNullable<NaccaIndicator['spec']>;
  uncertain?: string[];
  questions: (Omit<NaccaQuestion, 'id' | 'subject' | 'level' | 'indicator_code'> & {
    check?: string;
  })[];
}

export function readAuthoredBank(
  entries: readonly unknown[],
  practiceCode: (i: NaccaIndicator) => string,
) {
  const indicators: NaccaIndicator[] = [];
  const questions: NaccaQuestion[] = [];
  for (const { indicator, spec, uncertain, questions: items } of entries as Entry[]) {
    const { subject, level, strand, sub_strand, objective } = indicator;
    const code = practiceCode(indicator);
    indicators.push({
      ...indicator,
      code,
      spec,
      ...(uncertain?.length && { sourceNotes: uncertain }),
    });
    const lessonId = indicatorLessonId(subject, code);
    for (const [index, { check, ...question }] of items.entries()) {
      questions.push({
        ...question,
        id: lessonId + '-q' + (index + 1),
        indicator_code: code,
        subject,
        level,
        strand,
        sub_strand,
        objective,
        ...(check ? { check_formula: check } : {}),
      });
    }
  }
  return { indicators, questions };
}
