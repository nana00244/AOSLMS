import { describe, expect, it } from 'vitest';
import {
  courseworkAssessment,
  ensureClassCourseworkCards,
  gradeKey,
  studentGrades,
  type Assignment,
} from './data';
import { emptyState } from './emptyState';

function fixture() {
  const state = emptyState();
  state.classes = ['JHS 1'];
  state.students = ['A', 'B', 'C', 'D'].map((id) => ({
    id,
    name: id,
    classId: 'JHS 1',
    gender: '',
    dob: '',
    guardian: '',
    phone: '',
    status: 'Active' as const,
    enrolled: '',
  }));
  state.assignments = ensureClassCourseworkCards(state, 'JHS 1', 1).assignments.filter(
    (a) => a.subject === 'English Language',
  );
  const card = (category: string) =>
    state.assignments.find((a) => a.id.endsWith(`${category}_term1`))!;
  const fill = (assignment: Assignment, id: string, count: number, score = 15) => {
    while (assignment.slots!.length < count) {
      const index = assignment.slots!.length + 1;
      assignment.slots!.push({ slotKey: `extra${index}`, title: `Entry ${index}`, maxPoints: 15 });
    }
    assignment.slotScores![id] = Object.fromEntries(
      assignment.slots!.slice(0, count).map((slot) => [slot.slotKey, { score, maxPoints: 15 }]),
    );
  };
  const assess = (id: string) => courseworkAssessment(state, id, 'JHS 1', 'English Language');
  return { state, card, fill, assess };
}

describe('required-entry SBA calculation', () => {
  it('scales 20 exercises and 20 homework from /300 to /15, then five categories /75 to /50', () => {
    const { state, card, fill, assess } = fixture();
    for (const category of ['exercise', 'homework']) fill(card(category), 'A', 20);
    for (const category of ['groupwork', 'quiz', 'project']) fill(card(category), 'A', 7);
    expect(assess('A')).toMatchObject({
      categories: { Exercise: 15, Homework: 15, Groupwork: 15, Quiz: 15, Project: 15 },
      rawSba: 75,
      sba: 50,
    });
    expect(assess('A').categoryDetails.Exercise.maxRaw).toBe(300);
    state.grades[gradeKey('A', 1, 'English Language')] = { sba: 12, exam: 40, remark: 'Keep this' };
    expect(
      studentGrades(state, state.students[0]).find((g) => g.subject === 'English Language'),
    ).toMatchObject({ sba: 50, exam: 40, remark: 'Keep this', recorded: true });
  });

  it.each(['exercise', 'homework', 'groupwork', 'quiz', 'project'])(
    'uses seven shared required entries for %s, including students with no marks',
    (category) => {
      const { card, fill, assess } = fixture();
      fill(card(category), 'A', 5);
      fill(card(category), 'B', 3);
      fill(card(category), 'C', 7);
      const key = {
        exercise: 'Exercise',
        homework: 'Homework',
        groupwork: 'Groupwork',
        quiz: 'Quiz',
        project: 'Project',
      }[category] as 'Exercise' | 'Homework' | 'Groupwork' | 'Quiz' | 'Project';
      for (const id of ['A', 'B', 'C', 'D'])
        expect(assess(id).categoryDetails[key].maxRaw).toBe(105);
      expect(assess('A').categories[key]).toBeCloseTo((75 / 105) * 15);
      expect(assess('B').categories[key]).toBeCloseTo((45 / 105) * 15);
      expect(assess('C').categories[key]).toBe(15);
      expect(assess('D').categories[key]).toBe(0);
    },
  );

  it('ignores unused template slots and rounds only the final SBA', () => {
    const { card, fill, assess } = fixture();
    fill(card('exercise'), 'A', 1);
    fill(card('homework'), 'A', 10);
    expect(assess('A')).toMatchObject({
      categories: { Exercise: 15, Homework: 15 },
      rawSba: 30,
      sba: 20,
    });
    fill(card('exercise'), 'A', 20, 12);
    fill(card('homework'), 'A', 20, 12);
    for (const category of ['groupwork', 'quiz', 'project']) fill(card(category), 'A', 7, 12);
    expect(assess('A')).toMatchObject({ rawSba: 60, sba: 40 });
  });

  it('counts zero and absence entries, keeps late scores, and excludes other classes, subjects and terms', () => {
    const { state, card, fill, assess } = fixture();
    const group = card('groupwork');
    fill(group, 'A', 3);
    const slots = group.slots!;
    group.slotScores!.A[slots[0].slotKey] = { score: 0, maxPoints: 15 };
    group.slotScores!.A[slots[1].slotKey] = { score: null, feedbackType: 'absent' };
    group.slotScores!.A[slots[2].slotKey].feedbackType = 'late';
    state.students.push({ ...state.students[0], id: 'OUT', classId: 'JHS 2' });
    fill(group, 'OUT', 10);
    for (const changes of [{ classId: 'JHS 2' }, { subject: 'Mathematics' }, { term: 'Term 2' }]) {
      const other = structuredClone(group);
      Object.assign(other, changes, { id: JSON.stringify(changes) });
      fill(other, 'B', 10);
      state.assignments.push(other);
    }
    expect(assess('A').categoryDetails.Groupwork).toMatchObject({
      earnedRaw: 15,
      maxRaw: 45,
      scaled15: 5,
      count: 3,
    });
    expect(assess('B').categories.Groupwork).toBe(0);
  });
});
