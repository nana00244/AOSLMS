import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { emptyState } from './emptyState';
import {
  applyScoreImport,
  matchScoreStudent,
  matchScoreSubject,
  type ScoreImportRequest,
} from './scoreImport';
import { parseScoreCsv } from './scoreSheetParser';
import { courseworkAssessment, ensureClassCourseworkCards, gradeKey, type User } from './data';

const csv = `AYISATU OWEN SCHOOLS - CONTINUOUS ASSESSMENT SCORE SHEET
Subject,English Language,Class,JHS 1
Assessment Category,Class Exercises,Term,Term 1

#,Student Name,Admission Number,EXE1 (/15),EXE2 (/15),EXE3 (/15),Total Earned Marks,Average %
1,Test Learner,SN-1,[ABS],11,14,25,83%
2,Other Learner,SN-2,0,4,14,18,40%
3,Blank Learner,SN-3,,,,,
`;
function setup() {
  const state = emptyState();
  state.classes = ['JHS 1'];
  state.students = ['Test Learner', 'Other Learner', 'Blank Learner'].map((name, i) => ({
    id: `SN-${i + 1}`,
    name,
    classId: 'JHS 1',
    gender: '',
    dob: '',
    guardian: '',
    phone: '',
    status: 'Active' as const,
    enrolled: '2026-10-12',
  }));
  const user: User = {
    id: 'teacher',
    name: 'Teacher',
    email: 'teacher@example.com',
    role: 'Teacher',
    active: true,
    classes: ['JHS 1'],
    classAllowedSubjects: { 'JHS 1': ['sub_eng'] },
  };
  const request: ScoreImportRequest = {
    sheet: parseScoreCsv(csv),
    classId: 'JHS 1',
    subject: 'English Language',
    studentOverrides: {},
  };
  return { state, user, request };
}
describe('assessment score sheet upload', () => {
  it('recalculates classmates when a groupwork import increases the shared required count', () => {
    const { state, user, request } = setup();
    request.sheet.category = 'groupwork';
    const row = (admission: string, count: number) => ({
      admission,
      name: admission,
      cells: Array.from({ length: count }, (_, index) => ({
        slotKey: `GW${index + 1}`,
        score: 15,
        maxPoints: 15,
        feedbackType: 'none' as const,
      })),
    });
    request.sheet.rows = [row('SN-1', 3), row('SN-2', 5)];
    const next = applyScoreImport(state, user, request);
    const key = gradeKey('SN-1', 1, 'English Language');
    expect(next.grades[key].sba).toBe(6);
    next.grades[key].exam = 38;
    next.grades[key].remark = 'Keep remark';
    request.sheet.rows = [row('SN-2', 7)];
    const updated = applyScoreImport(next, user, request);
    expect(updated.grades[key]).toEqual({ sba: 4, exam: 38, remark: 'Keep remark' });
    expect(
      courseworkAssessment(updated, 'SN-1', 'JHS 1', 'English Language').categoryDetails.Groupwork
        .maxRaw,
    ).toBe(105);
  });
  it('parses the sample format, preserves zero and absence, and updates cards and grades atomically', () => {
    const { state, user, request } = setup();
    const next = applyScoreImport(state, user, request);
    const assessment = courseworkAssessment(next, 'SN-1', 'JHS 1', 'English Language');
    expect(assessment.categoryDetails.Exercise).toEqual({
      earnedRaw: 25,
      maxRaw: 300,
      scaled15: 1.25,
      count: 3,
    });
    expect(next.grades[gradeKey('SN-1', 1, 'English Language')].sba).toBe(1);
    expect(next.grades[gradeKey('SN-2', 1, 'English Language')].sba).toBe(1);
    expect(next.grades[gradeKey('SN-3', 1, 'English Language')].sba).toBe(0);
    expect(state.assignments).toHaveLength(0);
    expect(state.grades).toEqual({});
  });
  it('uses admission numbers first, normalized reordered names next, and only suggests fuzzy matches', () => {
    const { state, request } = setup();
    const row = request.sheet.rows[0];
    expect(
      matchScoreStudent({ ...row, name: 'Different spelling' }, state.students, 'JHS 1').id,
    ).toBe('SN-1');
    expect(
      matchScoreStudent({ ...row, admission: '', name: 'LEARNER, Test' }, state.students, 'JHS 1')
        .id,
    ).toBe('SN-1');
    expect(
      matchScoreStudent({ ...row, admission: '', name: 'Test Learnr' }, state.students, 'JHS 1'),
    ).toMatchObject({ id: '', suggestion: 'SN-1' });
    expect(matchScoreStudent(row, state.students, 'JHS 2').id).toBe('');
    expect(matchScoreSubject('English', ['English Language'])).toBe('English Language');
    expect(matchScoreSubject('Englsh', ['English Language'])).toBe('');
  });
  it('rejects ambiguous, duplicate, invalid, and out-of-scope uploads without partial writes', () => {
    const { state, user, request } = setup();
    expect(() => applyScoreImport(state, { ...user, classes: [] }, request)).toThrow(
      'not assigned',
    );
    expect(() => applyScoreImport(state, user, { ...request, subject: 'Mathematics' })).toThrow(
      'not assigned',
    );
    expect(() => applyScoreImport(state, { ...user, role: 'Student' }, request)).toThrow(
      'permission',
    );
    expect(() =>
      applyScoreImport(state, user, { ...request, studentOverrides: { '1': 'SN-1' } }),
    ).toThrow('Duplicate');
    request.sheet.rows[0].cells[1].score = 99;
    expect(() => applyScoreImport(state, user, request)).toThrow('Invalid score');
    expect(state.grades).toEqual({});
    for (const value of ['16', '-1', 'NaN', 'text'])
      expect(() => parseScoreCsv(csv.replace('[ABS]', value))).toThrow();
    expect(() => parseScoreCsv(csv.replace('EXE2 (/15)', 'EXE1 (/15)'))).toThrow('duplicate');
  });
  it('repeated uploads replace slots, preserve blanks and exam marks, and exclude other terms', () => {
    const { state, user, request } = setup();
    const key = gradeKey('SN-1', 1, 'English Language');
    state.grades[key] = { sba: 0, exam: 35, remark: 'Keep remark' };
    let next = applyScoreImport(state, user, request);
    next.assignments = ensureClassCourseworkCards(next, 'JHS 1', 2).assignments;
    next.assignments.find(
      (a) => a.id.endsWith('exercise_term2') && a.subject === 'English Language',
    )!.slotScores = { 'SN-1': { EXE1: { score: 0, maxPoints: 15 } } };
    request.sheet.rows[0].cells = [
      { slotKey: 'EXE2', maxPoints: 15, score: 15, feedbackType: 'none' },
    ];
    next = applyScoreImport(next, user, request);
    next = applyScoreImport(next, user, request);
    expect(
      courseworkAssessment(next, 'SN-1', 'JHS 1', 'English Language').categoryDetails.Exercise,
    ).toMatchObject({ earnedRaw: 29, maxRaw: 300, count: 3 });
    expect(next.grades[key]).toEqual({ sba: 1, exam: 35, remark: 'Keep remark' });
    expect(() =>
      applyScoreImport({ ...next, settings: { ...next.settings, term: 2 } }, user, request),
    ).toThrow('active term');
  });
  it('replaces a previously scored category with absence and removes its stale report grade', () => {
    const { state, user, request } = setup();
    const next = applyScoreImport(state, user, request);
    request.sheet.rows[0].cells = request.sheet.rows[0].cells.map((c) => ({
      ...c,
      score: null,
      feedbackType: 'absent',
    }));
    expect(
      applyScoreImport(next, user, request).grades[gradeKey('SN-1', 1, 'English Language')].sba,
    ).toBe(0);
  });
  it('supports exam weighting and late marks without reviving legacy scores for blank feedback entries', () => {
    const { state, user, request } = setup();
    request.sheet.category = 'exam';
    request.sheet.rows = [
      {
        name: 'Test Learner',
        admission: 'SN-1',
        cells: [{ slotKey: 'Exam', score: 40, maxPoints: 80, feedbackType: 'late' }],
      },
    ];
    const next = applyScoreImport(state, user, request);
    expect(next.grades[gradeKey('SN-1', 1, 'English Language')].exam).toBe(25);
    const assignment = next.assignments.find((a) => a.id.endsWith(`exam_term1`))!;
    assignment.scores = { 'SN-1': { score: 80 } };
    request.sheet.rows[0].cells[0].score = null;
    const blank = applyScoreImport(next, user, request);
    expect(blank.grades[gradeKey('SN-1', 1, 'English Language')].exam).toBe(0);
  });
  it.runIf(!!process.env.AOS_SCORE_SAMPLE_PATH)(
    'reads the actual user sample without importing personal data into test fixtures',
    () => {
      const sheet = parseScoreCsv(readFileSync(process.env.AOS_SCORE_SAMPLE_PATH!, 'utf8'));
      expect(sheet).toMatchObject({
        className: 'JHS 1',
        subject: 'English Language',
        category: 'exercise',
        term: 1,
      });
      expect(sheet.rows).toHaveLength(31);
      expect(sheet.rows.filter((r) => r.cells.length)).toHaveLength(29);
      expect(sheet.rows[0].cells[0]).toMatchObject({ score: null, feedbackType: 'absent' });
    },
  );
});
