import { describe, expect, it } from 'vitest';
import { matchesSelectedIndicators } from './questionBankFilters';

describe('question bank multi-indicator filtering', () => {
  it('keeps questions from any selected subject and indicator pair', () => {
    const selected = new Set(['English Language:B4.1.1.1', 'Mathematics:B4.1.1.1']);

    expect(
      matchesSelectedIndicators(
        { subject: 'English Language', indicator_code: 'B4.1.1.1' },
        selected,
      ),
    ).toBe(true);
    expect(
      matchesSelectedIndicators({ subject: 'Mathematics', indicator_code: 'B4.1.1.1' }, selected),
    ).toBe(true);
    expect(
      matchesSelectedIndicators({ subject: 'Science', indicator_code: 'B4.1.1.1' }, selected),
    ).toBe(false);
  });

  it('allows every indicator when no specific indicators are selected', () => {
    expect(
      matchesSelectedIndicators({ subject: 'Science', indicator_code: 'B4.1.1.1' }, new Set()),
    ).toBe(true);
  });
});
