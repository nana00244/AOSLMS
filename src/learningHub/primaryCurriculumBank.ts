import rmeB1P1 from './rmeSource/BS1 PART 1.json' with { type: 'json' };
import rmeB1P2 from './rmeSource/BS1 PART 2.json' with { type: 'json' };
import rmeB1P3 from './rmeSource/BS1 PART 3.json' with { type: 'json' };
import rmeB1P4 from './rmeSource/BS1 PART 4.json' with { type: 'json' };
import rmeB2P1 from './rmeSource/BS2 PART 1.json' with { type: 'json' };
import rmeB2P2 from './rmeSource/BS2 PART 2.json' with { type: 'json' };
import rmeB2P3 from './rmeSource/BS2 PART 3.json' with { type: 'json' };
import rmeB2P4 from './rmeSource/BASIC 2 PART 4.json' with { type: 'json' };
import rmeB2P5 from './rmeSource/BASIC2 PART 5.json' with { type: 'json' };
import rmeB3P1 from './rmeSource/BASIC3 PART1.json' with { type: 'json' };
import rmeB3P2 from './rmeSource/BASIC3 PART2.json' with { type: 'json' };
import rmeB3P3 from './rmeSource/BASIC3 PART3.json' with { type: 'json' };
import rmeB3P4 from './rmeSource/BASIC3 PART4.json' with { type: 'json' };
import rmeB3P5 from './rmeSource/BASIC3 PART5.json' with { type: 'json' };
import rmeB4 from './rmeSource/BASIC4.json' with { type: 'json' };
import rmeB5 from './rmeSource/BASIC5.json' with { type: 'json' };
import rmeB6 from './rmeSource/BASIC6.json' with { type: 'json' };
import artsB1 from './creativeArtsSource/BS1 CARTS.json' with { type: 'json' };
import artsB2 from './creativeArtsSource/BS2 CARTS.json' with { type: 'json' };
import artsB3 from './creativeArtsSource/BS3 CARTS.json' with { type: 'json' };
import artsB4 from './creativeArtsSource/BS4 CARTS.json' with { type: 'json' };
import artsB5 from './creativeArtsSource/BS5 CARTS.json' with { type: 'json' };
import artsB6 from './creativeArtsSource/BS6 CARTS.json' with { type: 'json' };
import { indicatorLessonId } from './indicatorLessonId.ts';
import type { NaccaIndicator, NaccaQuestion } from '../nacca/types.ts';

type SourceFile = { class?: string; level?: string; indicators?: Record<string, any>[] };
type SourceGroup = { subject: string; data: SourceFile; file: string };

const rmeFiles: SourceGroup[] = [
  { subject: 'Religious and Moral Education', data: rmeB1P1, file: 'BS1 PART 1.json' },
  { subject: 'Religious and Moral Education', data: rmeB1P2, file: 'BS1 PART 2.json' },
  { subject: 'Religious and Moral Education', data: rmeB1P3, file: 'BS1 PART 3.json' },
  { subject: 'Religious and Moral Education', data: rmeB1P4, file: 'BS1 PART 4.json' },
  { subject: 'Religious and Moral Education', data: rmeB2P1, file: 'BS2 PART 1.json' },
  { subject: 'Religious and Moral Education', data: rmeB2P2, file: 'BS2 PART 2.json' },
  { subject: 'Religious and Moral Education', data: rmeB2P3, file: 'BS2 PART 3.json' },
  { subject: 'Religious and Moral Education', data: rmeB2P4, file: 'BASIC 2 PART 4.json' },
  { subject: 'Religious and Moral Education', data: rmeB2P5, file: 'BASIC2 PART 5.json' },
  { subject: 'Religious and Moral Education', data: rmeB3P1, file: 'BASIC3 PART1.json' },
  { subject: 'Religious and Moral Education', data: rmeB3P2, file: 'BASIC3 PART2.json' },
  { subject: 'Religious and Moral Education', data: rmeB3P3, file: 'BASIC3 PART3.json' },
  { subject: 'Religious and Moral Education', data: rmeB3P4, file: 'BASIC3 PART4.json' },
  { subject: 'Religious and Moral Education', data: rmeB3P5, file: 'BASIC3 PART5.json' },
  { subject: 'Religious and Moral Education', data: rmeB4, file: 'BASIC4.json' },
  { subject: 'Religious and Moral Education', data: rmeB5, file: 'BASIC5.json' },
  { subject: 'Religious and Moral Education', data: rmeB6, file: 'BASIC6.json' },
];

