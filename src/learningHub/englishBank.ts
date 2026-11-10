import bankData from './englishB2Bank.json';
import basicThreeBankData from './englishB3Bank.json';
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
}

const sourceUrl =
  'https://nacca.gov.gh/learning-areas-subjects/new-standards-based-curriculum-2019/';
const banks = bankData as EnglishIndicatorBank[];

function scoredQuestions(bank: EnglishIndicatorBank): HubQuestion[] {
  return bank.questions.flatMap((question, index) => {
    if (
      question.type !== 'mcq' ||
      !Array.isArray(question.options) ||
      question.options.length < 2 ||
      typeof question.answer !== 'number' ||
      !Number.isInteger(question.answer) ||
      question.answer < 0 ||
      question.answer >= question.options.length
    ) {
      return [];
    }
    return [
      {
        id: `${bank.indicator.code.toLowerCase()}-q${index + 1}`,
        prompt: question.stem,
        options: question.options,
        answer: question.answer,
        explanation: question.explanation || 'Review the objective and try again.',
      },
    ];
  });
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
