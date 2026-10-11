import { classKey, matchAttendanceClass, nameKey, normalize, similarity } from './attendanceImport';
import { today, uid, type State, type Student } from './data';
export interface RosterRow {
  name: string;
  admission: string;
  className: string;
}
export function parseRosterSheets(sheets: { sheet: string; data: unknown[][] }[]): RosterRow[] {
  const rows: RosterRow[] = [];
  for (const sheet of sheets) {
    const headerIndex = sheet.data.findIndex((r) =>
      r.some((c) =>
        ['full name', 'student name', 'name', 'learner name'].includes(normalize(String(c || ''))),
      ),
    );
    if (headerIndex < 0) continue;
    const headers = sheet.data[headerIndex].map((c) => normalize(String(c || '')));
    const nameIndex = headers.findIndex((c) =>
      ['full name', 'student name', 'name', 'learner name'].includes(c),
    );
    const classIndex = headers.findIndex((c) =>
      ['class', 'class stream', 'class name'].includes(c),
    );
    const admissionIndex = headers.findIndex((c) =>
      ['admission number', 'admission no', 'student id'].includes(c),
    );
    const heading = sheet.data.slice(0, headerIndex).flat().map(String).join(' | ');
    const fallback =
      heading.match(/(?:official class roster\s*-|class\s*:)\s*([^|]+)/i)?.[1]?.trim() ||
      (/^(bs|basic|primary|jhs|kg|nursery)\s*\d/i.test(sheet.sheet) ? sheet.sheet : '');
    for (const row of sheet.data.slice(headerIndex + 1)) {
      const name = String(row[nameIndex] || '').trim();
      if (!name || ['total', 'full name', 'student name'].includes(normalize(name))) continue;
      if (name.length > 200) throw new Error('A student name is too long. Check the name column.');
      const className = String(row[classIndex] || fallback).trim();
      if (!className || className.length > 150)
        throw new Error('Every student row needs a class column or a class sheet heading.');
      rows.push({ name, className, admission: String(row[admissionIndex] || '').trim() });
    }
  }
  if (!rows.length) throw new Error('No roster rows found. Include Full Name and Class columns.');
  // Master and class sheets often repeat exactly the same roster.
  return [
    ...new Map(
      rows.map((r) => [`${normalize(r.admission) || nameKey(r.name)}|${classKey(r.className)}`, r]),
    ).values(),
  ];
}
export function initialRosterClasses(rows: RosterRow[], classes: string[]) {
  const available = [...classes];
  return Object.fromEntries(
    [...new Set(rows.map((r) => r.className))].map((source) => {
      const matched = matchAttendanceClass(source, available);
      const ambiguous = available.some(
        (c) => classKey(c) === classKey(source) || classKey(c).startsWith(`${classKey(source)} `),
      );
      const target = matched || (ambiguous ? '' : source);
      if (target && !available.includes(target)) available.push(target);
      return [source, target];
    }),
  );
}
export function planRoster(
  rows: RosterRow[],
  students: Student[],
  mapping: Record<string, string>,
) {
  const plan = rows.map((row) => {
    const classId = mapping[row.className];
    let candidates = row.admission
      ? students.filter((s) => normalize(s.id) === normalize(row.admission))
      : [];
    let reason = 'Admission number';
    if (!candidates.length) {
      candidates = students.filter((s) => nameKey(s.name) === nameKey(row.name));
      reason = 'Name';
      const inClass = candidates.filter((s) => s.classId === classId);
      if (inClass.length === 1) candidates = inClass;
    }
    let ambiguous = candidates.length > 1;
    if (!candidates.length) {
      const ranked = students
        .map((s) => ({ student: s, score: similarity(nameKey(s.name), nameKey(row.name)) }))
        .sort((a, b) => b.score - a.score);
      if (ranked[0]?.score >= 0.9) {
        if (ranked[0].score - (ranked[1]?.score || 0) >= 0.08) {
          candidates = [ranked[0].student];
          reason = 'Close name match';
        } else ambiguous = true;
      }
    }
    const student = candidates.length === 1 ? candidates[0] : undefined;
    const action =
      !classId || ambiguous
        ? 'skip'
        : student
          ? student.classId === classId
            ? 'unchanged'
            : 'move'
          : 'create';
    return {
      row,
      classId,
      student,
      action,
      reason: ambiguous ? 'Ambiguous student' : !classId ? 'Choose a class' : reason,
    };
  });
  return plan.map((item) => {
    const related = plan.filter((other) =>
      item.student
        ? other.student?.id === item.student.id
        : (item.row.admission &&
            normalize(other.row.admission) === normalize(item.row.admission)) ||
          nameKey(other.row.name) === nameKey(item.row.name),
    );
    if (new Set(related.map((r) => r.classId)).size > 1)
      return { ...item, action: 'skip', reason: 'Student appears in conflicting classes' };
    if (related.indexOf(item) > 0) return { ...item, action: 'skip', reason: 'Repeated student' };
    return item;
  });
}
export function applyRoster(
  state: State,
  rows: RosterRow[],
  mapping: Record<string, string>,
): State {
  const plan = planRoster(rows, state.students, mapping);
  const students = [...state.students];
  const classes = new Set(state.classes);
  for (const item of plan) {
    if (item.action === 'move')
      students[students.findIndex((s) => s.id === item.student!.id)] = {
        ...item.student!,
        classId: item.classId,
      };
    if (item.action === 'create') {
      const id =
        item.row.admission && item.row.admission.length <= 150 && !/[|]/.test(item.row.admission)
          ? item.row.admission
          : `AOS-${uid()}`;
      if (students.some((s) => normalize(s.id) === normalize(id))) continue;
      students.push({
        id,
        name: item.row.name,
        classId: item.classId,
        gender: '',
        dob: '',
        guardian: '',
        phone: '',
        status: 'Active',
        enrolled: today(),
      });
    }
    if (['move', 'create', 'unchanged'].includes(item.action)) classes.add(item.classId);
  }
  return { ...state, classes: [...classes], students };
}

