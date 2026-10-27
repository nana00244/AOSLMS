import {
  classSubjects,
  courseworkAssessment,
  courseworkCategoryConfigs,
  courseworkSubjectId,
  ensureClassCourseworkCards,
  gradeKey,
  type State,
  type Student,
  type User,
  type CourseworkCategoryKey,
  type FeedbackType,
} from './data.ts';

export const scoreNameKey = (s: string) =>
  s
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
const nameKey = (s: string) => scoreNameKey(s).split(' ').sort().join(' ');
export interface ScoreCell {
  slotKey: string;
  maxPoints: number;
  score: number | null;
  feedbackType: FeedbackType;
}
export interface ScoreRow {
  name: string;
  admission: string;
  cells: ScoreCell[];
}
export interface ScoreSheet {
  className: string;
  subject: string;
  category: CourseworkCategoryKey;
  term: number;
  rows: ScoreRow[];
}
export interface ScoreImportRequest {
  sheet: ScoreSheet;
  classId: string;
  subject: string;
  /** Only explicit review selections. Automatic matches are recomputed on the server. */
  studentOverrides: Record<string, string>;
}
export function matchScoreSubject(source: string, options: string[]): string {
  const aliases: Record<string, string> = {
    english: 'English Language',
    maths: 'Mathematics',
    math: 'Mathematics',
    science: 'Integrated Science',
    rme: 'Religious & Moral Education (RME)',
    ict: 'Computing / ICT',
    computing: 'Computing / ICT',
    twi: 'Ghanaian Language (Twi)',
    'creative arts': 'Creative Arts & Design',
  };
  const key = scoreNameKey(aliases[scoreNameKey(source)] || source);
  const matches = options.filter((s) => scoreNameKey(s) === key);
  return matches.length === 1 ? matches[0] : '';
}
function similarity(a: string, b: string) {
  let row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++)
      next[j] = Math.min(next[j - 1] + 1, row[j] + 1, row[j - 1] + Number(a[i - 1] !== b[j - 1]));
    row = next;
  }
  return 1 - row[b.length] / Math.max(a.length, b.length, 1);
}
export function matchScoreStudent(row: ScoreRow, students: Student[], classId: string) {
  const inClass = students.filter((s) => s.classId === classId);
  const admission = row.admission
    ? students.filter((s) => scoreNameKey(s.id) === scoreNameKey(row.admission))
    : [];
  if (admission.length)
    return admission.length === 1 && admission[0].classId === classId
      ? { id: admission[0].id, reason: 'Admission number', suggestion: '' }
      : {
          id: '',
          reason: 'Admission number belongs to another class or is duplicated',
          suggestion: '',
        };
  const exact = inClass.filter((s) => nameKey(s.name) === nameKey(row.name));
  if (exact.length === 1)
    return {
      id: exact[0].id,
      reason: row.admission ? 'Name matched; admission number differs — review' : 'Normalized name',
      suggestion: '',
    };
  if (exact.length > 1)
    return { id: '', reason: 'Duplicate student names — choose admission number', suggestion: '' };
  const ranked = inClass
    .map((s) => ({ s, score: similarity(nameKey(s.name), nameKey(row.name)) }))
    .sort((a, b) => b.score - a.score);
  const suggestion =
    ranked[0]?.score >= 0.75 && ranked[0].score - (ranked[1]?.score || 0) >= 0.08
      ? ranked[0].s.id
      : '';
  return {
    id: '',
    reason: suggestion
      ? 'Close name — confirm the suggested student'
      : 'No unique match — choose student',
    suggestion,
  };
}

