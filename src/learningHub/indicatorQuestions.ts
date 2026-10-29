import type { HubQuestion } from './catalog';

export type CognitiveDemand = 'recall' | 'understand' | 'apply' | 'reason';
export type QuestionDifficulty = 'foundation' | 'developing' | 'challenge';
export type AssessmentMode = 'multiple-choice' | 'written' | 'oral' | 'performance';

/** An inventory entry is a reviewed curriculum fact, not an authored lesson. */
export interface CurriculumIndicator {
  subject: string;
  grade: number;
  standard: string;
  code: string;
  strand: string;
  subStrand: string;
  objective: string;
  sourceUrl: string;
  sourcePage: number;
  sourceVerified: boolean;
  assessmentModes: AssessmentMode[];
  requiredDemands: CognitiveDemand[];
  requiredDifficulties: QuestionDifficulty[];
}

export interface IndicatorQuestion extends HubQuestion {
  type: 'multiple-choice';
  subject: string;
  grade: number;
  standard: string;
  indicatorCode: string;
  sourceUrl: string;
  sourcePage: number;
  demand: CognitiveDemand;
  difficulty: QuestionDifficulty;
  /** Stable description of the distinct mathematical/content situation, not a random UUID. */
  variationKey: string;
  /** One explanatory misconception message for each incorrect option, keyed by original index. */
  misconceptionFeedback: Record<number, string>;
  authorship: { original: true; author: string; reviewedBy: string };
}

export interface CoverageGap {
  subject: string;
  grade: number;
  indicatorCode: string;
  validQuestions: number;
  requiredQuestions: number;
  missingQuestions: number;
  missingDemands: CognitiveDemand[];
  missingDifficulties: QuestionDifficulty[];
  unsupportedModes: AssessmentMode[];
  sourceVerified: boolean;
  ready: boolean;
}

export interface QuestionAudit {
  /** Only completeness against the supplied inventory; never proof the inventory covers NaCCA. */
  inventoryComplete: boolean;
  ready: boolean;
  issues: { reference: string; message: string }[];
  coverage: CoverageGap[];
  acceptedQuestions: IndicatorQuestion[];
}

const demands: CognitiveDemand[] = ['recall', 'understand', 'apply', 'reason'];
const difficulties: QuestionDifficulty[] = ['foundation', 'developing', 'challenge'];
const modes: AssessmentMode[] = ['multiple-choice', 'written', 'oral', 'performance'];
const normalize = (value: string) =>
  value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
const key = (subject: string, code: string) => `${normalize(subject)}::${code}`;
const https = (value: string) => {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
};

/**
 * Publication gate for explicitly authored items. Does not manufacture questions or certify
 * pedagogical correctness. Human review must confirm the objective, answer, distractors and age fit.
 * Exact content duplicates and duplicate variation identifiers are rejected; semantic paraphrases
 * still require editorial review. Non-MCQ evidence requirements remain visible as coverage gaps.
 */
