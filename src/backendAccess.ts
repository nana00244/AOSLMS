import { courseworkSubjectId, type State, type User } from './data.ts';
import { emptyState } from './emptyState.ts';

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const finance = new Set(['payments', 'expenses', 'payroll', 'fees', 'studentConcessions']);
const academic = new Set([
  'assignments',
  'submissions',
  'attendance',
  'grades',
  'remarks',
  'conduct',
  'verified',
  'resources',
  'periods',
  'certificates',
  'messages',
]);
const maps = new Set(['attendance', 'grades', 'remarks', 'conduct', 'fees', 'studentConcessions']);
export function canTeach(user: User, classId: string, subject?: string): boolean {
  if (user.role !== 'Teacher' || !user.classes.includes(classId)) return false;
  const subjects = user.classAllowedSubjects?.[classId];
  return (
    subjects === undefined ||
    (subject
      ? subjects.includes(subject) || subjects.includes(courseworkSubjectId(subject))
      : subjects.length > 0)
  );
}
function studentId(key: string, id: string, value: any): string {
  if (key === 'students') return id;
  if (key === 'attendance') return id.split('|')[2];
  if (['grades', 'remarks', 'conduct', 'verified'].includes(key)) return id.split('|')[0];
  if (key === 'studentConcessions') return id;
  return value?.studentId;
}
function classScope(state: State, key: string, id: string, value: any): string[] {
  if (key === 'fees') return [id];
  const sid = studentId(key, id, value);
  if (sid) return [state.students.find((s) => s.id === sid)?.classId || ''];
  if (key === 'resources' && value?.targetClassIds?.length) return value.targetClassIds;
  return [value?.classId || ''];
}
function subjectScope(state: State, key: string, id: string, value: any): string | undefined {
  if (key === 'grades') return id.split('|').slice(2).join('|');
  if (key === 'submissions')
    return state.assignments.find((a) => a.id === value?.assignmentId)?.subject;
  return value?.subject;
}
function readable(state: State, user: User, key: string, id: string, value: any): boolean {
  if (user.role === 'Administrator') return true;
  if (key === 'settings' || key === 'classes') return true;
  if (key === 'users') return id === user.id;
  if (key === 'teacherAssignments') return value.teacherUserId === user.id;
  if (key === 'logs') return false;
  if (user.role === 'Accountant') return finance.has(key) || key === 'students';
  if (user.role === 'Teacher') {
    if (finance.has(key)) return false;
    if (
      (key === 'messages' || key === 'resources') &&
      (['all', 'All', 'All classes', ''].includes(value.classId) ||
        value.targetClassIds?.includes('all'))
    )
      return true;
    return classScope(state, key, id, value).some((c) =>
      canTeach(user, c, subjectScope(state, key, id, value)),
    );
  }
  const sid = studentId(key, id, value);
  if (sid) return !!user.studentId && sid === user.studentId;
  const ownClass = state.students.find((s) => s.id === user.studentId)?.classId;
  if (!ownClass || !['assignments', 'resources', 'messages', 'periods', 'fees'].includes(key))
    return false;
  return classScope(state, key, id, value).some(
    (c) => c === ownClass || ['all', 'All', 'All classes', ''].includes(c),
  );
}
function entries(key: string, value: any): [string, any][] {
  if (key === 'settings' || key === 'classes' || key === 'version') return [['singleton', value]];
  if (maps.has(key)) return Object.entries(value || {});
  return (value || []).map((row: any) => [typeof row === 'string' ? row : row.id, row]);
}
function materialize(key: string, rows: Map<string, any>): any {
  if (key === 'settings' || key === 'classes' || key === 'version') return rows.get('singleton');
  return maps.has(key) ? Object.fromEntries(rows) : [...rows.values()];
}
export function projectWorkspace(state: State, user: User): State {
  if (!user.active) throw new Error('Account is inactive');
  const result: any = emptyState();
  for (const [key, value] of Object.entries(state)) {
    if (key === 'version') continue;
    result[key] = materialize(
      key,
      new Map(entries(key, value).filter(([id, row]) => readable(state, user, key, id, row))),
    );
  }
  if (user.role === 'Student')
    result.assignments = result.assignments.map((a: any) => ({
      ...a,
      scores: a.scores
        ? Object.fromEntries(Object.entries(a.scores).filter(([id]) => id === user.studentId))
        : undefined,
      slotScores: a.slotScores
        ? Object.fromEntries(Object.entries(a.slotScores).filter(([id]) => id === user.studentId))
        : undefined,
    }));
  return result;
}

