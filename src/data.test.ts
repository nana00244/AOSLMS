import { describe, it, expect } from 'vitest';
import { gradeLetter, rank, ordinal, standing, conflicts, seed, billed, paid } from './data';
import { validateState } from './store';
describe('school calculations', () => {
  it('grades every boundary correctly', () => {
    expect([0, 39, 40, 49, 50, 59, 60, 69, 70, 79, 80, 100].map(gradeLetter)).toEqual([
      'F',
      'F',
      'E',
      'E',
      'D',
      'D',
      'C',
      'C',
      'B',
      'B',
      'A',
      'A',
    ]);
  });
  it('uses Excel RANK.EQ competition ranking for ties', () => {
    const values = [90, 90, 85, 75];
    expect(values.map((v) => rank(v, values))).toEqual([1, 1, 3, 4]);
    expect([1, 2, 3, 4, 11, 12, 13, 21].map(ordinal)).toEqual([
      '1st',
      '2nd',
      '3rd',
      '4th',
      '11th',
      '12th',
      '13th',
      '21st',
    ]);
  });
  it('checks attendance standing boundaries', () => {
    expect([95, 94, 85, 84, 75, 74].map(standing)).toEqual([
      'Excellent',
      'Good',
      'Good',
      'Warning',
      'Warning',
      'Critical',
    ]);
  });
  it('blocks overlapping teacher, classroom, and room bookings, but permits adjacent periods', () => {
    const a = seed().periods[0];
    expect(conflicts(a, { ...a, id: 'other', classId: 'Other', room: 'Other' })).toBe(true);
    expect(conflicts(a, { ...a, id: 'other', start: a.end, end: '10:00' })).toBe(false);
    expect(conflicts(a, { ...a, id: 'other', day: 'Friday' })).toBe(false);
  });
  it('computes term-specific balances', () => {
    const state = seed(),
      s = state.students[1];
    expect(billed(state, s)).toBe(520);
    expect(paid(state, s.id)).toBe(300);
    state.settings.term = 3;
    expect(paid(state, s.id)).toBe(0);
  });
  it('rejects malformed or orphaned backup records', () => {
    const state = seed();
    expect(validateState(state)).toBe(true);
    expect(validateState({ ...state, students: null })).toBe(false);
    expect(
      validateState({ ...state, payments: [{ ...state.payments[0], studentId: 'missing' }] }),
    ).toBe(false);
  });
  it('supports dynamic class addition, renaming and validation', () => {
    const state = seed();
    expect(state.classes).toBeDefined();
    expect(state.classes.length).toBeGreaterThan(0);

    // Add new class
    state.classes.push('Basic 5 - Diamond');
    state.students.push({
      id: 'AOS-2026-9999',
      name: 'Test Student',
      classId: 'Basic 5 - Diamond',
      gender: 'Female',
      dob: '2015-01-01',
      guardian: 'Parent',
      phone: '+233 20 000 0000',
      status: 'Active',
      enrolled: '2026-09-01',
    });

    expect(validateState(state)).toBe(true);
  });
});