export function auditIndicatorQuestions(
  inventory: CurriculumIndicator[],
  questions: IndicatorQuestion[],
  options: { inventoryComplete?: boolean; minimumQuestions?: number } = {},
): QuestionAudit {
  const minimum = options.minimumQuestions ?? 16;
  if (!Number.isInteger(minimum) || minimum < 16)
    throw new Error('Each indicator requires at least sixteen distinct reviewed questions.');
  const issues: QuestionAudit['issues'] = [];
  const index = new Map<string, CurriculumIndicator>();
  const invalidIndicators = new Set<string>();
  for (const indicator of inventory) {
    const reference = key(indicator.subject, indicator.code);
    const fail = (message: string) => {
      issues.push({ reference, message });
      invalidIndicators.add(reference);
    };
    if (index.has(reference)) fail('Duplicate inventory indicator.');
    index.set(reference, indicator);
    if (
      !Number.isInteger(indicator.grade) ||
      indicator.grade < 1 ||
      indicator.grade > 9 ||
      !new RegExp(`^B${indicator.grade}(?:\\.[1-9]\\d*){4}$`).test(indicator.code) ||
      indicator.standard !== indicator.code.split('.').slice(0, -1).join('.')
    )
      fail('Grade, standard and full content-indicator code must agree.');
    if (
      ![indicator.subject, indicator.strand, indicator.subStrand, indicator.objective].every((v) =>
        v.trim(),
      )
    )
      fail('Subject, strand, sub-strand and objective are required.');
    if (
      !https(indicator.sourceUrl) ||
      !Number.isInteger(indicator.sourcePage) ||
      indicator.sourcePage < 1
    )
      fail('A curriculum source URL and positive PDF page reference are required.');
    if (
      !indicator.assessmentModes.length ||
      indicator.assessmentModes.some((m) => !modes.includes(m)) ||
      !indicator.requiredDemands.length ||
      indicator.requiredDemands.some((d) => !demands.includes(d)) ||
      !indicator.requiredDifficulties.length ||
      indicator.requiredDifficulties.some((d) => !difficulties.includes(d))
    )
      fail('Declare valid assessment modes, cognitive demands and difficulty progression.');
  }
  const ids = new Map<string, number>();
  const signatures = new Map<string, number>();
  const variations = new Map<string, number>();
  const signature = (q: IndicatorQuestion) =>
    `${key(q.subject, q.indicatorCode)}::${normalize(q.prompt)}::${q.options.map(normalize).sort().join('|')}`;
  for (const q of questions) {
    for (const [map, value] of [
      [ids, q.id],
      [signatures, signature(q)],
      [variations, `${key(q.subject, q.indicatorCode)}::${normalize(q.variationKey)}`],
    ] as const)
      map.set(value, (map.get(value) ?? 0) + 1);
  }
  const acceptedQuestions: IndicatorQuestion[] = [];
  for (const q of questions) {
    const messages: string[] = [];
    const indicatorKey = key(q.subject, q.indicatorCode);
    const indicator = index.get(indicatorKey);
    if (!indicator || invalidIndicators.has(indicatorKey))
      messages.push('No valid inventory indicator matches this question.');
    else {
      if (
        q.grade !== indicator.grade ||
        q.standard !== indicator.standard ||
        q.sourceUrl !== indicator.sourceUrl ||
        q.sourcePage !== indicator.sourcePage
      )
        messages.push('Question metadata does not match its curriculum indicator.');
      if (!indicator.assessmentModes.includes('multiple-choice'))
        messages.push('This indicator does not permit multiple-choice assessment.');
      if (!indicator.sourceVerified)
        messages.push('The curriculum indicator source has not been verified.');
    }
    if (!/^[a-z][a-z0-9._:-]{3,}$/i.test(q.id) || ids.get(q.id)! > 1)
      messages.push('Question ID must be descriptive, stable and globally unique.');
    if (
      !q.variationKey.trim() ||
      variations.get(`${indicatorKey}::${normalize(q.variationKey)}`)! > 1 ||
      signatures.get(signature(q))! > 1
    )
      messages.push('Duplicate question content or variation key.');
    if (
      q.type !== 'multiple-choice' ||
      !q.prompt.trim() ||
      q.options.length < 2 ||
      q.options.length > 6 ||
      q.options.some((o) => !o.trim()) ||
      new Set(q.options.map(normalize)).size !== q.options.length ||
      !Number.isInteger(q.answer) ||
      q.answer < 0 ||
      q.answer >= q.options.length ||
      !q.explanation.trim()
    )
      messages.push(
        'A complete multiple-choice item needs distinct options, a valid answer and an explanation.',
      );
    if (!demands.includes(q.demand) || !difficulties.includes(q.difficulty))
      messages.push('Invalid demand or difficulty.');
    if (q.options.some((_, i) => i !== q.answer && !q.misconceptionFeedback[i]?.trim()))
      messages.push('Every distractor needs misconception-specific feedback.');
    if (
      q.authorship.original !== true ||
      !q.authorship.author.trim() ||
      !q.authorship.reviewedBy.trim()
    )
      messages.push('Original authorship and completed editorial review are required.');
    issues.push(...messages.map((message) => ({ reference: q.id, message })));
    if (!messages.length) acceptedQuestions.push(q);
  }
  const coverage = [...index.entries()].map(([reference, indicator]): CoverageGap => {
    const bank = acceptedQuestions.filter((q) => key(q.subject, q.indicatorCode) === reference);
    const missingDemands = indicator.requiredDemands.filter(
      (d) => !bank.some((q) => q.demand === d),
    );
    const missingDifficulties = indicator.requiredDifficulties.filter(
      (d) => !bank.some((q) => q.difficulty === d),
    );
    const unsupportedModes = indicator.assessmentModes.filter((m) => m !== 'multiple-choice');
    const missingQuestions = Math.max(0, minimum - bank.length);
    return {
      subject: indicator.subject,
      grade: indicator.grade,
      indicatorCode: indicator.code,
      validQuestions: bank.length,
      requiredQuestions: minimum,
      missingQuestions,
      missingDemands,
      missingDifficulties,
      unsupportedModes,
      sourceVerified: indicator.sourceVerified,
      ready:
        !invalidIndicators.has(reference) &&
        indicator.sourceVerified &&
        !missingQuestions &&
        !missingDemands.length &&
        !missingDifficulties.length &&
        !unsupportedModes.length,
    };
  });
  const inventoryComplete = options.inventoryComplete === true;
  return {
    inventoryComplete,
    ready:
      inventoryComplete && coverage.length > 0 && !issues.length && coverage.every((c) => c.ready),
    issues,
    coverage,
    acceptedQuestions,
  };
}
