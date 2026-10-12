import Papa from 'papaparse';
import {
  courseworkCategory,
  courseworkCategoryConfigs,
  type CourseworkCategoryKey,
  type FeedbackType,
} from './data';
import { scoreNameKey, type ScoreSheet, type ScoreCell } from './scoreImport';

export function parseScoreCsv(text: string): ScoreSheet {
  const result = Papa.parse<string[]>(text.replace(/^\uFEFF/, ''), { skipEmptyLines: 'greedy' });
  if (result.errors.length) throw new Error('The CSV is malformed. Export it again as CSV.');
  return parseScoreRows(result.data);
}
export function parseScoreRows(rows: unknown[][]): ScoreSheet {
  const data = rows.map((row) => row.map((c) => String(c ?? '').trim()));
  const headerIndex = data.findIndex((row) => row.some((c) => scoreNameKey(c) === 'student name'));
  if (headerIndex < 0) throw new Error('Missing Student Name column');
  const metadata = (label: string) => {
    const values = data
      .slice(0, headerIndex)
      .flatMap((row) =>
        row.flatMap((c, i) => (scoreNameKey(c) === label ? [row[i + 1] || ''] : [])),
      );
    if (new Set(values).size > 1) throw new Error(`Conflicting ${label} headings`);
    return values[0] || '';
  };
  const subject = metadata('subject'),
    className = metadata('class');
  const categoryLabel = metadata('assessment category');
  const category = courseworkCategory(categoryLabel)?.toLowerCase() as
    CourseworkCategoryKey | undefined;
  const termLabel = metadata('term');
  const term = Number(termLabel.match(/^(?:term\s*)?([1-3])$/i)?.[1]);
  if (!subject || !className || !category || !term)
    throw new Error(
      'Include Subject, Class, Assessment Category and Term headings, as in the exported score sheet',
    );
  const config = courseworkCategoryConfigs[category];
  const header = data[headerIndex];
  const nameColumn = header.findIndex((c) => scoreNameKey(c) === 'student name');
  const idColumn = header.findIndex((c) =>
    ['admission number', 'admission no', 'student id'].includes(scoreNameKey(c)),
  );
  const columns: { index: number; slotKey: string; maxPoints: number }[] = [];
  header.forEach((label, index) => {
    const match = label.match(
      /^(EXE\d+|HW\d+|GW\d+|Quiz\d+|PW\d+|Exam(?:1)?)\s*\(\s*\/\s*(\d+(?:\.\d+)?)\s*\)$/i,
    );
    if (!match) {
      if (/^(EXE|HW|GW|Quiz|PW|Exam)\d*/i.test(label))
        throw new Error(`Invalid score column: ${label}`);
      return;
    }
    const number = Number(match[1].match(/\d+$/)?.[0] || 1);
    if (
      !match[1].toLowerCase().startsWith(config.prefix.toLowerCase()) ||
      number < 1 ||
      number > config.slotCount
    )
      throw new Error(`Column ${label} does not match ${categoryLabel}`);
    const slotKey = category === 'exam' ? 'Exam' : `${config.prefix}${number}`;
    const maxPoints = Number(match[2]);
    if (maxPoints <= 0 || maxPoints > 10000 || columns.some((c) => c.slotKey === slotKey))
      throw new Error(`Invalid maximum or duplicate column: ${label}`);
    columns.push({ index, slotKey, maxPoints });
  });
  if (!columns.length) throw new Error('No assessment columns found (for example EXE1 (/15))');
  const parsed = data
    .slice(headerIndex + 1)
    .filter((row) => row.some(Boolean))
    .map((row, index) => {
      const name = row[nameColumn] || '',
        admission = row[idColumn] || '';
      if (!name && !admission)
        throw new Error(`Missing student identity on row ${headerIndex + index + 2}`);
      const cells: ScoreCell[] = columns.flatMap((column) => {
        const raw = row[column.index] || '';
        if (!raw) return [];
        const match = raw.match(/^(?:(\d+(?:\.\d+)?)\s*)?(?:\[(ABS|DNS|LATE|OK)\])?$/i);
        if (!match || (!match[1] && !match[2]))
          throw new Error(`Invalid score "${raw}" for ${name}, ${column.slotKey}`);
        const score = match[1] === undefined ? null : Number(match[1]);
        const feedbackTypes: Record<string, FeedbackType> = {
          ABS: 'absent',
          DNS: 'not_submitted',
          LATE: 'late',
          OK: 'none',
        };
        const feedbackType = feedbackTypes[match[2]?.toUpperCase()] || 'none';
        if (
          (score !== null && score > column.maxPoints) ||
          (score === null && feedbackType === 'none')
        )
          throw new Error(`Score out of range for ${name}, ${column.slotKey}`);
        return [{ slotKey: column.slotKey, maxPoints: column.maxPoints, score, feedbackType }];
      });
      return { name, admission, cells };
    });
  if (!parsed.some((row) => row.cells.length))
    throw new Error('The sheet contains no scores or feedback');
  if (parsed.length > 2000) throw new Error('Upload at most 2,000 students at a time');
  return { subject, className, category, term, rows: parsed };
}
