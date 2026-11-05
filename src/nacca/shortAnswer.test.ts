import { describe, expect, it } from 'vitest';
import { naccaQuestions } from '../learningHub/naccaBank';
import { evaluateAnswer } from './answerChecker';

const questions = naccaQuestions.filter((q) => q.type === 'short_answer');
describe('short-answer marking across the published bank', () => {
  it('checks every published short-answer key, combining individual examples when several are required', () => {
    for (const question of questions) {
      const keys = Array.isArray(question.answer) ? question.answer : [question.answer];
      const count = question.stem.match(/^(?:name|list) (two|three) /i);
      const individualItems = count && keys.every((key) => !/\band\b|[,;+\d]/i.test(String(key)));
      if (individualItems) {
        const required = count[1] === 'two' ? 2 : 3;
        for (const key of keys) {
          expect(
            evaluateAnswer(question, { shortAnswerInput: String(key) }).isCorrect,
            question.id,
          ).toBe(false);
        }
        const examples = [
          ...new Set(
            keys.map((key) =>
              String(key)
                .replace(/^(roots|flowers)$/, (word) => word.slice(0, -1))
                .replace(/^leaves$/, 'leaf'),
            ),
          ),
        ];
        expect(
          evaluateAnswer(question, { shortAnswerInput: examples.slice(0, required).join(' and ') })
            .isCorrect,
          question.id,
        ).toBe(true);
        continue;
      }
      for (const key of keys) {
        expect(
          evaluateAnswer(question, { shortAnswerInput: String(key) }).isCorrect,
          question.id,
        ).toBe(true);
      }
    }
  });

  const effect = questions.find((q) => q.stem === 'State one effect of climate change on humans.')!;
  it.each([
    'it causes famine',
    'Climate change can lead to famine.',
    'People may suffer from illness.',
    'There can be food scarcity.',
  ])('credits %s', (response) => {
    expect(evaluateAnswer(effect, { shortAnswerInput: response }).isCorrect).toBe(true);
  });
  it.each([
    'it prevents famine',
    'it does not cause famine',
    'climate change is caused by famine',
    'heat',
    'it causes famine or nothing',
  ])('rejects %s', (response) => {
    expect(evaluateAnswer(effect, { shortAnswerInput: response }).isCorrect).toBe(false);
  });
});

it.each([
  ['Name two parts of a plant.', 'A bud and a leaf', true],
  ['Name two things a seed needs to germinate.', 'water and moisture', false],
  ['Write a comparison statement for 15 and 10 using <, >, or =.', '10 < 15', true],
  ['Write a comparison statement for 15 and 10 using <, >, or =.', '10 > 15', false],
  [
    'A pupil has 4 groups of 3. Write the multiplication sentence and the total.',
    '4 × 3 = 12',
    true,
  ],
  ['Name one place you might see a graph outside of school.', 'a weather app', true],
  ['Name two parts of a plant.', 'roots and root', false],
  ['Name two parts of a plant.', 'root and battery', false],
  [
    'Name two appliances in your home that use electricity.',
    'A microwave and an electric cooker',
    true,
  ],
  ['Name two examples of habitats.', 'a desert and a wetland', true],
  ['What is a habitat?', 'A habitat is the environment where an animal lives.', true],
  ['What is respiration?', 'Cells release energy from glucose.', true],
  ['What is a multiple?', 'A multiple is the product of a number and a whole number.', true],
  ['What is friction?', 'Friction is a force that resists motion between touching surfaces.', true],
  ['What is friction?', 'A force that helps motion between touching surfaces.', false],
  ['What is the function of the windpipe?', 'The windpipe takes air into our lungs.', true],
  [
    'What is the function of the windpipe?',
    'The windpipe takes air from our lungs into our nose.',
    false,
  ],
  ['What is ductility?', 'A metal can be stretched into a thin wire.', true],
  ['What is ductility?', 'A metal cannot be stretched into a thin wire.', false],
  ['Write the Roman numeral for 14.', 'XVI', false],
])('%s — %s', (stem, response, expected) => {
  const question = questions.find((q) => q.stem === stem)!;
  expect(evaluateAnswer(question, { shortAnswerInput: String(response) }).isCorrect).toBe(expected);
});
