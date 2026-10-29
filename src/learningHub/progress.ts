import type { HubSnapshot } from './types';

export function learningStatus(
  snapshot: HubSnapshot,
  studentId: string,
  lessonId: string,
  assignmentId?: string,
) {
  const attempts = snapshot.attempts.filter(
    (a) =>
      a.studentId === studentId &&
      a.lessonId === lessonId &&
      (!assignmentId || a.assignmentId === assignmentId),
  );
  const latest = [...attempts].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const read = snapshot.readings.some(
    (r) =>
      r.studentId === studentId &&
      r.lessonId === lessonId &&
      (!assignmentId || r.assignmentId === assignmentId),
  );
  const hasQuestions = !!snapshot.lessons.find((l) => l.id === lessonId)?.questions.length;
  return {
    attempts,
    latest,
    read,
    complete: read && (!hasQuestions || !!latest),
    label: latest
      ? latest.score >= 80
        ? 'Proficient'
        : latest.score >= 50
          ? 'Developing'
          : 'Needs practice'
      : read
        ? 'Lesson read'
        : 'Not started',
  };
}
export function recommendation(score: number | undefined, read: boolean): string {
  if (score === undefined)
    return read
      ? 'Try the practice questions to check understanding.'
      : 'Read the worked examples, then try the practice questions.';
  if (score < 50)
    return 'Revisit the worked examples with a teacher. Explain each step aloud, then retry this skill.';
  if (score < 80)
    return 'Review the feedback on missed questions and practise this skill again before moving on.';
  return 'Ready for a challenge: explain your method to a classmate and explore another lesson in this strand.';
}
