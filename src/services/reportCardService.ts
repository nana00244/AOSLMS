import { classSubjects, gradeKey, gradeLetter, type Grade, type State } from '../data';

export interface StudentReportCard {
  id: string;
  studentId: string;
  studentName: string;
  classId: string;
  term: number;
  year: string;
  subjects: (Grade & { subject: string; total: number; grade: string })[];
  overall: number;
  overallGrade: string;
  teacherRemark: string;
  certified: true;
}

/** Return only this student's certified report cards; draft/unverified reports stay private. */
export const reportCardService = {
  getReportCardsForStudent(state: State, studentId: string): StudentReportCard[] {
    const student = state.students.find((entry) => entry.id === studentId);
    if (!student) return [];
    const certifiedTerms = state.verified
      .filter((key) => key.startsWith(`${studentId}|`))
      .map((key) => Number(key.split('|')[1]))
      .filter((term) => Number.isInteger(term) && term >= 1 && term <= 3);
    return [...new Set(certifiedTerms)]
      .sort((a, b) => b - a)
      .map((term) => {
        const subjects = classSubjects(student.classId).map((subject) => {
          const grade = state.grades[gradeKey(student.id, term, subject)] || {
            sba: 0,
            exam: 0,
            remark: '',
          };
          const total = grade.sba + grade.exam;
          return { ...grade, subject, total, grade: gradeLetter(total) };
        });
        const overall = subjects.length
          ? subjects.reduce((sum, item) => sum + item.total, 0) / subjects.length
          : 0;
        return {
          id: `${student.id}|${term}`,
          studentId: student.id,
          studentName: student.name,
          classId: student.classId,
          term,
          year: state.settings.year,
          subjects,
          overall,
          overallGrade: gradeLetter(overall),
          teacherRemark: state.remarks[`${student.id}|${term}`] || '',
          certified: true as const,
        };
      });
  },
};
