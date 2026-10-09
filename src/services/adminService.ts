import {
  classSubjects,
  courseworkSubjectId,
  uid,
  type State,
  type TeacherClassRecord,
  type User,
} from '../data';

function audit(state: State, adminUserId: string, action: string, details: string): State {
  const actor = state.users.find((user) => user.id === adminUserId)?.name || adminUserId;
  return {
    ...state,
    logs: [
      {
        id: uid(),
        action: `${action}: ${details}`,
        actor,
        date: new Date().toISOString(),
        type: 'Administrator',
      },
      ...state.logs,
    ],
  };
}

function resolveSubject(classId: string, subjectId: string) {
  return classSubjects(classId).find(
    (subject) => subject === subjectId || courseworkSubjectId(subject) === subjectId,
  );
}

export const adminService = {
  /** Assign a teacher to a class as a general instructor or subject teacher. */
  assignTeacherToClass(
    state: State,
    teacherUserId: string,
    classId: string,
    options: { isGeneralInstructor?: boolean; isClassTeacher?: boolean; subjectId?: string },
    adminUserId: string,
  ): { state: State; assignment: TeacherClassRecord } {
    const teacher = state.users.find(
      (user) => user.id === teacherUserId && user.role === 'Teacher',
    );
    if (!teacher || !state.classes.includes(classId))
      throw new Error('Choose a valid teacher and class.');
    const isGeneralInstructor = Boolean(options.isGeneralInstructor);
    const subject = isGeneralInstructor
      ? undefined
      : resolveSubject(classId, options.subjectId || '');
    if (!isGeneralInstructor && !subject) throw new Error('Choose a valid subject for this class.');
    const assignment: TeacherClassRecord = {
      id: `tc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      teacherUserId,
      teacherId: teacherUserId,
      classId,
      subjectId: isGeneralInstructor ? 'all' : courseworkSubjectId(subject!),
      isGeneralInstructor,
      isClassTeacher: Boolean(options.isClassTeacher),
      createdAt: new Date().toISOString(),
      createdBy: adminUserId,
    };
    const allowed = { ...(teacher.classAllowedSubjects || {}) };
    if (isGeneralInstructor) delete allowed[classId];
    else allowed[classId] = [...new Set([...(allowed[classId] || []), assignment.subjectId])];
    const updatedUser: User = {
      ...teacher,
      classes: [...new Set([...teacher.classes, classId])],
      classAllowedSubjects: allowed,
    };
    let next: State = {
      ...state,
      users: state.users.map((user) => (user.id === teacher.id ? updatedUser : user)),
      teacherAssignments: [...(state.teacherAssignments || []), assignment],
    };
    next = audit(
      next,
      adminUserId,
      'ASSIGN_TEACHER_ROLE',
      `Assigned teacher ${teacherUserId} to class ${classId} (Role: ${isGeneralInstructor ? 'General Instructor' : 'Subject Teacher'})`,
    );
    return { state: next, assignment };
  },

  /** Revoke an assignment and recompute the teacher's remaining subject access. */
  revokeTeacherAssignment(state: State, assignmentId: string, adminUserId: string): State {
    const assignments = state.teacherAssignments || [];
    const revoked = assignments.find((assignment) => assignment.id === assignmentId);
    if (!revoked) return state;
    const remaining = assignments.filter((assignment) => assignment.id !== assignmentId);
    const teacher = state.users.find((user) => user.id === revoked.teacherUserId);
    let users = state.users;
    if (teacher) {
      const remainingForClass = remaining.filter(
        (assignment) =>
          assignment.teacherUserId === teacher.id && assignment.classId === revoked.classId,
      );
      const allowed = { ...(teacher.classAllowedSubjects || {}) };
      const hasGeneral = remainingForClass.some((assignment) => assignment.isGeneralInstructor);
      if (hasGeneral) delete allowed[revoked.classId];
      else if (remainingForClass.length) {
        allowed[revoked.classId] = [
          ...new Set(remainingForClass.map((assignment) => assignment.subjectId)),
        ];
      } else {
        delete allowed[revoked.classId];
      }
      users = state.users.map((user) =>
        user.id === teacher.id
          ? {
              ...user,
              classes: remainingForClass.length
                ? user.classes
                : user.classes.filter((classId) => classId !== revoked.classId),
              classAllowedSubjects: allowed,
            }
          : user,
      );
    }
    let next: State = { ...state, users, teacherAssignments: remaining };
    next = audit(
      next,
      adminUserId,
      'REVOKE_TEACHER_ROLE',
      `Revoked teacher class assignment ${assignmentId}`,
    );
    return next;
  },

  /** Keep persisted assignment records in step with the administrator's teacher profile editor. */
  syncTeacherAssignments(state: State, teacher: User, adminUserId: string): State {
    const previous = state.teacherAssignments || [];
    if (teacher.role !== 'Teacher') {
      const removed = previous.filter((assignment) => assignment.teacherUserId === teacher.id);
      let next: State = {
        ...state,
        teacherAssignments: previous.filter(
          (assignment) => assignment.teacherUserId !== teacher.id,
        ),
      };
      removed.forEach((record) => {
        next = audit(
          next,
          adminUserId,
          'REVOKE_TEACHER_ROLE',
          `Revoked teacher class assignment ${record.id}`,
        );
      });
      return next;
    }
    const desired: Omit<TeacherClassRecord, 'id' | 'createdAt' | 'createdBy'>[] = [];
    teacher.classes.forEach((classId) => {
      const whitelist = teacher.classAllowedSubjects?.[classId];
      if (whitelist === undefined) {
        desired.push({
          teacherUserId: teacher.id,
          teacherId: teacher.id,
          classId,
          subjectId: 'all',
          isGeneralInstructor: true,
          isClassTeacher: true,
        });
      } else {
        whitelist.forEach((subjectId) =>
          desired.push({
            teacherUserId: teacher.id,
            teacherId: teacher.id,
            classId,
            subjectId,
            isGeneralInstructor: false,
            isClassTeacher: false,
          }),
        );
      }
    });
    const currentForTeacher = previous.filter(
      (assignment) => assignment.teacherUserId === teacher.id,
    );
    const matchedIds = new Set<string>();
    const records = desired.map((target) => {
      const match = currentForTeacher.find(
        (record) =>
          !matchedIds.has(record.id) &&
          record.classId === target.classId &&
          record.subjectId === target.subjectId,
      );
      if (match) {
        matchedIds.add(match.id);
        return match;
      }
      return {
        ...target,
        id: `tc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        createdAt: new Date().toISOString(),
        createdBy: adminUserId,
      };
    });
    const removed = currentForTeacher.filter((record) => !matchedIds.has(record.id));
    const newRecords = records.filter(
      (record) => !currentForTeacher.some((old) => old.id === record.id),
    );
    let next: State = {
      ...state,
      teacherAssignments: [
        ...previous.filter((assignment) => assignment.teacherUserId !== teacher.id),
        ...records,
      ],
    };
    newRecords.forEach((record) => {
      next = audit(
        next,
        adminUserId,
        'ASSIGN_TEACHER_ROLE',
        `Assigned teacher ${teacher.id} to class ${record.classId} (Role: ${record.isGeneralInstructor ? 'General Instructor' : 'Subject Teacher'}${record.subjectId === 'all' ? '' : `, ${record.subjectId}`})`,
      );
    });
    removed.forEach((record) => {
      next = audit(
        next,
        adminUserId,
        'REVOKE_TEACHER_ROLE',
        `Revoked teacher class assignment ${record.id}`,
      );
    });
    return next;
  },

  getStats(state: State) {
    return {
      studentsCount: state.students.length,
      classesCount: state.classes.length,
      staffCount: state.users.filter((user) => user.role === 'Teacher').length,
      recentActivity: [
        { id: 1, text: 'Curriculum & 48-card SBA matrix synchronized', time: 'Just now' },
        { id: 2, text: 'Terminal report card calculations locked for active term', time: 'Today' },
        { id: 3, text: 'Tuition and fee reconciliations updated', time: 'Today' },
      ],
    };
  },
};
