import type { HubLesson, HubQuestion } from './catalog.ts';

export type PracticeKind = 'practice' | 'quiz' | 'unit-test';
export type MasteryLevel = 'Not started' | 'Attempted' | 'Familiar' | 'Proficient' | 'Mastered';
export const masteryLevels: MasteryLevel[] = [
  'Not started',
  'Attempted',
  'Familiar',
  'Proficient',
  'Mastered',
];
export const setSizes: Record<PracticeKind, number> = { practice: 4, quiz: 5, 'unit-test': 10 };
export interface BankQuestion extends HubQuestion {
  lessonId: string;
}
export interface QuestionOutcome {
  questionId: string;
  lessonId: string;
  correct: boolean;
}
export interface PracticeHistory {
  kind: PracticeKind;
  score: number;
  total: number;
  createdAt: string;
  outcomes: QuestionOutcome[];
}
export interface ReviewState {
  questionId: string;
  lessonId: string;
  misses: number;
  streak: number;
  dueAt: string;
}

// Use platform entropy in production; injectable randomness keeps scheduling tests deterministic.
export function secureRandom(): number {
  const value = new Uint32Array(1);
  crypto.getRandomValues(value);
  return value[0] / 4294967296;
}
export function shuffle<T>(items: readonly T[], random: () => number = secureRandom): T[] {
  const output = [...items];
  for (let i = output.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [output[i], output[j]] = [output[j], output[i]];
  }
  return output;
}
export function reviewQueue(history: PracticeHistory[], now = new Date()): ReviewState[] {
  const states = new Map<string, ReviewState>();
  for (const attempt of [...history].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
    for (const result of attempt.outcomes) {
      const old = states.get(result.questionId);
      if (!result.correct)
        states.set(result.questionId, {
          ...result,
          misses: (old?.misses || 0) + 1,
          streak: 0,
          dueAt: attempt.createdAt,
        });
      else if (old) {
        const streak = old.streak + 1;
        const delay = [1, 3, 7, 14, 30][Math.min(streak - 1, 4)] * 86400000;
        states.set(result.questionId, {
          ...old,
          streak,
          dueAt: new Date(Date.parse(attempt.createdAt) + delay).toISOString(),
        });
      }
    }
  }
  return [...states.values()]
    .filter((s) => Date.parse(s.dueAt) <= now.valueOf())
    .sort((a, b) => a.streak - b.streak || a.dueAt.localeCompare(b.dueAt));
}
export function assessmentLessons(
  anchor: HubLesson,
  lessons: HubLesson[],
  kind: PracticeKind,
): HubLesson[] {
  if (kind === 'practice') return [anchor];
  const eligible = lessons.filter((l) => l.subject === anchor.subject && l.level === anchor.level);
  if (kind === 'unit-test') return eligible;
  // Curriculum order, through the selected topic, limits a quiz to preceding material in its strand.
  const strand = eligible.filter((l) => l.strand === anchor.strand);
  const index = strand.findIndex((l) => l.id === anchor.id);
  return strand.slice(0, index + 1);
}
export function drawQuestions(
  anchor: HubLesson,
  lessons: HubLesson[],
  kind: PracticeKind,
  history: PracticeHistory[],
  served: string[] = [],
  now = new Date(),
  random = secureRandom,
): BankQuestion[] {
  const bank = assessmentLessons(anchor, lessons, kind).flatMap((l) =>
    l.questions.map((q) => ({ ...q, id: `${l.id}::${q.id}`, lessonId: l.id })),
  );
  const size = setSizes[kind];
  if (bank.length < size)
    throw new Error(
      `This ${kind} needs at least ${size} distinct questions. Its question bank is not ready yet.`,
    );
  const seen = new Set([...served, ...history.flatMap((h) => h.outcomes.map((o) => o.questionId))]);
  const due = new Map(reviewQueue(history, now).map((s, i) => [s.questionId, i]));
  const selected: BankQuestion[] = [];
  const remaining = new Map(bank.map((q) => [q.id, q]));
  function take(candidates: BankQuestion[], limit: number) {
    // Each tier cycles through topics before taking a second question from the same topic.
    const groups = new Map<string, BankQuestion[]>();
    for (const q of shuffle(candidates, random)) {
      const group = groups.get(q.lessonId) || [];
      group.push(q);
      groups.set(q.lessonId, group);
    }
    const topicIds = shuffle([...groups.keys()], random);
    while (selected.length < limit) {
      let added = false;
      for (const id of topicIds) {
        const q = groups.get(id)!.shift();
        if (q && remaining.has(q.id)) {
          selected.push(q);
          remaining.delete(q.id);
          added = true;
          if (selected.length === limit) break;
        }
      }
      if (!added) break;
    }
  }
  // Immediate recovery has precedence; fresh content is drawn before previously successful items.
  take(
    bank.filter((q) => due.has(q.id)).sort((a, b) => due.get(a.id)! - due.get(b.id)!),
    size,
  );
  take(
    bank.filter((q) => remaining.has(q.id) && !seen.has(q.id)),
    size,
  );
  take(
    bank.filter((q) => remaining.has(q.id)),
    size,
  );
  return shuffle(selected, random).map((q) => {
    const choices = shuffle(
      q.options.map((text, index) => ({ text, index })),
      random,
    );
    return {
      ...q,
      options: choices.map((c) => c.text),
      answer: choices.findIndex((c) => c.index === q.answer),
    };
  });
}
export function masteryForLesson(lessonId: string, history: PracticeHistory[]): MasteryLevel {
  let level = 0,
    practiceStreak80 = 0,
    scoreStreak90 = 0;
  for (const attempt of [...history].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
    const outcomes = attempt.outcomes.filter((o) => o.lessonId === lessonId);
    if (!outcomes.length) continue;
    level = Math.max(level, 1);
    const skillScore = (100 * outcomes.filter((o) => o.correct).length) / outcomes.length;
    const completePractice =
      attempt.kind === 'practice' && attempt.total === 4 && outcomes.length === 4;
    if (completePractice && attempt.score >= 70) level = Math.max(level, 2);
    practiceStreak80 = completePractice && attempt.score >= 80 ? practiceStreak80 + 1 : 0;
    scoreStreak90 = completePractice && attempt.score >= 90 ? scoreStreak90 + 1 : 0;
    if (
      (attempt.kind === 'quiz' && attempt.total === 5 && attempt.score >= 80 && skillScore >= 80) ||
      practiceStreak80 >= 2
    )
      level = Math.max(level, 3);
    if (
      (attempt.kind === 'unit-test' &&
        attempt.total === 10 &&
        attempt.score >= 90 &&
        skillScore >= 90) ||
      scoreStreak90 >= 2
    )
      level = 4;
  }
  return masteryLevels[level];
}
export function gradeSession(questions: BankQuestion[], answers: number[]) {
  if (!questions.length) throw new Error('This assessment has no questions.');
  if (answers.length !== questions.length)
    throw new Error('Answer every question before submitting.');
  const feedback = questions.map((q, i) => {
    if (!Number.isInteger(answers[i]) || answers[i] < 0 || answers[i] >= q.options.length)
      throw new Error('Choose a valid answer for every question.');
    return {
      questionId: q.id,
      lessonId: q.lessonId,
      correct: answers[i] === q.answer,
      answer: q.answer,
      explanation: q.explanation,
    };
  });
  const correct = feedback.filter((f) => f.correct).length;
  return {
    score: Math.round((correct / questions.length) * 100),
    correct,
    total: questions.length,
    feedback,
  };
}
