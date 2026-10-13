import type { State } from './data';

/** Real accounts start empty; demo students and financial records are never uploaded. */
export function emptyState(): State {
  return {
    version: 1,
    classes: [],
    students: [],
    assignments: [],
    submissions: [],
    attendance: {},
    grades: {},
    remarks: {},
    conduct: {},
    verified: [],
    resources: [],
    periods: [],
    payments: [],
    expenses: [],
    payroll: [],
    fees: {},
    studentBills: {},
    studentConcessions: {},
    users: [],
    teacherAssignments: [],
    certificates: [],
    messages: [],
    logs: [],
    settings: {
      name: '',
      motto: '',
      address: '',
      phone: '',
      email: '',
      year: '',
      term: 1,
      vacation: '',
      reopening: '',
    },
  };
}
