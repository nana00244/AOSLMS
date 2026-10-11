import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseRosterSheets, initialRosterClasses, applyRoster, planRoster } from './rosterImport';
import { billed, billKey, seed, type Student } from './data';
import { emptyState } from './emptyState';
import { applyChanges, changesBetween, projectWorkspace } from './backendAccess';
import { removeStudents } from './studentRecords';
import { workspaceSchema } from './validation';
const student = (id: string, name: string, classId = 'Basic 1'): Student => ({
  id,
  name,
  classId,
  gender: '',
  dob: '',
  guardian: '',
  phone: '',
  status: 'Active',
  enrolled: '2026-10-11',
});
describe('class roster updates and explicit billing', () => {
  it('reads every class and deduplicates master/class sheet copies', () => {
    const sheets = [
      {
        sheet: 'Master',
        data: [
          ['School'],
          ['Full Name', 'Admission Number', 'Class'],
          ['Ama Mensah', '1', 'BS 1'],
          ['Kofi Boateng', '2', 'BS 2'],
        ],
      },
      {
        sheet: 'BS 1',
        data: [
          ['Full Name', 'Admission Number', 'Class'],
          ['Ama Mensah', '1', 'BS 1'],
        ],
      },
    ];
    const rows = parseRosterSheets(sheets);
    expect(rows).toHaveLength(2);
    const state = {
      ...emptyState(),
      classes: ['Basic 1', 'Basic 2'],
      students: [student('old', 'Mensah Ama', 'Basic 2'), student('absent', 'Not In File')],
    };
    const mapping = initialRosterClasses(rows, state.classes);
    const next = applyRoster(state, rows, mapping);
    expect(next.students.find((s) => s.id === 'old')?.classId).toBe('Basic 1');
    expect(next.students.find((s) => s.id === 'absent')).toEqual(state.students[1]);
    expect(next.students.find((s) => s.id === '2')?.classId).toBe('Basic 2');
    expect(applyRoster(next, rows, mapping)).toEqual(next);
  });
  it('requires ambiguous class selection and skips ambiguous/conflicting students', () => {
    const rows = [{ name: 'Same Name', admission: '', className: 'BS 1' }];
    expect(initialRosterClasses(rows, ['Basic 1 Blue', 'Basic 1 Gold'])['BS 1']).toBe('');
    expect(
      planRoster(rows, [student('1', 'Same Name'), student('2', 'Same Name')], {
        'BS 1': 'Basic 1',
      })[0].action,
    ).toBe('skip');
    const conflict = [
      { name: 'Ama', admission: '1', className: 'BS 1' },
      { name: 'Ama', admission: '1', className: 'BS 2' },
    ];
    expect(
      planRoster(conflict, [], { 'BS 1': 'Basic 1', 'BS 2': 'Basic 2' }).every(
        (p) => p.action === 'skip',
      ),
    ).toBe(true);
  });
  it('does not bill enrollment or transfers, and keeps issued bills independent of templates', () => {
    const state = {
      ...emptyState(),
      classes: ['Basic 1', 'Basic 2'],
      students: [student('1', 'Ama')],
      fees: { 'Basic 1': { Tuition: 100 }, 'Basic 2': { Tuition: 200 } },
    };
    expect(billed(state, state.students[0])).toBe(0);
    state.studentBills = {
      [billKey('1', state.settings.year, 1)]: {
        studentId: '1',
        year: state.settings.year,
        term: 1,
        items: { Tuition: 125 },
        concession: 0,
        updatedAt: '',
      },
    };
    expect(billed(state, state.students[0])).toBe(125);
    state.students[0].classId = 'Basic 2';
    state.fees['Basic 2'].Tuition = 900;
    expect(billed(state, state.students[0])).toBe(125);
    state.settings.term = 2;
    expect(billed(state, state.students[0])).toBe(0);
  });
  it('allows finance bills but rejects teacher/student billing and accountant roster deletion', () => {
    const state = seed();
    const admin = state.users.find((u) => u.role === 'Administrator')!;
    const accountant = { ...admin, role: 'Accountant' as const };
    const teacher = { ...admin, role: 'Teacher' as const };
    const sid = state.students[0].id;
    const key = billKey(sid, state.settings.year, state.settings.term);
    const after = { ...state.studentBills![key], items: { Tuition: 120 } };
    const changes = [
      { collection: 'studentBills', id: key, before: state.studentBills![key], after },
    ];
    expect(billed(applyChanges(state, accountant, changes), state.students[0])).toBe(120);
    expect(() => applyChanges(state, teacher, changes)).toThrow();
    const learner = { ...admin, role: 'Student' as const, studentId: sid };
    expect(() => applyChanges(state, learner, changes)).toThrow();
    expect(
      Object.values(projectWorkspace(state, learner).studentBills!).every(
        (b) => b.studentId === sid,
      ),
    ).toBe(true);
    expect(projectWorkspace(state, teacher).studentBills).toEqual({});
    expect(() =>
      applyChanges(state, accountant, [
        { collection: 'students', id: sid, before: state.students[0] },
      ]),
    ).toThrow();
  });
  it('cascades academic and finance records for deleted students only', () => {
    const state = seed();
    const sid = state.students[0].id;
    const admin = state.users.find((u) => u.role === 'Administrator')!;
    const next = applyChanges(state, admin, [
      { collection: 'students', id: sid, before: state.students[0] },
    ]);
    expect(workspaceSchema.safeParse(next).success).toBe(true);
    expect(next.students).toHaveLength(state.students.length - 1);
    expect(next.payments.every((p) => p.studentId !== sid)).toBe(true);
    expect(Object.values(next.studentBills!).every((b) => b.studentId !== sid)).toBe(true);
    expect(applyChanges(state, admin, changesBetween(state, removeStudents(state, [sid])))).toEqual(
      next,
    );
  });
  it.skipIf(!process.env.AOS_ROSTER_SAMPLE_PATH)(
    'parses the supplied workbook without importing private records',
    async () => {
      const { default: read } = await import('read-excel-file/node');
      const sheets = await read(readFileSync(process.env.AOS_ROSTER_SAMPLE_PATH!));
      const rows = parseRosterSheets(sheets);
      expect(rows).toHaveLength(239);
      expect(new Set(rows.map((r) => r.className)).size).toBe(10);
      const state = emptyState();
      const mapping = initialRosterClasses(rows, []);
      const next = applyRoster(state, rows, mapping);
      expect(next.students.length).toBe(239);
    expect(next.classes.length).toBe(9); // BS4 and BS 4 are the same class.
      expect(workspaceSchema.safeParse(next).success).toBe(true);
      expect(applyRoster(next, rows, mapping)).toEqual(next);
      console.log(
        `Workbook checked: ${rows.length} unique rows across ${next.classes.length} classes; repeat import unchanged.`,
      );
    },
  );
});

