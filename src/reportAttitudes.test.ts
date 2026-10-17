import { expect, test } from 'vitest';
import { attitudeItems, attitudeError, readAttitudes } from './reportAttitudes';
import { workspaceSchema } from './validation';
import { emptyState } from './emptyState';
import { applyChanges } from './backendAccess';
import { seed, type User } from './data';

test('all eight values round-trip through the shared server schema including ampersands', () => {
  const state = emptyState();
  const attitudes = Object.fromEntries(attitudeItems.map(({ key, options }) => [key, options[0]]));
  state.conduct['pupil|1'] = { attitudes };
  const stored = workspaceSchema.parse(JSON.parse(JSON.stringify(state)));
  expect(stored.conduct['pupil|1'].attitudes).toEqual(attitudes);
  expect(readAttitudes(state.conduct['pupil|2'])).toEqual(
    Object.fromEntries(attitudeItems.map(({ key }) => [key, ''])),
  );
});

test('blank, omitted and null attitudes preserve old reports', () => {
  for (const attitudes of [undefined, null, {}, { conduct: '', neatness: 'TIDY' }]) {
    const state = emptyState();
    state.conduct['pupil|1'] = { attitudes, attendanceTotal: '60' };
    expect(workspaceSchema.safeParse(state).success).toBe(true);
  }
  expect(Object.values(readAttitudes())).toEqual(Array(8).fill(''));
});

test('unknown keys, words, cross-item choices and non-string values are rejected', () => {
  for (const attitudes of [
    { oops: 'EXEMPLARY' },
    { conduct: 'excellent' },
    { conduct: 'FLUENT' },
    { conduct: 42 },
    [],
    'EXEMPLARY',
  ]) {
    expect(attitudeError(attitudes)).toBeTruthy();
    const state = emptyState();
    (state.conduct as any)['pupil|1'] = { attitudes };
    expect(workspaceSchema.safeParse(state).success).toBe(false);
  }
});

test('legacy and obsolete values stay visible while explicit blanks do not resurrect old text', () => {
  expect(readAttitudes({ Conduct: 'Old value' }).conduct).toBe('Old value');
  expect(readAttitudes({ attitudes: { conduct: 'Removed option' } }).conduct).toBe(
    'Removed option',
  );
  expect(readAttitudes({ Conduct: 'EXEMPLARY', attitudes: { conduct: '' } }).conduct).toBe('');
});

test('existing report editing permissions apply to attitude changes', () => {
  const state = seed();
  const pupil = state.students[0];
  const id = `${pupil.id}|1`;
  const change = {
    collection: 'conduct',
    id,
    before: state.conduct[id],
    after: { attitudes: { conduct: 'EXEMPLARY' } },
  };
  const teacher: User = {
    id: 'test-teacher',
    name: 'Teacher',
    email: 'teacher@example.test',
    role: 'Teacher',
    active: true,
    classes: [pupil.classId],
  };
  expect(applyChanges(state, teacher, [change]).conduct[id].attitudes?.conduct).toBe('EXEMPLARY');
  expect(() => applyChanges(state, { ...teacher, classes: [] }, [change])).toThrow(/assigned/);
  expect(() =>
    applyChanges(state, { ...teacher, role: 'Student', studentId: pupil.id }, [change]),
  ).toThrow(/own work/);
  expect(() => applyChanges(state, { ...teacher, role: 'Accountant' }, [change])).toThrow(
    /Finance/,
  );
});
