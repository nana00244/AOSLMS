import type { Assignment, State, Student, Submission, User } from '../data';
import { uid } from '../data';

export interface StudentAssignment extends Assignment {
  subjectName: string;
  submission?: Submission;
  status: 'graded' | 'completed' | 'missing' | 'assigned';
}

export type StudentStreamItem =
  | { type: 'lesson'; id: string; title: string; description: string; date: string }
  | { type: 'assignment'; id: string; title: string; description: string; date: string }
  | { type: 'resource'; id: string; title: string; description: string; date: string };

/** Resolve only the authenticated student's linked profile; the first roster entry is a legacy demo fallback. */
export function getStudentProfile(state: State, studentUserId: string): Student | undefined {
  const user: User | undefined = state.users.find((entry) => entry.id === studentUserId);
  if (!user || user.role !== 'Student') return undefined;
  return state.students.find(
    (student) => student.id === user.studentId || student.id === studentUserId,
  );
}

function forStudent(assignment: Assignment, studentId: string): Assignment {
  const personalScore = assignment.scores?.[studentId];
  const personalSlots = assignment.slotScores?.[studentId];
  return {
    ...assignment,
    scores: personalScore ? { [studentId]: personalScore } : {},
    slotScores: personalSlots ? { [studentId]: personalSlots } : {},
  };
}

/** Return assignments for the student's enrolled class, with only their score and submission attached. */
export function getStudentAssignments(state: State, studentUserId: string): StudentAssignment[] {
  const student = getStudentProfile(state, studentUserId);
  if (!student?.classId) return [];
  return state.assignments
    .filter((assignment) => assignment.classId === student.classId)
    .map((assignment) => {
      const submission = state.submissions.find(
        (item) => item.assignmentId === assignment.id && item.studentId === student.id,
      );
      const due = new Date(`${assignment.due}T23:59:59`);
      const isPastDue = Number.isFinite(due.getTime()) && due.getTime() < Date.now();
      const graded =
        assignment.scores?.[student.id]?.score !== undefined || submission?.score !== undefined;
      return {
        ...forStudent(assignment, student.id),
        subjectName: assignment.subject || 'General',
        submission,
        status: graded ? 'graded' : submission ? 'completed' : isPastDue ? 'missing' : 'assigned',
      };
    });
}

/** Deep-link lookup rejects assignments outside this student's enrolled classroom. */
export function getAssignmentDetails(
  state: State,
  assignmentId: string,
  studentUserId: string,
): StudentAssignment | null {
  const student = getStudentProfile(state, studentUserId);
  const assignment = state.assignments.find((entry) => entry.id === assignmentId);
  if (!assignment) return null;
  if (!student || student.classId !== assignment.classId) {
    throw new Error('Access denied: this assignment is not for your enrolled class.');
  }
  return (
    getStudentAssignments(state, studentUserId).find((entry) => entry.id === assignmentId) || null
  );
}

/** Save or replace only the authenticated student's own submission. */
export function submitAssignment(
  state: State,
  assignmentId: string,
  studentUserId: string,
  input: { text?: string; link?: string; filename?: string; storagePath?: string },
): { state: State; submission: Submission } {
  const student = getStudentProfile(state, studentUserId);
  const assignment = state.assignments.find((entry) => entry.id === assignmentId);
  if (!student) throw new Error('Student profile not found.');
  if (!assignment || assignment.classId !== student.classId) {
    throw new Error('Access denied: this assignment is not for your enrolled class.');
  }
  const existing = state.submissions.find(
    (entry) => entry.assignmentId === assignmentId && entry.studentId === student.id,
  );
  const due = new Date(`${assignment.due}T23:59:59`);
  const submission: Submission = {
    id: existing?.id || `submission-${uid()}`,
    assignmentId,
    studentId: student.id,
    text: input.text?.trim() || '',
    link: input.link?.trim() || '',
    date: new Date().toISOString(),
    filename: input.filename || existing?.filename,
    storagePath: input.storagePath || existing?.storagePath,
    isLate: Number.isFinite(due.getTime()) && Date.now() > due.getTime(),
  };
  const pastDue = Number.isFinite(due.getTime()) && Date.now() > due.getTime();
  const next = state.submissions.filter((entry) => entry.id !== submission.id);
  return { state: { ...state, submissions: [...next, submission] }, submission };
}

/** Aggregate class lessons, assignments, and resources without including any other class. */
export function getStudentStream(state: State, studentUserId: string): StudentStreamItem[] {
  const student = getStudentProfile(state, studentUserId);
  if (!student) return [];
  const classId = student.classId;
  const items: StudentStreamItem[] = [
    ...state.messages
      .filter((message) => message.classId === classId || message.classId === 'All classes')
      .map((message) => ({
        type: 'lesson' as const,
        id: message.id,
        title: message.title,
        description: message.body,
        date: message.date,
      })),
    ...state.assignments
      .filter((assignment) => assignment.classId === classId)
      .map((assignment) => ({
        type: 'assignment' as const,
        id: assignment.id,
        title: assignment.title,
        description: assignment.description,
        date: assignment.due,
      })),
    ...state.resources
      .filter((resource) => {
        const targets = resource.targetClassIds || [resource.classId];
        return targets.includes('all') || targets.includes(classId);
      })
      .map((resource) => ({
        type: 'resource' as const,
        id: resource.id,
        title: resource.title,
        description: resource.description || '',
        date: resource.date,
      })),
  ];
  return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}
