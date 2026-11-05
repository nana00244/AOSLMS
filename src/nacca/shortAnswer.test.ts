import { describe, expect, it } from 'vitest';
import { naccaQuestions } from '../learningHub/naccaBank';
import { evaluateAnswer } from './answerChecker';

const questions = naccaQuestions.filter((q) => q.type === 'short_answer');
describe('short-answer marking across the published bank', () => {
  it('accepts every published short-answer key', () => {
    for (const question of questions) {
      const keys = Array.isArray(question.answer) ? question.answer : [question.answer];
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
