#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '..');

// 1. Determine input file
let filePath = process.argv[2];
if (!filePath) {
  if (existsSync(resolve(rootDir, 'published_questions.json'))) {
    filePath = resolve(rootDir, 'published_questions.json');
  } else if (existsSync(resolve(rootDir, 'public/assets/aistudio/BS1_MATHS_5cac2f21.json'))) {
    filePath = resolve(rootDir, 'public/assets/aistudio/BS1_MATHS_5cac2f21.json');
  } else {
    console.error('Error: No question bank JSON file found (looked for published_questions.json)');
    process.exit(1);
  }
} else {
  filePath = resolve(process.cwd(), filePath);
}

console.log(`\n======================================================`);
console.log(`   NaCCA QUESTION BANK IMPORT SCRIPT (STEP 1)`);
console.log(`======================================================`);
console.log(`Reading source file: ${filePath}`);

const rawContent = readFileSync(filePath, 'utf8');
let rawData;
try {
  rawData = JSON.parse(rawContent);
} catch (err) {
  console.error(`Invalid JSON in file: ${err.message}`);
  process.exit(1);
}

if (!Array.isArray(rawData)) {
  console.error('Expected JSON file to contain an array at top level.');
  process.exit(1);
}

// 2. Process and normalize items
const VALID_TYPES = ['mcq', 'numeric', 'short_answer', 'written', 'oral', 'drawing', 'practical', 'role_play'];

const subjectsMap = new Map();
const levelsMap = new Map();
const indicatorsMap = new Map();
const questionsMap = new Map();
const skippedItems = [];

function registerSubjectAndLevel(subjName, lvlName) {
  const sId = (subjName || 'General').trim();
  if (!subjectsMap.has(sId)) {
    subjectsMap.set(sId, { id: sId, name: sId });
  }
  const lId = (lvlName || 'General').trim();
  if (!levelsMap.has(lId)) {
    const match = lId.match(/(\d+)/);
    const seq = match ? parseInt(match[1], 10) : 99;
    levelsMap.set(lId, { id: lId, name: lId, sequence: seq });
  }
}

function validateAndAddQuestion(q, fallbackId, indicator) {
  if (!q || typeof q !== 'object') {
    skippedItems.push({
      id: fallbackId,
      indicator_code: indicator.code,
      reason: 'Question item is not a valid JSON object',
    });
    return;
  }

  const id = typeof q.id === 'string' && q.id.trim() ? q.id.trim() : fallbackId;
  const stem = typeof q.stem === 'string' ? q.stem.trim() : '';
  if (!stem) {
    skippedItems.push({
      id,
      indicator_code: indicator.code,
      reason: 'Missing or empty question stem',
    });
    return;
  }

  const type = String(q.type || '').trim().toLowerCase();
  if (!VALID_TYPES.includes(type)) {
    skippedItems.push({
      id,
      indicator_code: indicator.code,
      reason: `Unsupported question type: "${q.type}"`,
    });
    return;
  }

  const difficulty = typeof q.difficulty === 'number' ? q.difficulty : parseInt(String(q.difficulty), 10);
  if (!difficulty || difficulty < 1 || difficulty > 4 || Number.isNaN(difficulty)) {
    skippedItems.push({
      id,
      indicator_code: indicator.code,
      reason: `Invalid difficulty: "${q.difficulty}" (must be 1 to 4)`,
    });
    return;
  }

  let options = null;
  let answer = null;

  if (type === 'mcq') {
    if (!Array.isArray(q.options) || q.options.length < 2) {
      skippedItems.push({
        id,
        indicator_code: indicator.code,
        reason: 'MCQ options must be an array with at least 2 choices',
      });
      return;
    }
    options = q.options.map((opt) => String(opt).trim());
    const ansNum = typeof q.answer === 'number' ? q.answer : parseInt(String(q.answer), 10);
    if (Number.isNaN(ansNum) || ansNum < 0 || ansNum >= options.length) {
      skippedItems.push({
        id,
        indicator_code: indicator.code,
        reason: `MCQ answer index (${q.answer}) out of bounds for options length ${options.length}`,
      });
      return;
    }
    answer = ansNum;
  } else if (type === 'numeric') {
    if (typeof q.answer !== 'number' && (typeof q.answer !== 'string' || Number.isNaN(Number(q.answer)))) {
      skippedItems.push({
        id,
        indicator_code: indicator.code,
        reason: `Numeric question must have numeric answer, got: ${JSON.stringify(q.answer)}`,
      });
      return;
    }
    answer = typeof q.answer === 'number' ? q.answer : Number(q.answer);
  } else if (type === 'short_answer') {
    if (!Array.isArray(q.answer) && typeof q.answer !== 'string') {
      skippedItems.push({
        id,
        indicator_code: indicator.code,
        reason: `Short answer question must have string or array of accepted answers`,
      });
      return;
    }
    answer = Array.isArray(q.answer) ? q.answer.map((a) => String(a).trim()) : [String(q.answer).trim()];
  } else {
    // Teacher-marked (written, oral, drawing, practical)
    answer = null;
  }

  const hints = Array.isArray(q.hints) ? q.hints.map((h) => String(h).trim()).filter(Boolean) : [];
  const explanation = typeof q.explanation === 'string' ? q.explanation.trim() : null;
  const reviewer = typeof q.reviewer === 'string' ? q.reviewer.trim() : null;
  const misconception = typeof q.misconception === 'string' ? q.misconception.trim() : null;
  const checkFormula = typeof q.check === 'string' ? q.check.trim() : null;
  const skillTag = typeof q.skill_tag === 'string' ? q.skill_tag.trim() : null;
  const rubric = q.rubric || null;
  const uncertain = Array.isArray(q.uncertain) ? q.uncertain.map(String) : [];

  questionsMap.set(id, {
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
    rubric,
    reviewer,
    misconception,
    uncertain,
    check_formula: checkFormula,
  });
}

