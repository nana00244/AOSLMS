import type { State } from './data.ts';
/** Cascade only records belonging to explicitly selected students. Auth profiles are disabled by the database transaction. */
export function removeStudents(state: State, ids: string[], unlinkUsers = false): State {
  const selected = new Set(ids);
  const mapWithout = (records: Record<string, any>, idPart = 0) =>
    Object.fromEntries(
      Object.entries(records).filter(([key]) => !selected.has(key.split('|')[idPart])),
    );
  return {
    ...state,
    students: state.students.filter((s) => !selected.has(s.id)),
    attendance: mapWithout(state.attendance, 2),
    grades: mapWithout(state.grades),
    remarks: mapWithout(state.remarks),
    conduct: mapWithout(state.conduct),
    verified: state.verified.filter((k) => !selected.has(k.split('|')[0])),
    studentConcessions: mapWithout(state.studentConcessions || {}),
    studentBills: mapWithout(state.studentBills || {}),
    payments: state.payments.filter((p) => !selected.has(p.studentId)),
    submissions: state.submissions.filter((s) => !selected.has(s.studentId)),
    certificates: state.certificates.filter((c) => !selected.has(c.studentId)),
    assignments: state.assignments.map((a) => ({
      ...a,
      ...(a.scores ? { scores: mapWithout(a.scores) } : {}),
      ...(a.slotScores ? { slotScores: mapWithout(a.slotScores) } : {}),
    })),
    users: unlinkUsers
      ? state.users.map((u) =>
          u.studentId && selected.has(u.studentId)
            ? { ...u, studentId: undefined, active: false }
            : u,
        )
      : state.users,
  };
}