/** Shared by the browser preview and the authenticated Edge endpoint. Atomic, scoped and repeatable. */
export function applyScoreImport(state: State, user: User, request: ScoreImportRequest): State {
  const { sheet, classId, subject, studentOverrides } = request;
  if (!user.active || !['Administrator', 'Teacher'].includes(user.role))
    throw new Error('Teaching permission required');
  const allowed = user.classAllowedSubjects?.[classId];
  if (
    user.role === 'Teacher' &&
    (!user.classes.includes(classId) ||
      (allowed !== undefined &&
        !allowed.includes(subject) &&
        !allowed.includes(courseworkSubjectId(subject))))
  )
    throw new Error('Class or subject is not assigned to you');
  if (!state.classes.includes(classId) || !classSubjects(classId).includes(subject))
    throw new Error('Choose a valid class and curriculum subject');
  if (![1, 2, 3].includes(sheet.term) || sheet.term !== state.settings.term)
    throw new Error('Upload a score sheet for the active term');
  const config = courseworkCategoryConfigs[sheet.category];
  if (!config || !Array.isArray(sheet.rows) || !sheet.rows.length || sheet.rows.length > 2000)
    throw new Error('Invalid score sheet');
  const next = {
    ...state,
    assignments: ensureClassCourseworkCards(state, classId, sheet.term, new Set([subject]))
      .assignments,
    grades: { ...state.grades },
  };
  const id = `cc_${classId}_${subject.replace(/[^a-z0-9]/gi, '_')}_${sheet.category}_term${sheet.term}`;
  const original = next.assignments.find((a) => a.id === id)!;
  const assignment = { ...original, slotScores: { ...original.slotScores } };
  const affected = new Set<string>();
  sheet.rows.forEach((row, index) => {
    if (!row.cells.length) return;
    const sid =
      studentOverrides[String(index)] || matchScoreStudent(row, state.students, classId).id;
    if (!sid || !state.students.some((s) => s.id === sid && s.classId === classId))
      throw new Error(`Resolve the student match for ${row.name}`);
    if (affected.has(sid)) throw new Error(`Duplicate score rows for ${row.name}`);
    affected.add(sid);
    const entries = { ...assignment.slotScores[sid] };
    const seen = new Set<string>();
    for (const cell of row.cells) {
      const slot = original.slots?.find((s) => s.slotKey === cell.slotKey);
      if (!slot || seen.has(cell.slotKey))
        throw new Error(`Invalid or duplicate score column: ${cell.slotKey}`);
      seen.add(cell.slotKey);
      if (
        !Number.isFinite(cell.maxPoints) ||
        cell.maxPoints <= 0 ||
        cell.maxPoints > 10000 ||
        (cell.score !== null &&
          (!Number.isFinite(cell.score) || cell.score < 0 || cell.score > cell.maxPoints)) ||
        !['none', 'absent', 'not_submitted', 'late'].includes(cell.feedbackType) ||
        (cell.score === null && cell.feedbackType === 'none')
      )
        throw new Error(`Invalid score for ${row.name}, ${cell.slotKey}`);
      entries[cell.slotKey] = {
        score: cell.score,
        maxPoints: cell.maxPoints,
        feedbackType: cell.feedbackType,
        updatedAt: new Date().toISOString(),
      };
    }
    assignment.slotScores[sid] = entries;
  });
  if (!affected.size) throw new Error('The sheet contains no scores or feedback to upload');
  next.assignments = next.assignments.map((a) => (a.id === id ? assignment : a));
  // A new entry can increase the shared denominator for every classmate.
  const recalculate =
    sheet.category === 'exam'
      ? [...affected]
      : next.students.filter((pupil) => pupil.classId === classId).map((pupil) => pupil.id);
  for (const sid of recalculate) {
    const assessment = courseworkAssessment(next, sid, classId, subject, sheet.term);
    const key = gradeKey(sid, sheet.term, subject);
    const grade = next.grades[key] || { sba: 0, exam: 0, remark: '' };
    next.grades[key] = {
      ...grade,
      ...(sheet.category !== 'exam' ? { sba: assessment.sba ?? 0 } : {}),
      ...(sheet.category === 'exam' ? { exam: assessment.exam ?? 0 } : {}),
    };
  }
  return next;
}