const isGrouped =
  rawData.length > 0 &&
  typeof rawData[0] === 'object' &&
  rawData[0] !== null &&
  'indicator' in rawData[0] &&
  'questions' in rawData[0];

if (isGrouped) {
  for (let bIdx = 0; bIdx < rawData.length; bIdx++) {
    const block = rawData[bIdx];
    const ind = block?.indicator;
    if (!ind || !ind.code) {
      skippedItems.push({
        id: `block_${bIdx + 1}`,
        reason: 'Missing indicator or code in block',
      });
      continue;
    }

    const code = ind.code.replace(/\s+/g, '').trim();
    const subject = (ind.subject || 'Mathematics').trim();
    const level = (ind.level || 'Basic 1').trim();
    registerSubjectAndLevel(subject, level);

    const indicator = {
      code,
      subject,
      level,
      strand: (ind.strand || '').trim(),
      sub_strand: (ind.sub_strand || '').trim(),
      content_standard: ind.content_standard || null,
      objective: ind.objective || null,
      source_page: typeof ind.source_page === 'number' ? ind.source_page : null,
      spec: block.spec || null,
    };
    const indKey = `${subject}:${code}`;
    indicatorsMap.set(indKey, indicator);

    const questions = block.questions || [];
    const idPrefix =
      subject === 'Mathematics'
        ? code
        : `${subject.toLowerCase().slice(0, 3)}_${code}`;

    for (let qIdx = 0; qIdx < questions.length; qIdx++) {
      const q = questions[qIdx];
      let qNum = qIdx + 1;
      let defaultId = `${idPrefix}_q${qNum}`;
      while (questionsMap.has(defaultId)) {
        qNum++;
        defaultId = `${idPrefix}_q${qNum}`;
      }
      validateAndAddQuestion(q, defaultId, indicator);
    }
  }
} else {
  for (let i = 0; i < rawData.length; i++) {
    const item = rawData[i];
    const code = String(item?.indicator_code || '').trim();
    const subject = String(item?.subject || 'Mathematics').trim();
    const level = String(item?.level || 'Basic 1').trim();

    if (!code) {
      skippedItems.push({
        id: item?.id || `item_${i + 1}`,
        reason: 'Missing indicator_code on question',
      });
      continue;
    }

    registerSubjectAndLevel(subject, level);
    if (!indicatorsMap.has(code)) {
      indicatorsMap.set(code, {
        code,
        subject,
        level,
        strand: (item?.strand || '').trim(),
        sub_strand: (item?.sub_strand || '').trim(),
        content_standard: item?.content_standard || null,
        objective: item?.objective || null,
        source_page: item?.source_page || null,
        spec: null,
      });
    }

    const indicator = indicatorsMap.get(code);
    const defaultId = item?.id || `${code}_q${i + 1}`;
    validateAndAddQuestion(item, defaultId, indicator);
  }
}

// 3. Database test & verification with PGlite
const db = new PGlite();
const migrationSql = readFileSync(
  resolve(rootDir, 'supabase/migrations/20261030083000_nacca_question_bank.sql'),
  'utf8',
);

await db.exec(migrationSql);

// Upsert subjects
for (const subj of subjectsMap.values()) {
  await db.query(
    `insert into public.nacca_subjects (id, name)
     values ($1, $2)
     on conflict (id) do update set name = excluded.name`,
    [subj.id, subj.name],
  );
}

