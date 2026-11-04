export type QuestionType =
  'mcq' | 'numeric' | 'short_answer' | 'written' | 'oral' | 'drawing' | 'practical' | 'role_play';

export interface RubricCriterion {
  description: string;
  marks: number;
}

export interface Rubric {
  criteria: RubricCriterion[];
}

export interface NaccaSubject {
  id: string;
  name: string;
}

export interface NaccaLevel {
  id: string;
  name: string;
  sequence: number;
}

export interface NaccaIndicator {
  code: string;
  subject: string;
  level: string;
  strand: string;
  sub_strand: string;
  content_standard?: string;
  objective?: string;
  source_page?: number;
  spec?: {
    skills?: { tag: string; description: string; minQuestions?: number }[];
    difficultyPlan?: string;
    misconceptions?: string[];
    needsTeacherAssessment?: boolean;
  };
}

export interface NaccaQuestion {
  id: string;
  indicator_code: string;
  subject: string;
  level: string;
  strand?: string;
  sub_strand?: string;
  objective?: string;
  skill_tag?: string;
  type: QuestionType;
  difficulty: number; // 1 to 4
  stem: string;
  options?: string[]; // for mcq
  answer?: number | string | (number | string)[]; // mcq: index 0-3, numeric: number, short_answer: array of strings
  hints: string[];
  explanation?: string;
  rubric?: Rubric;
  reviewer?: string;
  misconception?: string;
  uncertain?: string[];
  check_formula?: string;
}

// Student-safe version that never includes the answer before submission (Rule 2)
export type StudentNaccaQuestion = Omit<NaccaQuestion, 'answer' | 'explanation'> & {
  // Explanation is shown ONLY after answering
  explanation?: string;
};

export interface SkippedItem {
  id: string;
  indicator_code?: string;
  reason: string;
  raw?: unknown;
}

export interface IndicatorReport {
  code: string;
  subject: string;
  level: string;
  strand: string;
  sub_strand: string;
  objective?: string;
  questionCount: number;
  types: Record<string, number>;
  difficulties: Record<number, number>;
}

export interface ImportReport {
  totalImported: number;
  totalSkipped: number;
  subjectsCount: number;
  levelsCount: number;
  indicatorsCount: number;
  countsBySubject: Record<string, number>;
  countsByLevel: Record<string, number>;
  countsBySubjectAndLevel: Record<string, Record<string, number>>;
  questionsPerIndicator: Record<string, number>;
  indicators: IndicatorReport[];
  skippedItems: SkippedItem[];
}
