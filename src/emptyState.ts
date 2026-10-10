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
    studentConcessions: {},
    users: [],
    teacherAssignments: [],
    certificates: [],
    messages: [],
    logs: [],
    settings: {
      name: 'Ayisatu Owen Schools',
      motto: '',
      address: '',
      phone: '',
      email: '',
      year: '2026/2027',
      term: 1,
      vacation: '',
      reopening: '',
    },
  };
}
