import { describe, expect, it } from 'vitest';
import {
  parseAttendanceFile,
  matchAttendanceClass,
  matchAttendanceStudents,
  attendanceImportEntries,
} from './attendanceImport';
import type { Student } from './data';
const csv = `"SCHOOL - MONTHLY ATTENDANCE REGISTER"
"Class: BS 1 | Month: September 2026 | Total School Days: 2"
""
Student Name,Admission Number,Roll Number,Sep 08,Sep 09,Days Present
"Mensah Ama",ID-1,101,PRESENT,ABSENT,1
"Abdul Jalilu Wakilu",other,102,LATE,EXCUSED,1
"Unknown Student",unknown,103,PRESENT,PRESENT,2`;
const student = (id: string, name: string, classId = 'Basic 1 - Green'): Student => ({
  id,
  name,
  classId,
  gender: '',
  dob: '',
  guardian: '',
  phone: '',
  status: 'Active',
  enrolled: '',
});
const roster = [
  student('ID-1', 'Ama Mensah'),
  student('ID-2', 'Abdul-jalilu Wakilu'),
  student('ID-3', 'Missing From File'),
  student('ID-4', 'Unknown Student', 'Basic 2'),
];
describe('attendance CSV import', () => {
  it('reads metadata and daily marks rather than totals from a preamble register', () => {
    const file = parseAttendanceFile(csv, 'register.csv');
    expect(file.month).toBe('2026-09');
    expect(file.className).toBe('BS 1');
    expect(file.rows[0].marks).toEqual({ '2026-09-08': 'Present', '2026-09-09': 'Absent' });
    expect(matchAttendanceClass(file.className, ['Basic 1 - Green', 'Basic 2'])).toBe(
      'Basic 1 - Green',
    );
    expect(matchAttendanceClass('BS 1', ['Basic 1 - Green', 'Basic 1 - Blue'])).toBe('');
    expect(matchAttendanceClass('BS 1', ['Basic 10'])).toBe('');
  });
  it('matches IDs and normalised names only within the class, skipping either side of unmatched rosters', () => {
    const file = parseAttendanceFile(csv, 'register.csv');
    const entries = attendanceImportEntries(file, roster, 'Basic 1 - Green', 2);
    expect(entries).toEqual({
      '2026-09-08|2|ID-1': 'Present',
      '2026-09-09|2|ID-1': 'Absent',
      '2026-09-08|2|ID-2': 'Late',
      '2026-09-09|2|ID-2': 'Excused',
    });
    const before = { '2026-09-08|2|ID-3': 'Absent', '2026-08-08|2|ID-1': 'Late' };
    expect({ ...before, ...entries }).toMatchObject(before);
  });
  it('matches reordered names and a clear minor typo but skips ambiguous near twins', () => {
    const file = parseAttendanceFile(csv, 'register.csv');
    file.rows = ['Wakilu Abdul Jalilu', 'Christopher Mensa', 'Isabella Konadu Ankomah'].map(
      (name) => ({ name, admission: '', marks: {} }),
    );
    const students = [
      student('1', 'Abdul-jalilu Wakilu'),
      student('2', 'Christopher Mensah'),
      student('3', 'Isabella Konadu Ankomah'),
      student('4', 'Israella Konadu Ankomah'),
    ];
    expect(
      matchAttendanceStudents(file, students, 'Basic 1 - Green').map((m) => m.student?.id),
    ).toEqual(['1', '2', '3']);
    file.rows[2].name = 'Isavella Konadu Ankomah';
    expect(matchAttendanceStudents(file, students, 'Basic 1 - Green')[2].student).toBeUndefined();
  });
  it('skips duplicate student rows, duplicate names and unknown/blank status cells', () => {
    const file = parseAttendanceFile(csv.replace('LATE,EXCUSED', '?,'), 'register.csv');
    expect(file.ignoredCells).toBe(1);
    expect(file.rows[1].marks).toEqual({});
    file.rows.push(file.rows[0]);
    expect(matchAttendanceStudents(file, roster, 'Basic 1 - Green')[0].student).toBeUndefined();
    file.rows = [{ name: 'Same Name', admission: '', marks: {} }];
    expect(
      matchAttendanceStudents(
        file,
        [student('1', 'Same Name'), student('2', 'Same Name')],
        'Basic 1 - Green',
      )[0].student,
    ).toBeUndefined();
  });
  it('rejects conflicting months, invalid dates, duplicate days and missing metadata', () => {
    expect(() => parseAttendanceFile(csv, 'October_2026.csv')).toThrow('disagree');
    expect(() => parseAttendanceFile(csv.replace('Sep 09', 'Oct 09'), 'register.csv')).toThrow(
      'does not belong',
    );
    expect(() => parseAttendanceFile(csv.replace('Sep 09', 'Sep 31'), 'register.csv')).toThrow(
      'invalid',
    );
    expect(() => parseAttendanceFile(csv.replace('Sep 09', 'Sep 08'), 'register.csv')).toThrow(
      'Duplicate',
    );
    expect(() => parseAttendanceFile('Student Name,Sep 08\nName,PRESENT', 'file.csv')).toThrow(
      'month and year',
    );
  });
});
