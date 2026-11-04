import type {
  NaccaSubject,
  NaccaLevel,
  NaccaIndicator,
  NaccaQuestion,
  QuestionType,
  ImportReport,
  SkippedItem,
  IndicatorReport,
} from './types';
import { sortIndicators, sortQuestions } from './sortOrder';

const VALID_TYPES: QuestionType[] = [
  'mcq',
  'numeric',
  'short_answer',
  'written',
  'oral',
  'drawing',
  'practical',
  'role_play',
];

export interface ImportResult {
  subjects: NaccaSubject[];
  levels: NaccaLevel[];
  indicators: NaccaIndicator[];
  questions: NaccaQuestion[];
  report: ImportReport;
}

/**
 * Normalizes and imports question bank data from either:
 * 1. Flat published_questions array
 * 2. Grouped indicator blocks (e.g. BS1_MATHS_5cac2f21.json)
 *
 * Safe to run repeatedly with updated files:
 * - Deterministic unique IDs ensure questions are updated, never duplicated.
 * - Malformed items are skipped with clear reasons and reported.
 * - Exact content is preserved without alterations (Rule 1).
 */
export function processQuestionBank(rawJson: unknown): ImportResult {
  if (!Array.isArray(rawJson)) {
    throw new Error('Question bank JSON must be an array of questions or indicator blocks');
  }

  const subjectsMap = new Map<string, NaccaSubject>();
  const levelsMap = new Map<string, NaccaLevel>();
  const indicatorsMap = new Map<string, NaccaIndicator>();
  const questionsMap = new Map<string, NaccaQuestion>();
  const skippedItems: SkippedItem[] = [];

  // Helper to ensure subject and level are registered
  function registerSubjectAndLevel(subjName: string, lvlName: string) {
    const sId = subjName.trim();
    if (!subjectsMap.has(sId)) {
      subjectsMap.set(sId, { id: sId, name: sId });
    }
    const lId = lvlName.trim();
    if (!levelsMap.has(lId)) {
      // Determine sequence if standard B1-B9
      const match = lId.match(/(\d+)/);
      const seq = match ? parseInt(match[1], 10) : 99;
      levelsMap.set(lId, { id: lId, name: lId, sequence: seq });
    }
  }

  // Detect format: indicator-grouped (has `indicator` and `questions` array) or flat question items
  const isGroupedFormat =
    rawJson.length > 0 &&
    typeof rawJson[0] === 'object' &&
    rawJson[0] !== null &&
    'indicator' in rawJson[0] &&
    'questions' in rawJson[0];

  if (isGroupedFormat) {
    for (let blockIdx = 0; blockIdx < rawJson.length; blockIdx++) {
      const block = rawJson[blockIdx];
      if (!block || typeof block !== 'object') {
        skippedItems.push({
          id: `block_${blockIdx + 1}`,
          reason: 'Indicator block is not an object',
          raw: block,
        });
        continue;
      }

      const ind = (block as Record<string, unknown>).indicator as
        Record<string, unknown> | undefined;
      if (!ind || typeof ind !== 'object' || !ind.code || typeof ind.code !== 'string') {
        skippedItems.push({
          id: `block_${blockIdx + 1}`,
          reason: 'Missing or invalid indicator definition in block',
          raw: block,
        });
        continue;
      }

      const indicatorCode = ind.code.replace(/\s+/g, '').trim();
      const subject = String(ind.subject || 'General').trim();
      const level = String(ind.level || 'General').trim();
      const strand = String(ind.strand || '').trim();
      const subStrand = String(ind.sub_strand || '').trim();

      registerSubjectAndLevel(subject, level);

      const indicatorRecord: NaccaIndicator = {
        code: indicatorCode,
        subject,
        level,
        strand,
        sub_strand: subStrand,
        content_standard: ind.content_standard ? String(ind.content_standard) : undefined,
        objective: ind.objective ? String(ind.objective) : undefined,
        source_page: typeof ind.source_page === 'number' ? ind.source_page : undefined,
        spec: (block as Record<string, unknown>).spec as NaccaIndicator['spec'],
      };
      const indKey = `${subject}:${indicatorCode}`;
      indicatorsMap.set(indKey, indicatorRecord);

      const rawQuestions = (block as Record<string, unknown>).questions;
      if (!Array.isArray(rawQuestions)) {
        skippedItems.push({
          id: indicatorCode,
          indicator_code: indicatorCode,
          reason: 'Indicator block questions property is not an array',
        });
        continue;
      }

      const idPrefix =
        subject === 'Mathematics'
          ? indicatorCode
          : `${subject.toLowerCase().slice(0, 3)}_${indicatorCode}`;

      for (let qIdx = 0; qIdx < rawQuestions.length; qIdx++) {
        const q = rawQuestions[qIdx];
        let qNum = qIdx + 1;
        let defaultId = `${idPrefix}_q${qNum}`;
        while (questionsMap.has(defaultId)) {
          qNum++;
          defaultId = `${idPrefix}_q${qNum}`;
        }
        validateAndAddQuestion(q, defaultId, indicatorRecord, questionsMap, skippedItems);
      }
    }
  } else {
    // Flat format: array of individual questions
    for (let i = 0; i < rawJson.length; i++) {
      const item = rawJson[i];
      if (!item || typeof item !== 'object') {
        skippedItems.push({
          id: `item_${i + 1}`,
          reason: 'Item is not an object',
          raw: item,
        });
        continue;
      }

      const qObj = item as Record<string, unknown>;
      const indicatorCode = String(qObj.indicator_code || '').trim();
      const subject = String(qObj.subject || 'General').trim();
      const level = String(qObj.level || 'General').trim();

      if (!indicatorCode) {
        skippedItems.push({
          id: String(qObj.id || `item_${i + 1}`),
          reason: 'Missing indicator_code on question',
          raw: item,
        });
        continue;
      }

      registerSubjectAndLevel(subject, level);

      const indKey = `${subject}:${indicatorCode}`;
      if (!indicatorsMap.has(indKey)) {
        indicatorsMap.set(indKey, {
          code: indicatorCode,
          subject,
          level,
          strand: String(qObj.strand || '').trim(),
          sub_strand: String(qObj.sub_strand || '').trim(),
          objective: qObj.objective ? String(qObj.objective) : undefined,
        });
      }

      const ind = indicatorsMap.get(indKey)!;
      const idPrefix =
        subject === 'Mathematics'
          ? indicatorCode
          : `${subject.toLowerCase().slice(0, 3)}_${indicatorCode}`;
      const defaultId = String(qObj.id || `${idPrefix}_q${i + 1}`);
      validateAndAddQuestion(qObj, defaultId, ind, questionsMap, skippedItems);
    }
  }

  // Compile full detailed report in ascending curriculum order
  const rawIndicators = Array.from(indicatorsMap.values());
  const indicators = sortIndicators(rawIndicators);
  const rawQuestions = Array.from(questionsMap.values());
  const questions = sortQuestions(rawQuestions, indicators);
  const subjects = Array.from(subjectsMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  const levels = Array.from(levelsMap.values()).sort((a, b) => a.sequence - b.sequence);

  const countsBySubject: Record<string, number> = {};
  const countsByLevel: Record<string, number> = {};
  const countsBySubjectAndLevel: Record<string, Record<string, number>> = {};
  const questionsPerIndicator: Record<string, number> = {};
  const indicatorReports: IndicatorReport[] = [];

  for (const q of questions) {
    countsBySubject[q.subject] = (countsBySubject[q.subject] || 0) + 1;
    countsByLevel[q.level] = (countsByLevel[q.level] || 0) + 1;

    if (!countsBySubjectAndLevel[q.subject]) {
      countsBySubjectAndLevel[q.subject] = {};
    }
    countsBySubjectAndLevel[q.subject][q.level] =
      (countsBySubjectAndLevel[q.subject][q.level] || 0) + 1;

    questionsPerIndicator[q.indicator_code] = (questionsPerIndicator[q.indicator_code] || 0) + 1;
  }

  for (const ind of indicators) {
    const indQuestions = questions.filter(
      (q) => q.indicator_code === ind.code && q.subject === ind.subject,
    );
    const types: Record<string, number> = {};
    const difficulties: Record<number, number> = {};

    for (const q of indQuestions) {
      types[q.type] = (types[q.type] || 0) + 1;
      difficulties[q.difficulty] = (difficulties[q.difficulty] || 0) + 1;
    }

    indicatorReports.push({
      code: ind.code,
      subject: ind.subject,
      level: ind.level,
      strand: ind.strand,
      sub_strand: ind.sub_strand,
      objective: ind.objective,
      questionCount: indQuestions.length,
      types,
      difficulties,
    });
  }

  const report: ImportReport = {
    totalImported: questions.length,
    totalSkipped: skippedItems.length,
    subjectsCount: subjects.length,
    levelsCount: levels.length,
    indicatorsCount: indicators.length,
    countsBySubject,
    countsByLevel,
    countsBySubjectAndLevel,
    questionsPerIndicator,
    indicators: indicatorReports,
    skippedItems,
  };

  return {
    subjects,
    levels,
    indicators,
    questions,
    report,
  };
}

function validateAndAddQuestion(
  raw: unknown,
  fallbackId: string,
  indicator: NaccaIndicator,
  questionsMap: Map<string, NaccaQuestion>,
  skippedItems: SkippedItem[],
) {
  if (!raw || typeof raw !== 'object') {
    skippedItems.push({
      id: fallbackId,
      indicator_code: indicator.code,
      reason: 'Question item is not an object',
      raw,
    });
    return;
  }

  const q = raw as Record<string, unknown>;
  const id = typeof q.id === 'string' && q.id.trim() ? q.id.trim() : fallbackId;

  const stem = typeof q.stem === 'string' ? q.stem.trim() : '';
  if (!stem) {
    skippedItems.push({
      id,
      indicator_code: indicator.code,
      reason: 'Missing or empty question stem',
      raw: q,
    });
    return;
  }

  const type = String(q.type || '')
    .trim()
    .toLowerCase() as QuestionType;
  if (!VALID_TYPES.includes(type)) {
    skippedItems.push({
      id,
      indicator_code: indicator.code,
      reason: `Unsupported question type: "${q.type}"`,
      raw: q,
    });
    return;
  }

  const difficulty =
    typeof q.difficulty === 'number' ? q.difficulty : parseInt(String(q.difficulty), 10);
  if (!difficulty || difficulty < 1 || difficulty > 4 || Number.isNaN(difficulty)) {
    skippedItems.push({
      id,
      indicator_code: indicator.code,
      reason: `Invalid difficulty level: "${q.difficulty}" (must be 1 to 4)`,
      raw: q,
    });
    return;
  }

  // Type-specific validations per Rules & Spec
  let options: string[] | undefined = undefined;
  let answer: NaccaQuestion['answer'] = undefined;

  if (type === 'mcq') {
    if (!Array.isArray(q.options) || q.options.length < 2) {
      skippedItems.push({
        id,
        indicator_code: indicator.code,
        reason: 'MCQ options must be an array with at least 2 choices',
        raw: q,
      });
      return;
    }
    options = q.options.map((opt) => String(opt).trim());

    const ansNum = typeof q.answer === 'number' ? q.answer : parseInt(String(q.answer), 10);
    if (Number.isNaN(ansNum) || ansNum < 0 || ansNum >= options.length) {
      skippedItems.push({
        id,
        indicator_code: indicator.code,
        reason: `MCQ answer index (${q.answer}) is out of bounds for ${options.length} options`,
        raw: q,
      });
      return;
    }
    answer = ansNum;
  } else if (type === 'numeric') {
    if (
      typeof q.answer !== 'number' &&
      (typeof q.answer !== 'string' || Number.isNaN(Number(q.answer)))
    ) {
      skippedItems.push({
        id,
        indicator_code: indicator.code,
        reason: `Numeric question must have a numeric answer, got: ${JSON.stringify(q.answer)}`,
        raw: q,
      });
      return;
    }
    answer = typeof q.answer === 'number' ? q.answer : Number(q.answer);
  } else if (type === 'short_answer') {
    if (!Array.isArray(q.answer) && typeof q.answer !== 'string') {
      skippedItems.push({
        id,
        indicator_code: indicator.code,
        reason: `Short answer question must have string or array of accepted answers, got: ${JSON.stringify(q.answer)}`,
        raw: q,
      });
      return;
    }
    answer = Array.isArray(q.answer)
      ? q.answer.map((a) => String(a).trim())
      : [String(q.answer).trim()];
  } else {
    // Teacher-marked questions (written, oral, drawing, practical)
    // Rule: no auto answer; may have a rubric with criteria
    answer = undefined;
  }

  // Extract hints
  const hints: string[] = Array.isArray(q.hints)
    ? q.hints.map((h) => String(h).trim()).filter(Boolean)
    : [];

  const explanation = typeof q.explanation === 'string' ? q.explanation.trim() : undefined;
  const reviewer = typeof q.reviewer === 'string' ? q.reviewer.trim() : undefined;
  const misconception = typeof q.misconception === 'string' ? q.misconception.trim() : undefined;
  const checkFormula = typeof q.check === 'string' ? q.check.trim() : undefined;
  const skillTag = typeof q.skill_tag === 'string' ? q.skill_tag.trim() : undefined;

  let uncertain: string[] = [];
  if (Array.isArray(q.uncertain)) {
    uncertain = q.uncertain.map(String);
  }

  const question: NaccaQuestion = {
    id,
    indicator_code: indicator.code,
    subject: indicator.subject,
    level: indicator.level,
    strand: indicator.strand,
    sub_strand: indicator.sub_strand,
    objective: indicator.objective,
    skill_tag: skillTag,
    type,
    difficulty,
    stem,
    options,
    answer,
    hints,
    explanation,
    rubric: q.rubric as NaccaQuestion['rubric'],
    reviewer,
    misconception,
    uncertain,
    check_formula: checkFormula,
  };

  questionsMap.set(id, question);
}
