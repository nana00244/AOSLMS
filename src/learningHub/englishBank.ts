import bankData from './englishB2Bank.json';
import basicThreeBankData from './englishB3Bank.json';
import basicFourBankData from './englishB4Bank.json';
import basicFiveBankData from './englishB5Bank.json';
import basicSixBankData from './englishB6Bank.json';
import type { HubLesson, HubQuestion } from './catalog';
import { indicatorLessonId } from './indicatorLessonId';

interface EnglishBankQuestion {
  skill_tag: string;
  type: string;
  difficulty: number;
  stem: string;
  options?: string[];
  answer?: number | string | string[];
  explanation?: string;
}

interface EnglishIndicatorBank {
  indicator: {
    code: string;
    subject: string;
    level: string;
    strand: string;
    sub_strand: string;
    content_standard: string;
    objective: string;
    source_page: number;
  };
  spec: {
    skills: { tag: string; description: string; minQuestions: number }[];
    difficultyPlan: string;
    misconceptions: string[];
    needsTeacherAssessment: boolean;
  };
  questions: EnglishBankQuestion[];
  questionCount?: number;
  teacherAssessedCount?: number;
  excludedMcqCount?: number;
  duplicateSourceCount?: number;
}

const sourceUrl =
  'https://nacca.gov.gh/learning-areas-subjects/new-standards-based-curriculum-2019/';
const banks = bankData as EnglishIndicatorBank[];

function scoredQuestions(
  bank: EnglishIndicatorBank,
  requireDistinctOptions = false,
): HubQuestion[] {
  return bank.questions.flatMap((question, index) => {
    if (!isValidScoredQuestion(question, requireDistinctOptions)) {
      return [];
    }
    return [
      {
        id: `${bank.indicator.code.toLowerCase()}-q${index + 1}`,
        prompt: question.stem,
        options: question.options!,
        answer: question.answer as number,
        explanation: question.explanation || 'Review the objective and try again.',
      },
    ];
  });
}

function isValidScoredQuestion(
  question: EnglishBankQuestion,
  requireDistinctOptions = false,
): boolean {
  return (
    question.type === 'mcq' &&
    Array.isArray(question.options) &&
    question.options.length >= 2 &&
    (!requireDistinctOptions ||
      new Set(question.options.map((option) => option.trim().toLowerCase())).size ===
        question.options.length) &&
    typeof question.answer === 'number' &&
    Number.isInteger(question.answer) &&
    question.answer >= 0 &&
    question.answer < question.options.length
  );
}

export const basicTwoEnglishLessons: HubLesson[] = banks.map((bank) => {
  const { indicator, spec } = bank;
  const questions = scoredQuestions(bank);
  const teacherAssessed = bank.questions.filter((question) => question.type !== 'mcq');
  const skillDescriptions = spec.skills.map((skill) => `• ${skill.description}`);
  const misconceptions = spec.misconceptions.map((item) => `• ${item}`);

  return {
    id: indicatorLessonId(indicator.subject, indicator.code),
    title: `${indicator.code} · ${indicator.sub_strand}`,
    subject: 'English Language',
    level: 'B2',
    strand: indicator.strand,
    standard: indicator.code,
    description: indicator.objective,
    body: [
      `Curriculum indicator ${indicator.code}: ${indicator.strand} — ${indicator.sub_strand}.`,
      `Content standard: ${indicator.content_standard}.`,
      `Learning objective: ${indicator.objective}.`,
      `Skills to practise:\n${skillDescriptions.join('\n')}`,
      `Common learning pitfalls:\n${misconceptions.join('\n')}`,
      `Question bank: ${bank.questionCount ?? bank.questions.length} authored items (${questions.length} automatically scored multiple-choice and ${bank.teacherAssessedCount ?? teacherAssessed.length} teacher-assessed written, oral, or performance activities). Difficulty plan: ${spec.difficultyPlan}. ${spec.needsTeacherAssessment ? 'Some activities require teacher assessment.' : ''}`,
    ],
    sourceUrl,
    sourceTitle: `NaCCA English Language B1–B3 curriculum · ${indicator.code} · PDF page ${indicator.source_page}`,
    questions,
  };
});

