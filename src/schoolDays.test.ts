import { expect, test } from 'vitest';
import { isWeekday, previousSchoolDay, schoolDaysInMonth } from './schoolDays';
import { workspaceSchema } from './validation';
import { emptyState } from './emptyState';
import { parseAttendanceFile, attendanceImportEntries } from './attendanceImport';

test('month calendars contain only valid weekdays, including leap years and future months', () => {
  expect(schoolDaysInMonth('2026-10')).toHaveLength(22);
  expect(schoolDaysInMonth('2024-02')).toContain('2024-02-29');
  expect(schoolDaysInMonth('2026-02')).not.toContain('2026-02-29');
  for (let m = 1; m <= 12; m++) {
    const days = schoolDaysInMonth(`2027-${String(m).padStart(2, '0')}`);
    expect(days.length).toBeGreaterThanOrEqual(20);
    expect(days.every(isWeekday)).toBe(true);
  }
  expect(schoolDaysInMonth('2026-13')).toEqual([]);
  expect(isWeekday('2026-02-30')).toBe(false);
  expect(previousSchoolDay('2026-10-17')).toBe('2026-10-16');
  expect(previousSchoolDay('2026-11-01')).toBe('2026-10-30');
});

test('server schema rejects Saturday/Sunday entries and invalid dates but accepts weekdays', () => {
  for (const [date, valid] of [
    ['2026-10-16', true],
    ['2026-10-17', false],
    ['2026-10-18', false],
    ['2026-10-19', true],
    ['2026-02-30', false],
  ] as const) {
    const state = emptyState();
    state.attendance[`${date}|1|S1`] = 'Present';
    expect(workspaceSchema.safeParse(state).success).toBe(valid);
  }
});

test('CSV preview and final import both omit weekend marks', () => {
  const file = parseAttendanceFile(
    'Class: BS 1 | Month: October 2026\nStudent Name,Admission Number,Oct 16,Oct 17,Oct 18,Oct 19\nPupil,S1,P,L,A,E',
    'register.csv',
  );
  expect(file.ignoredCells).toBe(2);
  expect(file.rows[0].marks).toEqual({ '2026-10-16': 'Present', '2026-10-19': 'Excused' });
  // Defend the commit builder as well as the CSV parser.
  file.rows[0].marks['2026-10-17'] = 'Present';
  const entries = attendanceImportEntries(
    file,
    [
      {
        id: 'S1',
        name: 'Pupil',
        classId: 'BS 1',
        gender: '',
        dob: '',
        guardian: '',
        phone: '',
        status: 'Active',
        enrolled: '',
      },
    ],
    'BS 1',
    1,
  );
  expect(Object.keys(entries)).toEqual(['2026-10-16|1|S1', '2026-10-19|1|S1']);
});