export interface Change {
  collection: string;
  id: string;
  before?: any;
  after?: any;
}
export function changesBetween(before: State, after: State): Change[] {
  const changes: Change[] = [];
  for (const key of Object.keys(after)) {
    if (key === 'logs') continue; // Audit events are exclusively authored on the server.
    const oldRows = new Map(entries(key, (before as any)[key]));
    const newRows = new Map(entries(key, (after as any)[key]));
    for (const id of new Set([...oldRows.keys(), ...newRows.keys()])) {
      if (!same(oldRows.get(id), newRows.get(id)))
        changes.push({ collection: key, id, before: oldRows.get(id), after: newRows.get(id) });
    }
  }
  return changes;
}

/** Enforces authorization on both the original and replacement record, before merging. */
export function applyChanges(state: State, user: User, changes: Change[]): State {
  if (!user.active) throw new Error('Account is inactive');
  if (!Array.isArray(changes) || changes.length > 10000) throw new Error('Invalid change set');
  const next = structuredClone(state);
  for (const change of changes) {
    const { collection: key, id, before, after } = change;
    if (!Object.hasOwn(state, key) || ['logs', 'version', 'teacherAssignments'].includes(key))
      throw new Error('This record requires the account administration endpoint');
    const rows = new Map(entries(key, (next as any)[key]));
    const old = rows.get(id);
    if (
      after?.storagePath &&
      after.storagePath !== old?.storagePath &&
      !after.storagePath.startsWith(`${user.id}/`)
    )
      throw new Error('You can only attach files uploaded by your account');
    if (key === 'users') {
      const immutable = (u: any) => u && { ...u, classes: [], classAllowedSubjects: {} };
      if (
        user.role !== 'Administrator' ||
        !old ||
        !after ||
        !same(immutable(old), immutable(after))
      )
        throw new Error('This record requires the account administration endpoint');
    }
    if (!same(old, before)) throw new Error('Conflict: records changed. Reload and try again.');
    if (user.role !== 'Administrator') {
      if (user.role === 'Accountant') {
        if (!finance.has(key)) throw new Error('Finance permission required');
      } else if (user.role === 'Teacher') {
        if (!academic.has(key)) throw new Error('Teaching permission required');
        if (key === 'assignments' && after) {
          for (const field of ['scores', 'slotScores']) {
            for (const [sid, score] of Object.entries(after[field] || {})) {
              if (
                !same(score, old?.[field]?.[sid]) &&
                !state.students.some((s) => s.id === sid && s.classId === after.classId)
              )
                throw new Error('Scores must belong to students in this class');
            }
          }
        }
        for (const row of [old, after].filter((v) => v !== undefined)) {
          if (
            !classScope(state, key, id, row).every((c) =>
              canTeach(user, c, subjectScope(state, key, id, row)),
            )
          )
            throw new Error('Class or subject is not assigned to you');
        }
      } else {
        if (
          key !== 'submissions' ||
          !after ||
          after.studentId !== user.studentId ||
          (old && old.studentId !== user.studentId)
        )
          throw new Error('You may only submit your own work');
        const assignment = state.assignments.find((a) => a.id === after.assignmentId);
        const student = state.students.find((s) => s.id === user.studentId);
        if (
          !assignment ||
          !student ||
          assignment.classId !== student.classId ||
          (old && old.assignmentId !== after.assignmentId)
        )
          throw new Error('Assignment is not in your class');
        if (
          old?.score !== undefined ||
          assignment.scores?.[user.studentId || '']?.score !== undefined ||
          after.score !== undefined ||
          after.feedback !== undefined
        )
          throw new Error('Students cannot grade submissions or edit graded work');
        after.date = new Date().toISOString();
      }
    }
    if (after === undefined) rows.delete(id);
    else rows.set(id, after);
    (next as any)[key] = materialize(key, rows);
  }
  return next;
}
