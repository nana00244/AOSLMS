import { classSubjects, courseworkSubjectId, type State, type User } from '../data';

export interface TeacherClassAssignment {
  id: string;
  classId: string;
  subjectId: string;
  isAllSubjects: boolean;
  isClassTeacher: boolean;
  isGeneralInstructor: boolean;
  class: { id: string; name: string };
  subject: { id: string; name: string };
  subjects: { id: string; name: string }[];
  assignedSubjects: { id: string; name: string }[];
  allSubjectIds: string[];
}

const findTeacher = (state: State, teacherUserId: string) =>
  state.users.find(
    (user) =>
      user.role === 'Teacher' &&
      [user.id, user.email, user.name].some(
        (identity) => identity?.trim().toLowerCase() === teacherUserId.trim().toLowerCase(),
      ),
  );

/** Teaching permissions come only from the administrator-managed profile. */
export const teacherService = {
  getAssignedClasses: async (
    state: State,
    teacherUserId: string,
  ): Promise<TeacherClassAssignment[]> => {
    if (!teacherUserId?.trim()) return [];
    const teacher = findTeacher(state, teacherUserId);
    if (!teacher) return [];

    const assignedClassIds = new Set(
      teacher.classes.filter((classId) => state.classes.includes(classId)),
    );

    const results: TeacherClassAssignment[] = [];
    assignedClassIds.forEach((classId) => {
      if (classId.trim().toLowerCase() === 'class stream') return;
      const curriculum = classSubjects(classId).map((name) => ({
        id: name,
        name,
      }));
      const hasWhitelist = teacher.classAllowedSubjects?.[classId] !== undefined;
      const configuredSubjects = teacher.classAllowedSubjects?.[classId] || [];
      const assigned = hasWhitelist
        ? curriculum.filter(
            (subject) =>
              configuredSubjects.includes(subject.id) ||
              configuredSubjects.includes(subject.name) ||
              configuredSubjects.includes(courseworkSubjectId(subject.name)),
          )
        : curriculum;

      if (!assigned.length) return;
      if (!hasWhitelist) {
        results.push({
          id: `all_${teacher.id}_${classId}`,
          classId,
          subjectId: 'all',
          isAllSubjects: true,
          isClassTeacher: true,
          isGeneralInstructor: true,
          class: { id: classId, name: classId },
          subject: { id: 'all', name: 'All Subjects (General Instructor)' },
          subjects: curriculum,
          assignedSubjects: curriculum,
          allSubjectIds: curriculum.map((subject) => subject.id),
        });
        return;
      }
      assigned.forEach((subject) =>
        results.push({
          id: `tc_${classId}_${subject.id}`,
          classId,
          subjectId: subject.id,
          isAllSubjects: false,
          isClassTeacher: false,
          isGeneralInstructor: false,
          class: { id: classId, name: classId },
          subject,
          subjects: [subject],
          assignedSubjects: [subject],
          allSubjectIds: [subject.id],
        }),
      );
    });
    return results;
  },

  getAssignedStudentsForTeacher: async (state: State, teacherUserId: string) => {
    const assigned = await teacherService.getAssignedClasses(state, teacherUserId);
    const assignedClassIds = new Set(assigned.map((assignment) => assignment.classId));
    return state.students
      .filter((student) => assignedClassIds.has(student.classId))
      .map((student) => {
        const user = state.users.find(
          (candidate) => candidate.role === 'Student' && candidate.name === student.name,
        );
        const [firstName = '', ...lastNames] = student.name.split(' ');
        return {
          ...student,
          user,
          firstName,
          lastName: lastNames.join(' '),
          email: user?.email || '',
        };
      });
  },
};

export function assignedClassIdsForTeacher(state: State, teacher: User | undefined): string[] {
  if (!teacher) return [];
  const classesAssignedByProfile = new Set(teacher.classes);
  return [...classesAssignedByProfile].filter((classId) => {
    if (!state.classes.includes(classId)) return false;
    const whitelist = teacher.classAllowedSubjects?.[classId];
    return whitelist === undefined || whitelist.length > 0;
  });
}