export const basicThreeEnglishLessons: HubLesson[] = (
  basicThreeBankData as EnglishIndicatorBank[]
).map((bank) => {
  const { indicator, spec } = bank;
  const questions = scoredQuestions(bank);
  return {
    id: indicatorLessonId(indicator.subject, indicator.code),
    title: `${indicator.code} · ${indicator.sub_strand}`,
    subject: 'English Language',
    level: 'B3',
    strand: indicator.strand,
    standard: indicator.code,
    description: indicator.objective,
    body: [
      `Curriculum indicator ${indicator.code}: ${indicator.strand} — ${indicator.sub_strand}.`,
      `Content standard: ${indicator.content_standard}.`,
      `Learning objective: ${indicator.objective}.`,
      `Skills to practise:\n${spec.skills.map((skill) => `• ${skill.description}`).join('\n')}`,
      `Common learning pitfalls:\n${spec.misconceptions.map((item) => `• ${item}`).join('\n')}`,
      `Question bank: ${bank.questionCount ?? bank.questions.length} authored items (${questions.length} automatically scored multiple-choice and ${bank.teacherAssessedCount ?? 0} teacher-assessed written, oral, or performance activities). Difficulty plan: ${spec.difficultyPlan}. ${spec.needsTeacherAssessment ? 'Some activities require teacher assessment.' : ''}`,
      ...(bank.excludedMcqCount
        ? [
            `${bank.excludedMcqCount} source multiple-choice items were omitted because their choices or answer key were inconsistent.`,
          ]
        : []),
    ],
    sourceUrl,
    sourceTitle: `NaCCA English Language B1–B3 curriculum · ${indicator.code} · PDF page ${indicator.source_page}`,
    questions,
  };
});

export const basicFourEnglishLessons: HubLesson[] = (
  basicFourBankData as EnglishIndicatorBank[]
).map((bank) => {
  const { indicator, spec } = bank;
  const questions = scoredQuestions(bank);
  const teacherAssessed = bank.questions.filter((question) => question.type !== 'mcq');
  return {
    id: indicatorLessonId(indicator.subject, indicator.code),
    title: `${indicator.code} · ${indicator.sub_strand}`,
    subject: 'English Language',
    level: 'B4',
    strand: indicator.strand,
    standard: indicator.code,
    description: indicator.objective,
    body: [
      `Curriculum indicator ${indicator.code}: ${indicator.strand} — ${indicator.sub_strand}.`,
      `Content standard: ${indicator.content_standard}.`,
      `Learning objective: ${indicator.objective}.`,
      `Skills to practise:\n${spec.skills.map((skill) => `• ${skill.description}`).join('\n')}`,
      `Common learning pitfalls:\n${spec.misconceptions.map((item) => `• ${item}`).join('\n')}`,
      `Question bank: ${bank.questionCount ?? bank.questions.length} authored items (${questions.length} automatically scored multiple-choice and ${bank.teacherAssessedCount ?? teacherAssessed.length} teacher-assessed written, oral, or performance activities). Difficulty plan: ${spec.difficultyPlan}. ${spec.needsTeacherAssessment ? 'Some activities require teacher assessment.' : ''}`,
      ...(bank.excludedMcqCount
        ? [
            `${bank.excludedMcqCount} ambiguous or inconsistent multiple-choice items were excluded from automatic scoring.`,
          ]
        : []),
      ...(bank.duplicateSourceCount
        ? [`${bank.duplicateSourceCount} supplied file duplicated this indicator and was merged.`]
        : []),
    ],
    sourceUrl,
    sourceTitle: `NaCCA English Language B1–B6 curriculum · ${indicator.code} · PDF page ${indicator.source_page}`,
    questions,
  };
});

