import { readFileSync } from 'node:fs';
import { hubLessons } from '../src/learningHub/catalog.ts';
const references = JSON.parse(
  readFileSync('src/learningHub/curriculum/indicatorReferences.json', 'utf8'),
);
const sources = JSON.parse(readFileSync('src/learningHub/curriculum/sourceAudit.json', 'utf8'));
const key = (subject, code) => `${subject}::${code}`;
const banks = new Map();
for (const lesson of hubLessons) {
  const k = key(lesson.subject, lesson.standard);
  const items = banks.get(k) || new Set();
  for (const q of lesson.questions) items.add(`${q.prompt}|${[...q.options].sort().join('|')}`);
  banks.set(k, items);
}
const groups = new Map();
const missing = [];
let populated = 0;
for (const indicator of references) {
  const k = `${indicator.subject} ${indicator.level}`;
  const group = groups.get(k) || {
    subject: indicator.subject,
    grade: indicator.level,
    candidateIndicators: 0,
    banksWith16Questions: 0,
  };
  group.candidateIndicators++;
  const count = banks.get(key(indicator.subject, indicator.code))?.size || 0;
  if (count >= 16) {
    group.banksWith16Questions++;
    populated++;
  } else missing.push({ subject: indicator.subject, code: indicator.code, questions: count });
  groups.set(k, group);
}
const report = {
  status:
    'incomplete; extracted references and question counts do not certify full indicator coverage',
  candidateIndicators: references.length,
  indicatorsWith16Questions: populated,
  unavailableSources: sources.filter((s) => s.status === 'source-unavailable').map((s) => s.id),
  groups: [...groups.values()],
  missing,
};
if (process.argv.includes('--json')) console.log(JSON.stringify(report, null, 2));
else {
  console.table(report.groups);
  console.log(
    `${populated}/${references.length} candidate indicators have at least 16 questions. Semantic and practical assessment coverage is not certified.`,
  );
  console.log(`Unavailable sources: ${report.unavailableSources.join(', ') || 'none'}`);
}
if (process.argv.includes('--require-complete')) {
  console.error(
    'Complete curriculum publication is blocked: source meanings, practical assessments and question coverage require review.',
  );
  process.exitCode = 1;
}
