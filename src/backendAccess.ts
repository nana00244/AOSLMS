import { courseworkSubjectId, type State, type User } from './data.ts';
import { emptyState } from './emptyState.ts';
import { normalizeTeachingAccess } from './accountRules.ts';
import { removeStudents } from './studentRecords.ts';

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const finance = new Set([
  'payments',
  'expenses',
  'payroll',
  'fees',
  'studentConcessions',
  'studentBills',
]);
const academic = new Set([
  'assignments',
  'submissions',
  'attendance',
  'grades',
  'remarks',
  'conduct',
  'verified',
  'resources',
  'periods,
  'certificates',
  'messages',
]);
const maps = new Set([
  'attendance',
  'grades',
  'remarks',
  'conduct',
 'fees',
  'studentConcessions',
  'studentBills',
]);
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
      (['all', 'All', 'All classes', '].includes(value.classId) ||
        value.targetClassIds?.includes('all'))
    )
      return true;
    return classScope(state, key, id, value).some((c) =>
      canTeach(user, c, subjectScope(state, key, id, row),
    );
  }
  const sid = studentId(key, id, value);
  if (sid) return !!user.studentId && sid === user.studentId;
  const ownClass = state.students.find((s) => s.id === user.studentId)?.classId;
  if (!ownClass || !['assignments', 'resources', 'messages', 'periods', 'fees'].includes(key))
    return false;
  return classScope(state, key, id, value).some(
    (c) => c === ownClass || ['all', 'All', 'All classes', ''].includes(c)),
  );
}
function entries(key: string, value: any): [string, any][] {
  if (key === 'settings' || key === 'classes' || key === 'version') return [['singleton', value]];
  if (maps.has(key)) return Object.entries(value || {});
  if (!Array.isArray(value)) {
    throw new Error(`Invalid workspace data: ${key} must be a list. Reload the page and try again.`);
  }
  return value.map((row: any) => [typeof row === 'string' ? row : row.id, row]);
}
function materialize(key: string, rows: Map<string, any>): any {
  if (key === 'settings' || key === 'classes' || key === 'version') return rows.get('singleton');
  return maps.has(key) ? OXš™Xİ™œ›ÛQ[šY\Ê›İÜÊHˆË‹‹œ›İÜË˜[Y\Ê
WNÂŸB™^Ü[˜İ[Ûˆ›Ú™XİÛÜšÜÜXÙJİ]Nˆİ]K\Ù\ˆ\Ù\ŠNˆİ]HÂˆYˆ
]\Ù\‹˜Xİ]™JH›İÈ™]È\œ›ÜŠ	ĞXØÛİ[\È[˜Xİ]™IÊNÂˆÛÛœİ™\İ[ˆ[HH[\Tİ]J
NÂˆ›Üˆ
ÛÛœİÚÙ^K˜[YWHÙˆØš™Xİ™[šY\Êİ]JJHÂˆYˆ
Ù^HOOH	İ™\œÚ[Û‰ÊHÛÛ[YNÂˆ™\İ[ÚÙ^WHHX]\šX[^™JˆÙ^Kˆ™]ÈX\
[šY\ÊÙ^K˜[YJK™š[\Š
ÚY›İ×JHOˆ™XYX›Jİ]K\Ù\‹Ù^KY›İÊJKˆ
NÂˆBˆYˆ
\Ù\‹œ›ÛHOOH	ÔİY[	ÊBˆ™\İ[˜\ÜÚYÛ›Y[ÈH™\İ[˜\ÜÚYÛ›Y[Ë›X\

Nˆ[JHOˆ
Âˆ‹‹˜KˆØÛÜ™\ÎˆKœØÛÜ™\ÂˆÈØš™Xİ™œ›ÛQ[šY\ÊØš™Xİ™[šY\ÊKœØÛÜ™\ÊK™š[\Š
ÚYJHOˆYOOH\Ù\‹œİY[Y
JBˆˆ[™Yš[™YˆÛİØÛÜ™\ÎˆKœÛİØÛÜ™\ÂˆÈØš™Xİ™œ›ÛQ[šY\ÊØš™Xİ™[šY\ÊKœÛİØÛÜ™\ÊK™š[\ŠÚY