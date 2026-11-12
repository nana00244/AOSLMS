import { indicatorLessonId } from './indicatorLessonId';
import bankData from '../nacca/importedBank.json';
import basic1EnglishData from '../nacca/basic1EnglishBank.json';
import basic2EnglishData from './englishB2Bank.json';
import basic3EnglishData from './englishB3Bank.json';
import basic4EnglishData from './englishB4Bank.json';
import basic5EnglishData from './englishB5Bank.json';
import { hubLessons } from './catalog';
import type { NaccaQuestion, NaccaIndicator, NaccaSubject, NaccaLevel } from '../nacca/types';
import type { HubLesson, HubQuestion } from './catalog';
import { sortIndicators, sortQuestions } from '../nacca/sortOrder';

const jhsLessons = hubLessons.filter((lesson) => /^B[789]$/.test(lesson.level));

const rawIndicators = [
  ...(bankData.indicators || []),
  ...(basic1EnglishData.indicators || []),
  ...basic2EnglishData.map(({ indicator, spec }) => ({
    code: indicator.code,
    subject: indicator.subject,
    level: 'Basic 2',
    strand: indicator.strand,
    sub_strand: indicator.sub_strand,
    content_standard: indicator.content_standard,
    objective: indicator.objective,
    source_page: indicator.source_page,
    spec,
  })),
  ...basic3EnglishData.map(({ indicator, spec }) => ({
    code: indicator.code,
    subject: indicator.subject,
    level: 'Basic 3',
    strand: indicator.strand,
    sub_strand: indicator.sub_strand,
    content_standard: indicator.content_standard,
    objective: indicator.objective,
    source_page: indicator.source_page,
    spec,
  })),
  ...basic4EnglishData.map(({ indicator, spec }) => ({
    code: indicator.code,
    subject: indicator.subject,
    level: 'Basic 4',
    strand: indicator.strand,
    sub_strand: indicator.sub_strand,
    content_standard: indicator.content_standard,
    objective: indicator.objective,
    source_page: indicator.source_page,
    spec,
  })),
  ...basic5EnglishData.map(({ indicator, spec }) => ({
    code: indicator.code,
    subject: indicator.subject,
    level: 'Basic 5',
    strand: indicator.strand,
    sub_strand: indicator.sub_strand,
    content_standard: indicator.content_standard,
    objective: indicator.objective,
    source_page: indicator.source_page,
    spec,
  })),
  ...jhsLessons.map((lesson) => ({
    code: lesson.standard,
    subject: lesson.subject,
    level: lesson.level,
    strand: lesson.strand,
    sub_strand: lesson.title,
    content_standard: lesson.standard,
    objective: lesson.description,
  })),
] as unknown as NaccaIndicator[];
export const naccaIndicators: NaccaIndicator[] = sortIndicators(rawIndicators);

