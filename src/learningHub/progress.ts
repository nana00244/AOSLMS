import type { HubSnapshot } from './types';
import { masteryForLesson, type PracticeHistory } from './questionBank';

export function learningStatus(
  snapshot: HubSnapshot,
  studentId: string,
  lessonId: string,
  assignmentId?: string,
) {
  const attempts = snapshot.attempts.filter(
    (a) =>
      a.studentId === studentId &&
      (a.lessonId === lessonId || a.outcomes?.some((o) => o.lessonId === lessonId)) &&
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
  const history: PracticeHistory[] = attempts.flatMap((a) =>
    a.kind && a.kind !== 'legacy' && a.outcomes
      ? [
          {
            kind: a.kind,
            score: a.score,
            total: a.total,
            createdAt: a.createdAt,
            outcomes: a.outcomes,
          },
        ]
      : [],
  );
  const mastery = masteryForLesson(lessonId, history);
  return {
    attempts,
    latest,
    read,
    complete: read && (!hasQuestions || !!latest),
    label: mastery === 'Not started' && latest ? 'Attempted' : mastery,
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
