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

/** Resolve only classes explicitly assigned in the teacher profile or timetable. */
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
    const teacherIdentities = new Set(
      [teacher.id, teacher.email, teacher.name].map((identity) => identity.trim().toLowerCase()),
    );
    const scheduledSubjects = new Map<string, Set<string>>();
    state.periods.forEach((period) => {
      if (!teacherIdentities.has(period.teacher.trim().toLowerCase())) return;
      if (!state.classes.includes(period.classId)) return;
      assignedClassIds.add(period.classId);
      const subjects = scheduledSubjects.get(period.classId) || new Set<string>();
      subjects.add(period.subject);
      scheduledSubjects.set(period.classId, subjects);
    });

    const results: TeacherClassAssignment[] = [];
    assignedClassIds.forEach((classId) => {
      if (classId.trim().toLowerCase() === 'class stream') return;
      const curriculum = classSubjects(classId).map((name) => ({
        id: name,
        name,
      }));
      const hasWhitelist = teacher.classAllowedSubjects?.[classId] !== undefined;
      const configuredSubjects = teacher.classAllowedSubjects?.[classId] || [];
      const scheduleOnly = !teacher.classes.includes(classId);
      const assigned = scheduleOnly
        ? curriculum.filter((subject) => scheduledSubjects.get(classId)?.has(subject.name))
        : hasWhitelist
          ? curriculum.filter(
              (subject) =>
                configuredSubjects.includes(subject.id) ||
                configuredSubjects.includes(subject.name) ||
                configuredSubjects.includes(courseworkSubjectId(subject.name)),
            )
          : curriculum;

      if (!assigned.length) return;
      if (assigned.length === curriculum.length && !scheduleOnly) {
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
  const identity = new Set([teacher.id, teacher.email, teacher.name].map((x) => x.toLowerCase()));
  state.periods.forEach((period) => {
    if (
      identity.has(period.teacher.trim().toLowerCase()) &&
      state.classes.includes(period.classId)
    ) {
      classesAssignedByProfile.add(period.classId);
    }
  });
  return [...classesAssignedByProfile].filter((classId) => {
    if (!state.classes.includes(classId)) return false;
    const whitelist = teacher.classAllowedSubjects?.[classId];
    return whitelist === undefined || whitelist.length > 0;
  });
}