const rawQuestions = [
  ...(bankData.questions || []),
  ...(basic1EnglishData.questions || []),
  ...basic2EnglishData.flatMap(({ indicator, questions }) =>
    questions.map((question, index) => ({
      id: `${indicator.code.toLowerCase()}-q${index + 1}`,
      indicator_code: indicator.code,
      subject: indicator.subject,
      level: 'Basic 2',
      strand: indicator.strand,
      sub_strand: indicator.sub_strand,
      objective: indicator.objective,
      skill_tag: question.skill_tag,
      type: 'mcq',
      difficulty: question.difficulty,
      stem: question.stem,
      options: question.options,
      answer: question.answer,
      hints: question.hints || [],
      explanation: question.explanation,
      misconception: question.misconception,
      uncertain: question.uncertain || [],
    })),
  ),
  ...basic3EnglishData.flatMap(({ indicator, questions }) =>
    questions.map((question, index) => ({
      id: `${indicator.code.toLowerCase()}-q${index + 1}`,
      indicator_code: indicator.code,
      subject: indicator.subject,
      level: 'Basic 3',
      strand: indicator.strand,
      sub_strand: indicator.sub_strand,
      objective: indicator.objective,
      skill_tag: question.skill_tag,
      type: 'mcq',
      difficulty: question.difficulty,
      stem: question.stem,
      options: question.options,
      answer: question.answer,
      hints: question.hints || [],
      explanation: question.explanation,
      misconception: question.misconception,
      uncertain: question.uncertain || [],
    })),
  ),
  ...basic4EnglishData.flatMap(({ indicator, questions }) =>
    questions.map((question, index) => ({
      id: `${indicator.code.toLowerCase()}-q${index + 1}`,
      indicator_code: indicator.code,
      subject: indicator.subject,
      level: 'Basic 4',
      strand: indicator.strand,
      sub_strand: indicator.sub_strand,
      objective: indicator.objective,
      skill_tag: question.skill_tag,
      type: 'mcq',
      difficulty: question.difficulty,
      stem: question.stem,
      options: question.options,
      answer: question.answer,
      hints: question.hints || [],
      explanation: question.explanation,
      misconception: 'misconceptions' in question ? question.misconceptions.join(' ') : '',
      uncertain: question.uncertain || [],
    })),
  ),
  ...basic5EnglishData.flatMap(({ indicator, questions }) =>
    questions.flatMap((question, index) => {
      if (
        question.type === 'mcq' &&
        Array.isArray(question.options) &&
        new Set(question.options.map((option) => option.trim().toLowerCase())).size !==
          question.options.length
      ) {
        return [];
      }
      return [
        {
          id: `english-b5-${indicator.code.toLowerCase()}-q${index + 1}`,
          indicator_code: indicator.code,
          subject: indicator.subject,
          level: 'Basic 5',
          strand: indicator.strand,
          sub_strand: indicator.sub_strand,
          objective: indicator.objective,
          skill_tag: question.skill_tag,
          type: question.type,
          difficulty: question.difficulty,
          stem: question.stem,
          options: question.options,
          answer: question.answer,
          hints: question.hints || [],
          explanation: question.explanation,
          rubric: 'rubric' in question ? question.rubric : undefined,
          misconception: question.misconception,
          uncertain: question.uncertain || [],
        },
      ];
    }),
  ),
  ...jhsLessons.flatMap((lesson) =>
    lesson.questions.map((question) => ({
      id: `${lesson.id}-${question.id}`,
      indicator_code: lesson.standard,
      subject: lesson.subject,
      level: lesson.level,
      strand: lesson.strand,
      sub_strand: lesson.title,
      objective: lesson.description,
      skill_tag: 'curriculum-practice',
      type: 'mcq',
      difficulty: 1,
      stem: question.prompt,
      options: question.options,
      answer: question.answer,
      hints: [],
      explanation: question.explanation,
      uncertain: [],
    })),
  ),
] as unknown as NaccaQuestion[];
export const naccaQuestions: NaccaQuestion[] = sortQuestions(rawQuestions, naccaIndicators);

export const naccaSubjects: NaccaSubject[] = [
  ...((bankData.subjects || []) as unknown as NaccaSubject[]),
  ...((basic1EnglishData.subjects || []) as unknown as NaccaSubject[]),
  ...(basic2EnglishData.length ? [{ id: 'english-language', name: 'English Language' }] : []),
];
const availableLevels: NaccaLevel[] = [
  ...((bankData.levels || []) as unknown as NaccaLevel[]),
  ...((basic1EnglishData.levels || []) as unknown as NaccaLevel[]),
  ...(basic2EnglishData.length ? [{ id: 'basic-2', name: 'Basic 2', sequence: 2 }] : []),
  ...(basic3EnglishData.length ? [{ id: 'basic-3', name: 'Basic 3', sequence: 3 }] : []),
  ...(basic4EnglishData.length ? [{ id: 'basic-4', name: 'Basic 4', sequence: 4 }] : []),
  ...(basic5EnglishData.length ? [{ id: 'basic-5', name: 'Basic 5', sequence: 5 }] : []),
  ...[...new Set(jhsLessons.map((lesson) => lesson.level))].map((name) => ({
    id: name.toLowerCase(),
    name,
    sequence: Number(name[1]),
  })),
];
export const naccaLevels: NaccaLevel[] = [
  ...new Map(availableLevels.map((level) => [level.name.toLowerCase(), level])).values(),
].sort((a, b) => a.sequence - b.sequence || a.name.localeCompare(b.name));
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
const catalogJhsIndicatorKeys = new Set(
  jhsLessons.map((lesson) => `${lesson.subject}:${lesson.level}:${lesson.standard}`),
);

export const naccaHubLessons: HubLesson[] = naccaIndicators
  .filter(
    (indicator) =>
      !catalogJhsIndicatorKeys.has(`${indicator.subject}:${indicator.level}:${indicator.code}`),
  )
  .map((ind) => {
    const questions = naccaQuestions.filter(
      (q) => q.indicator_code === ind.code && q.subject === ind.subject,
    );
    const sourceUrl =
      ind.subject === 'Mathematics'
        ? 'https://mingycomputersgh.wordpress.com/wp-content/uploads/2023/10/mathematics-1.pdf'
        : 'https://nacca.gov.gh/learning-areas-subjects/new-standards-based-curriculum-2019/';

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
