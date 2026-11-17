import { readFileSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { hubLessons } from '../src/learningHub/catalog.ts';
import { computingIndicators, computingQuestions } from '../src/learningHub/computingBank.ts';

// Keep the Edge Function upload within the API size limit. Copy only the
// question fields used to authorize the lesson and grade adaptive answers.
const bank = JSON.parse(readFileSync('src/nacca/importedBank.json', 'utf8'));
const questions = [...bank.questions, ...computingQuestions].filter(q => ['mcq', 'numeric', 'short_answer'].includes(q.type)).map(q => ({
  id: q.id, indicator_code: q.indicator_code, subject: q.subject, type: q.type, answer: q.answer,
  ...(q.type === 'short_answer' ? { stem: q.stem } : {}),
  ...(q.type === 'mcq' ? { optionCount: q.options.length } : {}),
}));
const indicators = [...bank.indicators, ...computingIndicators].map(({ code, subject }) => ({ code, subject }));
writeFileSync('supabase/functions/learning-hub/adaptive-bank.json', JSON.stringify({ indicators, questions }) + '\n');

// Ship the existing lesson API payload without uploading all five English authoring banks.
const catalog = gzipSync(JSON.stringify(hubLessons), { level: 9 }).toString('base64');
writeFileSync('supabase/functions/learning-hub/lesson-catalog.json', JSON.stringify(catalog) + '\n');
