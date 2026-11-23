import basicOne from './historyB1Bank.json' with { type: 'json' };
import basicTwo from './historyB2Bank.json' with { type: 'json' };
import basicThree from './historyB3Bank.json' with { type: 'json' };
import basicFour from './historyB4Bank.json' with { type: 'json' };
import basicFive from './historyB5Bank.json' with { type: 'json' };
import basicSix from './historyB6Bank.json' with { type: 'json' };
import { readAuthoredBank } from './authoredBank.ts';

export const { indicators: historyIndicators, questions: historyQuestions } = readAuthoredBank(
  [...basicOne, ...basicTwo, ...basicThree, ...basicFour, ...basicFive, ...basicSix],
  // On printed page 10 the region and characteristics objectives have the same identifier.
  (i) =>
    i.code === 'B2.2.1.1.1' && /characteristics/i.test(i.objective ?? '')
      ? i.code + ' (Characteristics)'
      : i.code,
);
