import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const sourceDirectory = 'C:/Users/DONEX/Downloads/BS1 ENGLISH';
const outputPath = 'src/nacca/basic1EnglishBank.json';

function parseSource(text, filename) {
  try {
    return JSON.parse(text);
  } catch {
    const fencedJson = [...text.matchAll(/```json\s*([\s\S]*?)\s*```/gi)];
    for (const [, candidate] of fencedJson.reverse()) {
      try {
        const parsed = JSON.parse(candidate);
        if (parsed?.indicator?.code && Array.isArray(parsed.questions)) return parsed;
      } catch {
        // Try an earlier complete JSON block, if present.
      }
    }
    // Some supplied files have commentary appended after the JSON object.
    let depth = 0;
    let inJsonString = false;
    let escapedJsonCharacter = false;
    let rootEnd = -1;
    for (let index = 0; index < text.length; index += 1) {
      const character = text[index];
      if (escapedJsonCharacter) escapedJsonCharacter = false;
      else if (character === '\\' && inJsonString) escapedJsonCharacter = true;
      else if (character === '"') inJsonString = !inJsonString;
      else if (!inJsonString && character === '{') depth += 1;
      else if (!inJsonString && character === '}' && --depth === 0) {
        rootEnd = index;
        break;
      }
    }
    if (rootEnd >= 0) {
      try {
        return JSON.parse(text.slice(0, rootEnd + 1));
      } catch {
        // Continue to the control-character repair below.
      }
    }
    // A source file contains a literal line break inside a quoted explanation.
    // Escape raw control characters inside strings while preserving other text.
    let repaired = '';
    let inString = false;
    let escaped = false;
    for (let index = 0; index < text.length; index += 1) {
      const character = text[index];
      const code = character.charCodeAt(0);
      if (inString && code < 32) {
        repaired += code === 10 ? '\\n' : code === 13 ? '\\r' : code === 9 ? '\\t' : `\\u${code.toString(16).padStart(4, '0')}`;
        continue;
      }
      if (character === '"' && inString && !escaped) {
        let lookahead = index + 1;
        while (/\s/.test(text[lookahead] || '')) lookahead += 1;
        if (!':,]}'.includes(text[lookahead] || '')) {
          repaired += '\\"';
          continue;
        }
      }
      repaired += character;
      if (escaped) escaped = false;
      else if (character === '\\' && inString) escaped = true;
      else if (character === '"') inString = !inString;
    }
    try {
      return JSON.parse(repaired);
    } catch (error) {
      throw new Error(`Could not parse ${filename}: ${error.message}`);
    }
  }
}

const filenames = readdirSync(sourceDirectory)
  .filter((filename) => filename.startsWith('B1.') && filename.endsWith('.json'))
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
const blocks = [];
const skippedFiles = [];
for (const filename of filenames) {
  try {
    blocks.push(parseSource(readFileSync(join(sourceDirectory, filename), 'utf8'), filename));
  } catch (error) {
    skippedFiles.push({ filename, reason: error.message });
  }
}
const indicators = blocks.map((block) => block.indicator);
const questions = blocks.flatMap((block) =>
  block.questions.map((question, index) => ({
    ...question,
    id: `english_${block.indicator.code}_q${index + 1}`,
    indicator_code: block.indicator.code,
    subject: block.indicator.subject,
    level: block.indicator.level,
    strand: block.indicator.strand,
    sub_strand: block.indicator.sub_strand,
    objective: block.indicator.objective,
  })),
);

const bank = {
  importedAt: new Date().toISOString(),
  sourceFile: 'User supplied BS1 ENGLISH indicator JSON files',
  subjects: [{ id: 'English Language', name: 'English Language' }],
  levels: [{ id: 'Basic 1', name: 'Basic 1', sequence: 1 }],
  indicators,
  questions,
};
writeFileSync(outputPath, `${JSON.stringify(bank, null, 2)}\n`);
console.log(`Imported ${blocks.length} indicators and ${questions.length} questions.`);
if (skippedFiles.length) console.log(`Skipped malformed files: ${skippedFiles.map(({ filename }) => filename).join(', ')}`);
