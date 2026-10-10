import { describe, expect, it } from 'vitest';
import { seed, type User } from './data';
import { applyChanges, changesBetween, projectWorkspace } from './backendAccess';
import { workspaceSchema } from './validation';

const base = seed();
const first = base.students[0];
const other = base.students.find((s) => s.classId !== first.classId)!;
const student: User = {
  id: 'auth-student',
  name: 'Student',
  email: 's@example.test',
  role: 'Student',
  active: true,
  classes: [],
  studentId: first.id,
};
const teacher: User = {
  id: 'auth-teacher',
  name: 'Teacher',
  email: 't@example.test',
  role: 'Teacher',
  active: true,
  classes: [first.classId],
};
const accountant: User = { ...teacher, role: 'Accountant' };

describe('server-side workspace access', () => {
  it('preserves historical coursework when a student transfers class', () => {
    const transferred = structuredClone(base);
    transferred.students[0].classId = other.classId;
    expect(workspaceSchema.safeParse(transferred).success).toBe(true);
  });
  it('returns only the student’s records and scores', () => {
    const view = projectWorkspace(base, student);
    expect(view.students.map((s) => s.id)).toEqual([first.id]);
    expect(view.payments.every((p) => p.studentId === first.id)).toBe(true);
    expect(view.expenses).toEqual([]);
    expect(view.payroll).toEqual([]);
    expect(view.logs).toEqual([]);
    expect(view.submissions.every((s) => s.studentId === first.id)).toBe(true);
    expect(
      view.assignments.every((a) => Object.keys(a.scores || {}).every((id) => id === first.id)),
    ).toBe(true);
  });
  it('does not expose financial records to teachers', () => {
    const view = projectWorkspace(base, teacher);
    expect(view.students.every((s) => s.classId === first.classId)).toBe(true);
    expect(view.payments).toEqual([]);
    expect(view.fees).toEqual({});
  });
  it('does not expose academic records to accountants', () => {
    const view = projectWorkspace(base, accountant);
    expect(view.assignments).toEqual([]);
    expect(view.grades).toEqual({});
    expect(view.students.length).toBe(base.students.length);
  });
  it('rejects financial mutations by students', () => {
    expect(() =>
      applyChanges(base, student, [
        { collection: 'fees', id: first.classId, before: base.fees[first.classId], after: {} },
      ]),
    ).toThrow();
  });
  it('checks replacement scope as well as the original scope', () => {
    const a = base.assignments.find((a) => a.classId === first.classId)!;
    expect(() =>
      applyChanges(base, teacher, [
        { collection: 'assignments', id: a.id, before: a, after: { ...a, classId: other.classId } },
      ]),
    ).toThrow('Class or subject');
  });
  it('enforces teacher subject restrictions', () => {
    const restricted = { ...teacher, classAllowedSubjects: { [first.classId]: ['Mathematics'] } };
    expect(() =>
      applyChanges(base, restricted, [
        {
          collection: 'grades',
          id: `${first.id}|1|English Language`,
          before: base.grades[`${first.id}|1|English Language`],
          after: { sba: 50, exam: 50, remark: '' },
        },
      ]),
    ).toThrow('subject');
  });
  it('rejects self-grading even when the row belongs to the student', () => {
    const a = base.assignments.find((a) => a.classId === first.classId)!;
    expect(() =>
      applyChanges(base, student, [
        {
          collection: 'submissions',
          id: 'new',
          after: {
            id: 'new',
            assignmentId: a.id,
            studentId: first.id,
            text: '',
            link: '',
            date: '',
            score: 100,
          },
        },
      ]),
    ).toThrow('grade');
  });
  it('rejects stale data and blocked accounts', () => {
    expect(() =>
      applyChanges(base, teacher, [
        { collection: 'assignments', id: base.assignments[0].id, before: {}, after: {} },
      ]),
    ).toThrow('Conflict');
    expect(() => projectWorkspace(base, { ...student, active: false })).toThrow('inactive');
  });
  it('rejects account elevation through the workspace API', () => {
    expect(() =>
      applyChanges(base, student, [
        { collection: 'users', id: student.id, after: { ...student, role: 'Administrator' } },
      ]),
    ).toThrow('administration');
  });
  it('generates only changed records and excludes client audit entries', () => {
    const next = structuredClone(base);
    next.settings.name = 'Updated';
    next.logs = [];
    expect(changesBetween(base, next).map((c) => c.collection)).toEqual(['settings']);
  });
});