const artsFiles: SourceGroup[] = [
  { subject: 'Creative Arts', data: artsB1, file: 'BS1 CARTS.json' },
  { subject: 'Creative Arts', data: artsB2, file: 'BS2 CARTS.json' },
  { subject: 'Creative Arts', data: artsB3, file: 'BS3 CARTS.json' },
  { subject: 'Creative Arts', data: artsB4, file: 'BS4 CARTS.json' },
  { subject: 'Creative Arts', data: artsB5, file: 'BS5 CARTS.json' },
  { subject: 'Creative Arts', data: artsB6, file: 'BS6 CARTS.json' },
];

const levelNumber = (level: string) => Number(level.match(/\d+/)?.[0] || 1);

function cleanCode(value: unknown, level: string) {
  const text = String(value || '').trim();
  const levelPrefix = 'B' + levelNumber(level);
  if (/^BI(?:\.|\s)/i.test(text)) {
    const suffix = text.replace(/^BI[.\s]*/i, '').replace(/\s*\.\s*/g, '.');
    const pieces = suffix.split('.').filter(Boolean);
    if (Number(pieces[0]) === levelNumber(level)) pieces.shift();
    return [levelPrefix, ...pieces].join('.');
  }
  return text.replace(/\s*\.\s*/g, '.').replace(/\s+/g, '');
}

const rmeStrands: Record<number, string> = {
  1: 'God, His Creation and Attributes',
  2: 'Religious Practices and their Moral Implications',
  3: 'Family and Community',
  4: 'Personal Safety',
  5: 'The Environment',
};

function strandFor(subject: string, code: string, original = '') {
  if (original) return original;
  if (/\.VA\./i.test(code)) return 'Visual Arts';
  if (/\.PA\./i.test(code)) return 'Performing Arts';
  const parts = code.match(/^B[1-6]\.(\d+)/i);
  const strand = parts ? Number(parts[1]) : 0;
  if (subject === 'Religious and Moral Education') return rmeStrands[strand] || subject;
  if (strand === 1) return 'Visual Arts';
  if (strand === 2) return 'Performing Arts';
  return subject;
}

function normalizedSpec(input: any) {
  if (!input || typeof input !== 'object') return undefined;
  const skills = Array.isArray(input.skills)
    ? input.skills.map((skill: any, index: number) =>
        typeof skill === 'string'
          ? { tag: 'skill-' + (index + 1), description: skill }
          : {
              tag: String(skill.tag || skill.name || 'skill-' + (index + 1)),
              description: String(skill.description || skill.name || skill.tag || ''),
              ...(Number.isFinite(skill.minQuestions) && { minQuestions: skill.minQuestions }),
            },
      )
    : undefined;
  return {
    ...(skills?.length && { skills }),
    ...(typeof input.difficultyPlan === 'string' && { difficultyPlan: input.difficultyPlan }),
    ...(typeof input.difficulty_plan === 'string' && { difficultyPlan: input.difficulty_plan }),
    ...(Array.isArray(input.misconceptions) && { misconceptions: input.misconceptions }),
    ...(input.needsTeacherAssessment === true && { needsTeacherAssessment: true }),
    ...(input.teacher_assessment_required === true && { needsTeacherAssessment: true }),
  };
}