// Upsert levels
for (const lvl of levelsMap.values()) {
  await db.query(
    `insert into public.nacca_levels (id, name, sequence)
     values ($1, $2, $3)
     on conflict (id) do update set name = excluded.name, sequence = excluded.sequence`,
    [lvl.id, lvl.name, lvl.sequence],
  );
}

// Upsert indicators
for (const ind of indicatorsMap.values()) {
  await db.query(
    `insert into public.nacca_indicators (code, subject, level, strand, sub_strand, content_standard, objective, source_page, spec, updated_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, now())
     on conflict (code, subject) do update set
       level = excluded.level,
       strand = excluded.strand,
       sub_strand = excluded.sub_strand,
       content_standard = excluded.content_standard,
       objective = excluded.objective,
       source_page = excluded.source_page,
       spec = excluded.spec,
       updated_at = now()`,
    [
      ind.code,
      ind.subject,
      ind.level,
      ind.strand,
      ind.sub_strand,
      ind.content_standard,
      ind.objective,
      ind.source_page,
      JSON.stringify(ind.spec),
    ],
  );
}

// Upsert questions
for (const q of questionsMap.values()) {
  await db.query(
    `insert into public.nacca_questions (
       id, indicator_code, subject, level, strand, sub_strand, objective, skill_tag,
       type, difficulty, stem, options, answer, hints, explanation, rubric, reviewer,
       misconception, uncertain, check_formula, updated_at
     ) values (
       $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, now()
     )
     on conflict (id) do update set
       indicator_code = excluded.indicator_code,
       subject = excluded.subject,
       level = excluded.level,
       strand = excluded.strand,
       sub_strand = excluded.sub_strand,
       objective = excluded.objective,
       skill_tag = excluded.skill_tag,
       type = excluded.type,
       difficulty = excluded.difficulty,
       stem = excluded.stem,
       options = excluded.options,
       answer = excluded.answer,
       hints = excluded.hints,
       explanation = excluded.explanation,
       rubric = excluded.rubric,
       reviewer = excluded.reviewer,
       misconception = excluded.misconception,
       uncertain = excluded.uncertain,
       check_formula = excluded.check_formula,
       updated_at = now()`,
    [
      q.id,
      q.indicator_code,
      q.subject,
      q.level,
      q.strand,
      q.sub_strand,
      q.objective,
      q.skill_tag,
      q.type,
      q.difficulty,
      q.stem,
      q.options ? JSON.stringify(q.options) : null,
      q.answer !== null && q.answer !== undefined ? JSON.stringify(q.answer) : null,
      JSON.stringify(q.hints),
      q.explanation,
      q.rubric ? JSON.stringify(q.rubric) : null,
      q.reviewer,
      q.misconception,
      JSON.stringify(q.uncertain),
      q.check_formula,
    ],
  );
}

// Verify database counts
const dbSubjCount = (await db.query('select count(*) as count from public.nacca_subjects')).rows[0].count;
const dbLvlCount = (await db.query('select count(*) as count from public.nacca_levels')).rows[0].count;
const dbIndCount = (await db.query('select count(*) as count from public.nacca_indicators')).rows[0].count;
const dbQCount = (await db.query('select count(*) as count from public.nacca_questions')).rows[0].count;

// Verify student view security (Rule 2)
const studentViewCols = (
  await db.query(
    `select column_name from information_schema.columns where table_schema = 'public' and table_name = 'nacca_questions_student'`,
  )
).rows.map((r) => r.column_name);

const hasAnswerInStudentView = studentViewCols.includes('answer');

// 4. Save synced bank for in-app / offline access in ascending curriculum order
function getLevelRank(levelStr) {
  const m = String(levelStr || '').match(/\d+/);
  return m ? parseInt(m[0], 10) : 99;
}

function parseCodeNumbers(codeStr) {
  const c = (codeStr || '').replace(/^BI\./i, 'B1.');
  const parts = c.split('.');
  const res = [];
  for (const p of parts) {
    const m = p.match(/\d+/);
    if (m) res.push(parseInt(m[0], 10));
  }
  return res;
}