export const basicFiveEnglishLessons: HubLesson[] = (
  basicFiveBankData as EnglishIndicatorBank[]
).map((bank) => {
  const { indicator, spec } = bank;
  const questions = scoredQuestions(bank, true);
  const teacherAssessed = bank.questions.filter((question) => question.type !== 'mcq');
  const excludedMcqCount = bank.questions.filter(
    (question) => question.type === 'mcq' && !isValidScoredQuestion(question, true),
  ).length;
  return {
    id: indicatorLessonId(indicator.subject, indicator.code),
    title: `${indicator.code} · ${indicator.sub_strand}`,
    subject: 'English Language',
    level: 'B5',
    strand: indicator.strand,
    standard: indicator.code,
    description: indicator.objective,
    body: [
      `Curriculum indicator ${indicator.code}: ${indicator.strand} — ${indicator.sub_strand}.`,
      `Content standard: ${indicator.content_standard}.`,
      `Learning objective: ${indicator.objective}.`,
      `Skills to practise:\n${spec.skills.map((skill) => `• ${skill.description}`).join('\n')}`,
      `Common learning pitfalls:\n${spec.misconceptions.map((item) => `• ${item}`).join('\n')}`,
      `Question bank: ${bank.questionCount ?? bank.questions.length} authored items (${questions.length} automatically scored multiple-choice and ${bank.teacherAssessedCount ?? teacherAssessed.length} teacher-assessed written, oral, or performance activities). Difficulty plan: ${spec.difficultyPlan}. ${spec.needsTeacherAssessment ? 'Some activities require teacher assessment.' : ''}`,
      ...(bank.excludedMcqCount
        ? [
            `${bank.excludedMcqCount} ambiguous or inconsistent multiple-choice items were excluded from automatic scoring.`,
          ]
        : []),
      ...(bank.duplicateSourceCount
        ? [`${bank.duplicateSourceCount} supplied file duplicated this indicator and was merged.`]
        : []),
      ...(excludedMcqCount
        ? [
            `${excludedMcqCount} ambiguous or invalid multiple-choice items were omitted from student practice.`,
          ]
        : []),
    ],
    sourceUrl,
    sourceTitle: `NaCCA English Language B1–B6 curriculum · ${indicator.code} · PDF page ${indicator.source_page}`,
    questions,
  };
});

export const basicSixEnglishLessons: HubLesson[] = (basicSixBankData as EnglishIndicatorBank[]).map(
  (bank) => {
    const { indicator, spec } = bank;
    const questions = scoredQuestions(bank, true);
    const teacherAssessed = bank.questions.filter((question) => question.type !== 'mcq');
    const excludedMcqCount = bank.questions.filter(
      (question) => question.type === 'mcq' && !isValidScoredQuestion(question, true),
    ).length;
    return {
      id: indicatorLessonId(indicator.subject, indicator.code),
      title: `${indicator.code} · ${indicator.sub_strand}`,
      subject: 'English Language',
      level: 'B6',
      strand: indicator.strand,
      standard: indicator.code,
      description: indicator.objective,
      body: [
        `Curriculum indicator ${indicator.code}: ${indicator.strand} — ${indicator.sub_strand}.`,
        `Content standard: ${indicator.content_standard}.`,
        `Learning objective: ${indicator.objective}.`,
        `Skills to practise:\n${spec.skills.map((skill) => `• ${skill.description}`).join('\n')}`,
        `Common learning pitfalls:\n${spec.misconceptions.map((item) => `• ${item}`).join('\n')}`,
        `Question bank: ${bank.questionCount ?? bank.questions.length} authored items (${questions.length} automatically scored multiple-choice and ${bank.teacherAssessedCount ?? teacherAssessed.length} teacher-assessed written, oral, or performance activities). Difficulty plan: ${spec.difficultyPlan}. ${spec.needsTeacherAssessment ? 'Some activities require teacher assessment.' : ''}`,
        ...(bank.excludedMcqCount
          ? [
              `${bank.excludedMcqCount} ambiguous or inconsistent multiple-choice items were excluded from automatic scoring.`,
            ]
          : []),
        ...(bank.duplicateSourceCount
          ? [`${bank.duplicateSourceCount} supplied file duplicated this indicator and was merged.`]
          : []),
        ...(excludedMcqCount
          ? [
              `${excludedMcqCount} ambiguous or invalid multiple-choice items were omitted from student practice.`,
            ]
          : []),
      ],
      sourceUrl,
      sourceTitle: `NaCCA English Language B1–B6 curriculum · ${indicator.code} · PDF page ${indicator.source_page}`,
      questions,
    };
  },
);
