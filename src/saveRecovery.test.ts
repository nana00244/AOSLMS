import { describe, it, expect } from 'vitest';
import { emptyState } from './emptyState';
import { mergeSavedValue, rebaseChanges, overlayChanges } from './saveRecovery';
describe('durable save reconciliation', () => {
  it('merges independent fields and never overwrites a concurrent mark silently', () => {
    expect(
      mergeSavedValue(
        { score: 10, remark: '' },
        { score: 12, remark: '' },
        { score: 10, remark: 'Keep' },
        'grade',
      ),
    ).toEqual({ score: 12, remark: 'Keep' });
    expect(() => mergeSavedValue({ score: 10 }, { score: 12 }, { score: 14 }, 'grade')).toThrow(
      'Conflict:',
    );
    expect(
      mergeSavedValue(
        { score: 10, remark: '' },
        { score: 12, remark: '' },
        { score: 14, remark: 'Keep' },
        'grade',
        true,
      ),
    ).toEqual({ score: 12, remark: 'Keep' });
  });
  it('recognizes already-applied changes after a lost response', () => {
    const state = emptyState();
    state.remarks['student|1'] = 'Saved';
    expect(
      rebaseChanges(state, [{ collection: 'remarks', id: 'student|1', after: 'Saved' }]),
    ).toEqual([]);
  });
  it('preserves pending entries over refreshed cloud data without creating demo records', () => {
    const state = emptyState();
    const next = overlayChanges(state, [
      { collection: 'remarks', id: 'student|1', after: 'Retained offline' },
    ]);
    expect(next.remarks['student|1']).toBe('Retained offline');
    expect(state.remarks).toEqual({});
    expect(next.students).toEqual([]);
    expect(next.assignments).toEqual([]);
    expect(next.classes).toEqual([]);
    expect(next.settings.year).toBe('');
  });
  it('detects deletion conflicts and preserves unrelated nested score slots', () => {
    const before = { slotScores: { s1: { EXE1: { score: 5 }, EXE2: { score: 6 } } } };
    const after = { slotScores: { s1: { EXE1: { score: 9 }, EXE2: { score: 6 } } } };
    const current = { slotScores: { s1: { EXE1: { score: 5 }, EXE2: { score: 12 } } } };
    expect(mergeSavedValue(before, after, current, 'assignment')).toEqual({
      slotScores: { s1: { EXE1: { score: 9 }, EXE2: { score: 12 } } },
    });
    expect(() => mergeSavedValue(before, undefined, current, 'assignment')).toThrow('Conflict:');
  });
});
