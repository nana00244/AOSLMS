import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = (name) => JSON.parse(readFileSync(`src/learningHub/curriculum/${name}.json`, 'utf8'));
const sources = read('sources');
const audit = read('sourceAudit');
const references = read('indicatorReferences');
assert.equal(new Set(sources.map((s) => s.id)).size, sources.length);
assert.equal(new Set(references.map((r) => r.id)).size, references.length);
const primary = [
  'English Language',
  'Ghanaian Language',
  'Mathematics',
  'Science',
  'History',
  'Our World and Our People',
  'Creative Arts',
  'Physical Education',
  'Religious and Moral Education',
];
const jhs = [
  'English Language',
  'Ghanaian Language',
  'Mathematics',
  'Science',
  'French',
  'Arabic',
  'Social Studies',
  'Creative Arts and Design',
  'Career Technology',
  'Computing',
  'Physical Education and Health',
  'Religious and Moral Education',
];
const expected = [
  ...primary.flatMap((s) => [1, 2, 3, 4, 5, 6].map((g) => `${s}:B${g}`)),
  ...['French', 'Computing'].flatMap((s) => [4, 5, 6].map((g) => `${s}:B${g}`)),
  ...jhs.flatMap((s) => [7, 8, 9].map((g) => `${s}:B${g}`)),
];
const actual = sources.flatMap((s) => s.grades.map((g) => `${s.subject}:B${g}`));
assert.deepEqual(
  [...actual].sort(),
  [...expected].sort(),
  'Every applicable subject/grade must be present, even when its source is missing',
);
for (const reference of references) {
  const source = sources.find((s) => s.id === reference.sourceId);
  const document = audit.find((s) => s.id === reference.sourceId);
  assert.ok(source && document, reference.id);
  assert.equal(reference.sourceUrl, source.url);
  assert.equal(reference.subject, source.subject);
  assert.match(reference.code, /^B[1-9](?:\.[1-9]\d*){4}$/);
  assert.equal(reference.id, `${source.subjectId}:${reference.code}`);
  assert.equal(reference.level, reference.code.slice(0, 2));
  assert.equal(reference.contentStandard, reference.code.slice(0, reference.code.lastIndexOf('.')));
  assert.ok(source.grades.includes(Number(reference.level[1])));
  assert.ok(reference.pages.length > 0);
  for (const page of reference.pages)
    assert.ok(
      Number.isInteger(page) && page >= source.firstContentPage && page <= document.pdfPages,
      `${reference.id}: invalid page`,
    );
  assert.ok(reference.sourceCodeForms.length > 0);
  for (const form of reference.sourceCodeForms) {
    const digits = form.match(/\d+/g).map(Number);
    assert.equal(
      `B${digits.join('.')}`,
      reference.code,
      'Normalization must preserve all source code numbers',
    );
  }
  assert.equal(
    reference.reviewStatus,
    'reference-extracted; meaning-and-table-placement-unverified',
  );
}
for (const document of audit) {
  const found = references.filter((r) => r.sourceId === document.id);
  if (document.status === 'source-unavailable') {
    assert.equal(found.length, 0);
    continue;
  }
  assert.equal(found.length, document.indicatorCount);
  for (const [grade, count] of Object.entries(document.byLevel))
    assert.equal(found.filter((r) => r.level === grade).length, count);
}
const observed = new Set(references.map((r) => `${r.subject}:${r.level}`));
const gaps = expected.filter((cell) => !observed.has(cell));
console.log(
  `Inventory structure verified: ${references.length} candidate references; ${observed.size}/${expected.length} subject/grade cells contain references.`,
);
console.log(
  `Unresolved source coverage: ${gaps.join(', ') || 'none'}. These checks do not verify indicator meanings or complete curriculum extraction.`,
);