function difficulty(value: unknown, index: number) {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.max(1, Math.min(4, value));
  const text = String(value || '').toLowerCase();
  if (/challenge|advanced/.test(text)) return 4;
  if (/medium|developing/.test(text)) return 2;
  if (/easy|basic|foundational/.test(text)) return 1;
  return Math.min(4, 1 + Math.floor(index / 5));
}

function acceptedAnswers(value: unknown): string[] | undefined {
  if (Array.isArray(value))
    return value
      .map(String)
      .map((answer) => answer.trim())
      .filter(Boolean);
  if (typeof value === 'number') return [String(value)];
  if (typeof value !== 'string' || !value.trim()) return undefined;
  const cleaned = value
    .replace(/^any\s+(?:one|of)\s*:?\s*/i, '')
    .replace(/\s*\((?:any one|any two|any three|any acceptable answer)\)\s*$/i, '')
    .trim();
  if (/,\s*|\s+or\s+/i.test(cleaned) && cleaned.length < 220)
    return cleaned
      .split(/,\s*|\s+or\s+/i)
      .map((answer) => answer.trim().replace(/^["'“”]+|["'“”]+$/g, ''))
      .filter(Boolean);
  return [cleaned];
}

function taskType(value: unknown): NaccaQuestion['type'] {
  const type = String(value || '')
    .toLowerCase()
    .replace(/[ -]/g, '_');
  if (type === 'mcq' || type === 'multiple_choice') return 'mcq';
  if (type === 'numeric' || type === 'short_answer') return type;
  if (type === 'oral') return 'oral';
  if (type === 'drawing' || type === 'draw') return 'drawing';
  if (type === 'role_play' || type === 'roleplay') return 'role_play';
  if (type === 'practical' || type === 'performance' || type === 'modelling') return 'practical';
  if (type === 'written' || type === 'writing' || type === 'short') return 'written';
  return 'written';
}

function normalizedRubric(value: any) {
  if (!value || typeof value !== 'object') return undefined;
  if (Array.isArray(value.criteria)) return { criteria: value.criteria };
  const criteria = Object.entries(value)
    .filter(([, marks]) => Number.isFinite(Number(marks)))
    .map(([description, marks]) => ({
      description: description.replace(/_/g, ' '),
      marks: Number(marks),
    }));
  return criteria.length ? { criteria } : undefined;
}

function convertQuestion(
  raw: any,
  indicator: NaccaIndicator,
  index: number,
): NaccaQuestion | undefined {
  const tuple = Array.isArray(raw) ? raw : undefined;
  const prompt = String(
    (typeof raw === 'string' ? raw : undefined) ||
      raw?.stem ||
      raw?.prompt ||
      raw?.question ||
      tuple?.[1] ||
      '',
  ).trim();
  if (!prompt) return undefined;
  const rawType = tuple?.[0] || raw?.type || 'written';
  const expected = tuple?.[2] ?? raw?.answer;
  const options = Array.isArray(raw?.options) ? raw.options.map(String) : undefined;
  let type = taskType(rawType);
  let answer: NaccaQuestion['answer'];
  let finalOptions: string[] | undefined;
  if (type === 'mcq' && options && options.length >= 2) {
    const answerIndex =
      typeof expected === 'number'
        ? expected
        : options.findIndex(
            (option: string) =>
              option.trim().toLowerCase() === String(expected).trim().toLowerCase(),
          );
    if (answerIndex >= 0 && answerIndex < options.length) {
      finalOptions = options;
      answer = answerIndex;
    } else type = 'short_answer';
  } else if (type === 'mcq') type = 'short_answer';
  if (type === 'short_answer') answer = acceptedAnswers(expected);
  if (type === 'numeric') {
    const numeric = Number(expected);
    if (Number.isFinite(numeric)) answer = numeric;
    else type = 'written';
  }
  if (type === 'short_answer' && !answer) type = 'written';

  const givenHints = raw?.hints ?? raw?.hint;
  const hints = Array.isArray(givenHints)
    ? givenHints.map(String)
    : typeof givenHints === 'string'
      ? [givenHints]
      : [];
  const expectedText = Array.isArray(expected) ? expected.join('; ') : String(expected ?? '');
  const explanation = String(
    raw?.explanation ||
      (type === 'written' ||
      type === 'oral' ||
      type === 'drawing' ||
      type === 'practical' ||
      type === 'role_play'
        ? expectedText
        : '') ||
      '',
  );
  const rubric = normalizedRubric(raw?.rubric);
  return {
    id: indicatorLessonId(indicator.subject, indicator.code) + '-q' + (index + 1),
    indicator_code: indicator.code,
    subject: indicator.subject,
    level: indicator.level,
    strand: indicator.strand,
    sub_strand: indicator.sub_strand,
    objective: indicator.objective,
    skill_tag: String(raw?.skill_tag || raw?.skill || taskType(rawType)),
    type,
    difficulty: difficulty(raw?.difficulty, index),
    stem: prompt,
    ...(finalOptions && { options: finalOptions }),
    ...(answer !== undefined && { answer }),
    hints,
    ...(explanation && { explanation }),
    ...(rubric && { rubric }),
    ...(typeof raw?.misconception === 'string' && { misconception: raw.misconception }),
    ...(Array.isArray(raw?.uncertain) && { uncertain: raw.uncertain }),
  };
}

function expand(
  groups: SourceGroup[],
  subject: string,
): { indicators: NaccaIndicator[]; questions: NaccaQuestion[] } {
  const indicators: NaccaIndicator[] = [];
  const questions: NaccaQuestion[] = [];
  for (const group of groups) {
    for (const row of group.data.indicators || []) {
      const rawIndicator = row.indicator || row;
      const level = String(rawIndicator.level || group.data.level || group.data.class || 'Basic 1');
      const code = cleanCode(rawIndicator.code || row.code, level);
      const objective = String(
        rawIndicator.objective || row.statement || row.indicator || row.objective || '',
      ).trim();
      const actualSubject = String(rawIndicator.subject || group.subject || subject);
      const indicator: NaccaIndicator = {
        code,
        subject: actualSubject,
        level,
        strand: strandFor(actualSubject, code, String(rawIndicator.strand || row.strand || '')),
        sub_strand: String(rawIndicator.sub_strand || row.sub_strand || objective || code),
        ...(rawIndicator.content_standard && {
          content_standard: String(rawIndicator.content_standard),
        }),
        ...(row.content_standard && { content_standard: String(row.content_standard) }),
        ...(rawIndicator.content_standard_as_printed && {
          content_standard: String(rawIndicator.content_standard_as_printed),
        }),
        ...(objective && { objective }),
        ...(Number.isFinite(Number(rawIndicator.source_page ?? row.source_page)) && {
          source_page: Number(rawIndicator.source_page ?? row.source_page),
        }),
        ...(Array.isArray(row.uncertain) && { sourceNotes: row.uncertain.map(String) }),
        ...(normalizedSpec(row.spec || row.specification || rawIndicator.spec) && {
          spec: normalizedSpec(row.spec || row.specification || rawIndicator.spec),
        }),
      };
      indicators.push(indicator);
      for (const [index, question] of (Array.isArray(row.questions)
        ? row.questions
        : []
      ).entries()) {
        const converted = convertQuestion(question, indicator, index);
        if (converted) questions.push(converted);
      }
    }
  }
  return { indicators, questions };
}

const rme = expand(rmeFiles, 'Religious and Moral Education');
const arts = expand(artsFiles, 'Creative Arts');
export const primaryCurriculumIndicators = [...rme.indicators, ...arts.indicators];
export const primaryCurriculumQuestions = [...rme.questions, ...arts.questions];
export const primaryCurriculumSubjects = [
  { id: 'religious-and-moral-education', name: 'Religious and Moral Education' },
  { id: 'creative-arts', name: 'Creative Arts' },
];
