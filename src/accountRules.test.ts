import { describe, expect, it } from 'vitest';
import { loginIdentifier, normalizeUsername, normalizeTeachingAccess } from './accountRules';
import { seed, type User } from './data';
import { canTeach, projectWorkspace } from './backendAccess';
import { teacherService } from './services/teacherService';

describe('school usernames and mixed teaching assignments', () => {
  it('accepts plain usernames and preserves legacy email login', () => {
    expect(normalizeUsername(' Teacher.One ')).toBe('teacher.one');
    expect(loginIdentifier(' Teacher.One ')).toBe('teacher.one@users.aoslms.invalid');
    expect(loginIdentifier(' Admin@Example.com ')).toBe('admin@example.com');
    for (const invalid of ['ab', 'user@example.com', 'first last', '-teacher'])
      expect(() => normalizeUsername(invalid)).toThrow();
  });
  it('normalizes per-class subjects without granting stale class access', () => {
    expect(
      normalizeTeachingAccess(['A', 'B', 'A'], { B: ['Mathematics'], C: ['English Language'] }, [
        'A',
        'B',
      ]),
    ).toEqual({ classes: ['A', 'B'], classAllowedSubjects: { B: ['sub_math'] } });
    expect(() => normalizeTeachingAccess(['A'], { A: [] }, ['A'])).toThrow('at least one');
    expect(() => normalizeTeachingAccess(['A'], { A: ['Unknown'] }, ['A'])).toThrow(
      'valid subject',
    );
    expect(() => normalizeTeachingAccess(['Missing'], {}, ['A'])).toThrow('existing classes');
  });
  it('supports all subjects in A and only mathematics in B in both UI and server', async () => {
    const state = seed();
    state.classes = ['A', 'B', 'C'];
    const teacher: User = {
      id: 'mixed',
      name: 'Mixed Teacher',
      email: 'mixed@example.com',
      role: 'Teacher',
      active: true,
      ...normalizeTeachingAccess(['A', 'B'], { B: ['Mathematics'] }, state.classes),
    };
    state.users = [teacher];
    state.assignments = ['A', 'B', 'C'].flatMap((classId) =>
      ['Mathematics', 'English Language'].map((subject) => ({
        id: `${classId}-${subject}`,
        classId,
        subject,
        title: 'Test',
        points: 10,
        due: '2026-10-31',
        description: '',
        category: 'Homework' as const,
      })),
    );
    expect(canTeach(teacher, 'A', 'English Language')).toBe(true);
    expect(canTeach(teacher, 'B', 'Mathematics')).toBe(true);
    expect(canTeach(teacher, 'B', 'English Language')).toBe(false);
    expect(canTeach(teacher, 'C', 'Mathematics')).toBe(false);
    expect(projectWorkspace(state, teacher).assignments.map((a) => a.id)).toEqual([
      'A-Mathematics',
      'A-English Language',
      'B-Mathematics',
    ]);
    const assigned = await teacherService.getAssignedClasses(state, teacher.id);
    expect(assigned.find((a) => a.classId === 'A')?.isClassTeacher).toBe(true);
    expect(
      assigned.filter((a) => a.classId === 'B').map((a) => [a.subject.name, a.isClassTeacher]),
    ).toEqual([['Mathematics', false]]);
    expect(assigned.some((a) => a.classId === 'C')).toBe(false);
  });
});
