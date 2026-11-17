import basicFour from './computingB4Bank.json' with { type: 'json' };
import basicFive from './computingB5Bank.json' with { type: 'json' };
import basicSix from './computingB6Bank.json' with { type: 'json' };
import type { NaccaIndicator, NaccaQuestion } from '../nacca/types.ts';
import { indicatorLessonId } from './indicatorLessonId.ts';

interface ComputingEntry {
  indicator: NaccaIndicator;
  spec: NonNullable<NaccaIndicator['spec']>;
  questions: (Omit<NaccaQuestion, 'id' | 'subject' | 'level' | 'indicator_code'> & {
    check?: string;
  })[];
  uncertain?: string[];
}

const banks = [basicFour, basicFive, basicSix] as unknown as ComputingEntry[][];
export const computingIndicators: NaccaIndicator[] = [];
export const computingQuestions: NaccaQuestion[] = [];

for (const [index, bank] of banks.entries()) {
  for (const { indicator, spec, questions } of bank) {
    // The printed curriculum gives the mouse and Recycle Bin objectives the same code.
    const code =
      indicator.code === 'B6.1.1.1.3' && /trash|recycle/i.test(indicator.objective ?? '')
        ? indicator.code + ' (Recycle Bin)'
        : indicator.code;
    const level = 'Basic ' + (index + 4);
    computingIndicators.push({ ...indicator, code, level, spec });
    const lessonId = indicatorLessonId('Computing', code);
    for (const [i, { check, ...question }] of questions.entries()) {
      computingQuestions.push({
        ...question,
        id: lessonId + '-q' + (i + 1),
        indicator_code: code,
        subject: 'Computing',
        level,
        strand: indicator.strand,
        sub_strand: indicator.sub_strand,
        objective: indicator.objective,
        ...(check ? { check_formula: check } : {}),
      });
    }
  }
}
