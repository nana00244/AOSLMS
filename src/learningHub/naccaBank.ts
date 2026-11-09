import { indicatorLessonId } from './indicatorLessonId';
import bankData from '../nacca/importedBank.json';
import basic1EnglishData from '../nacca/basic1EnglishBank.json';
import type { NaccaQuestion, NaccaIndicator, NaccaSubject, NaccaLevel } from '../nacca/types';
import type { HubLesson, HubQuestion } from './catalog';
import { sortIndicators, sortQuestions } from '../nacca/sortOrder';

const rawIndicators = [
  ...(bankData.indicators || []),
  ...(basic1EnglishData.indicators || []),
] as unknown as NaccaIndicator[];
export const naccaIndicators: NaccaIndicator[] = sortIndicators(rawIndicators);

const rawQuestions = [
  ...(bankData.questions || []),
  ...(basic1EnglishData.questions || []),
] as unknown as NaccaQuestion[];
export const naccaQuestions: NaccaQuestion[] = sortQuestions(rawQuestions, naccaIndicators);

export const naccaSubjects: NaccaSubject[] = [
  ...((bankData.subjects || []) as unknown as NaccaSubject[]),
  ...((basic1EnglishData.subjects || []) as unknown as NaccaSubject[]),
];
export const naccaLevels: NaccaLevel[] = [
  ...((bankData.levels || []) as unknown as NaccaLevel[]),
  ...((basic1EnglishData.levels || []) as unknown as NaccaLevel[]),
];
export const naccaImportedAt = bankData.importedAt || new Date().toISOString();

/**
 * Maps NaCCA questions for an indicator into HubQuestion items for standard lesson player compatibility.
 */
function toHubQuestions(questions: NaccaQuestion[]): HubQuestion[] {
  return questions.map((q, idx) => {
    let options: string[] = [];
    let answer = 0;

    if (q.type === 'mcq' && Array.isArray(q.options) && q.options.length >= 2) {
      options = q.options;
      answer = typeof q.answer === 'number' ? q.answer : 0;
    } else if (q.type === 'numeric') {
      const num = Number(q.answer) || 0;
      options = [String(num), String(num + 1), String(Math.max(0, num - 1)), String(num + 2)];
      answer = 0;
    } else if (q.type === 'short_answer') {
      const primary = Array.isArray(q.answer) ? String(q.answer[0]) : String(q.answer || '');
      options = [primary, 'Alternative answer', 'Different value', 'None of these'];
      answer = 0;
    } else {
      // Teacher-assessed types (written, oral, drawing, practical)
      options = [
        'Demonstrates mastery according to rubric criteria',
        'Partially completes the task',
        'Needs teacher assistance or re-explanation',
        'Not yet completed',
      ];
      answer = 0;
    }

    return {
      id: q.id || `q_${idx + 1}`,
      prompt: q.stem,
      options,
      answer,
      explanation:
        q.explanation || `Skill: ${q.skill_tag || 'Standard'}. Difficulty Level ${q.difficulty}/4.`,
    };
  });
}

/**
 * Builds HubLessons for all NaCCA indicators so they appear natively in Learning Hub Courses.
 */
export const naccaHubLessons: HubLesson[] = naccaIndicators.map((ind) => {
  const questions = naccaQuestions.filter(
    (q) => q.indicator_code === ind.code && q.subject === ind.subject,
  );
  const sourceUrl =
    ind.subject === 'Mathematics'
      ? 'https://mingycomputersgh.wordpress.com/wp-content/uploads/2023/10/mathematics-1.pdf'
      : '';

  const skillDescriptions = ind.spec?.skills?.map((s) => `• ${s.description}`).join('\n') || '';
  const misconceptions = ind.spec?.misconceptions?.map((m) => `• ${m}`).join('\n') || '';

  const body = [
    `Curriculum Indicator ${ind.code}: ${ind.strand} — ${ind.sub_strand}.`,
    `Content Standard: ${ind.content_standard || 'National Curriculum Standard'}.`,
    `Learning Objective: ${ind.objective || 'Demonstrate understanding and problem solving.'}`,
  ];

  if (skillDescriptions) {
    body.push(`Core Target Skills:\n${skillDescriptions}`);
  }
  if (misconceptions) {
    body.push(`Common Learning Pitfalls to Avoid:\n${misconceptions}`);
  }

  body.push(
    `This topic contains ${questions.length} officially reviewed NaCCA practice questions ranging from Difficulty 1 (Foundational) to Difficulty 4 (Advanced Reasoning).`,
  );

  return {
    id: indicatorLessonId(ind.subject, ind.code),
    title: `${ind.code} · ${ind.sub_strand || ind.strand}`,
    subject: ind.subject,
    level: ind.level,
    strand: ind.strand,
    standard: ind.content_standard || ind.code,
    description: ind.objective || `Practice questions and skills for ${ind.code}.`,
    body,
    sourceUrl,
    sourceTitle:
      ind.subject === 'Mathematics'
        ? `NaCCA Ghana ${ind.subject} Curriculum (${ind.level}) · Source Page ${ind.source_page || '30'}`
        : `NaCCA Ghana ${ind.subject} Curriculum (${ind.level}) · Source Page ${ind.source_page || 'not specified'}`,
    questions: toHubQuestions(questions),
  };
});
