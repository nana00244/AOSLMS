import basicFour from './computingB4Bank.json' with { type: 'json' };
import basicFive from './computingB5Bank.json' with { type: 'json' };
import basicSix from './computingB6Bank.json' with { type: 'json' };
import { readAuthoredBank } from './authoredBank.ts';

export const { indicators: computingIndicators, questions: computingQuestions } = readAuthoredBank(
  [...basicFour, ...basicFive, ...basicSix],
  // The printed curriculum uses the mouse code again for the Recycle Bin.
  (i) =>
    i.code === 'B6.1.1.1.3' && /trash|recycle/i.test(i.objective ?? '')
      ? i.code + ' (Recycle Bin)'
      : i.code,
);