function compareIndicators(a, b) {
  const subjA = (a.subject || 'Mathematics').trim();
  const subjB = (b.subject || 'Mathematics').trim();
  if (subjA !== subjB) return subjA.localeCompare(subjB);

  const lvlA = getLevelRank(a.level);
  const lvlB = getLevelRank(b.level);
  if (lvlA !== lvlB) return lvlA - lvlB;

  const pageA = a.source_page || 0;
  const pageB = b.source_page || 0;
  if (pageA && pageB && pageA !== pageB) return pageA - pageB;

  const numsA = parseCodeNumbers(a.code);
  const numsB = parseCodeNumbers(b.code);
  const maxLen = Math.max(numsA.length, numsB.length);
  for (let i = 0; i < maxLen; i++) {
    const valA = numsA[i] ?? 0;
    const valB = numsB[i] ?? 0;
    if (valA !== valB) return valA - valB;
  }

  return a.code.localeCompare(b.code);
}

const sortedIndicators = Array.from(indicatorsMap.values()).sort(compareIndicators);
const indicatorOrderMap = new Map();
sortedIndicators.forEach((ind, idx) => {
  indicatorOrderMap.set(ind.code, idx);
});

const sortedQuestions = Array.from(questionsMap.values()).sort((qA, qB) => {
  if (qA.level !== qB.level) {
    return getLevelRank(qA.level) - getLevelRank(qB.level);
  }
  const idxA = indicatorOrderMap.get(qA.indicator_code) ?? 9999;
  const idxB = indicatorOrderMap.get(qB.indicator_code) ?? 9999;
  if (idxA !== idxB) return idxA - idxB;
  const numA = parseInt(qA.id.replace(/\D/g, ''), 10) || 0;
  const numB = parseInt(qB.id.replace(/\D/g, ''), 10) || 0;
  if (numA !== numB) return numA - numB;
  return qA.id.localeCompare(qB.id);
});

const bankOutput = {
  importedAt: new Date().toISOString(),
  sourceFile: filePath,
  subjects: Array.from(subjectsMap.values()),
  levels: Array.from(levelsMap.values()),
  indicators: sortedIndicators,
  questions: sortedQuestions,
  skippedItems,
};

const bankPath = resolve(rootDir, 'src/nacca/importedBank.json');
writeFileSync(bankPath, JSON.stringify(bankOutput, null, 2), 'utf8');

// 5. Build and print the required STEP 1 report
const countsBySubjectAndLevel = {};
const questionsPerIndicator = {};

for (const q of questionsMap.values()) {
  if (!countsBySubjectAndLevel[q.subject]) {
    countsBySubjectAndLevel[q.subject] = {};
  }
  countsBySubjectAndLevel[q.subject][q.level] =
    (countsBySubjectAndLevel[q.subject][q.level] || 0) + 1;
  questionsPerIndicator[q.indicator_code] =
    (questionsPerIndicator[q.indicator_code] || 0) + 1;
}

console.log(`\n======================================================`);
console.log(`             IMPORT REPORT FOR STEP 1`);
console.log(`======================================================`);
console.log(`\n1. COUNTS PER SUBJECT AND LEVEL:`);
for (const [subj, levels] of Object.entries(countsBySubjectAndLevel)) {
  for (const [lvl, count] of Object.entries(levels)) {
    console.log(`   - Subject: "${subj}" | Level: "${lvl}" -> ${count} questions`);
  }
}

console.log(`\n2. NUMBER OF INDICATORS: ${indicatorsMap.size}`);

console.log(`\n3. QUESTIONS PER INDICATOR:`);
for (const ind of indicatorsMap.values()) {
  const count = sortedQuestions.filter((q) => q.indicator_code === ind.code && q.subject === ind.subject).length;
  console.log(`   - Indicator: [${ind.subject}] ${ind.code.padEnd(12)} -> ${String(count).padStart(2)} questions (${ind.strand} / ${ind.sub_strand})`);
}

console.log(`\n4. ITEMS SKIPPED AND WHY:`);
if (skippedItems.length === 0) {
  console.log(`   None. All ${questionsMap.size} questions were valid and imported successfully.`);
} else {
  console.log(`   Total skipped: ${skippedItems.length}`);
  skippedItems.forEach((item, i) => {
    console.log(`   ${i + 1}. [${item.id}] Indicator: ${item.indicator_code || 'N/A'} - Reason: ${item.reason}`);
  });
}

console.log(`\n5. DATABASE VERIFICATION (PGlite):`);
console.log(`   - Table public.nacca_subjects:   ${dbSubjCount} rows`);
console.log(`   - Table public.nacca_levels:     ${dbLvlCount} rows`);
console.log(`   - Table public.nacca_indicators: ${dbIndCount} rows`);
console.log(`   - Table public.nacca_questions:  ${dbQCount} rows`);
console.log(`   - Student view security check:   ${!hasAnswerInStudentView ? 'PASS (answer column withheld)' : 'FAIL'}`);
console.log(`   - Synced bank written to:       src/nacca/importedBank.json`);
console.log(`======================================================\n`);
