import Papa from 'papaparse';
import type { AttendanceStatus, Student } from './data';

export const normalize = (s: string) =>
  s
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
export const nameKey = (s: string) => normalize(s).split(' ').sort().join(' ');
const months = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
];
export interface AttendanceFile {
  className: string;
  month: string;
  rows: { name: string; admission: string; marks: Record<string, AttendanceStatus> }[];
  ignoredCells: number;
}
export function parseAttendanceFile(text: string, filename: string): AttendanceFile {
  const parsed = Papa.parse<string[]>(text.replace(/^\uFEFF/, ''), { skipEmptyLines: 'greedy' });
  if (parsed.errors.length) throw new Error('The CSV is malformed. Export it again as a CSV file.');
  const headerIndex = parsed.data.findIndex((row) =>
    row.some((cell) => normalize(cell) === 'student name'),
  );
  if (headerIndex < 0) throw new Error('Could not find the Student Name column.');
  const metadata = parsed.data.slice(0, headerIndex).flat().join(' | ');
  const className =
    metadata.match(/class\s*:\s*([^|\r\n]+)/i)?.[1]?.trim() ||
    filename
      .match(
        /Register[_ -](.+?)[_ -](?:January|February|March|April|May|June|July|August|September|October|November|December)/i,
      )?.[1]
      ?.replace(/_/g, ' ') ||
    '';
  const getMonth = (source: string) => {
    const match = source.match(
      /(January|February|March|April|May|June|July|August|September|October|November|December)[\s_-]+(\d{4})/i,
    );
    return match
      ? `${match[2]}-${String(months.indexOf(match[1].toLowerCase()) + 1).padStart(2, '0')}`
      : '';
  };
  const metadataMonth = getMonth(metadata),
    filenameMonth = getMonth(filename);
  if (metadataMonth && filenameMonth && metadataMonth !== filenameMonth)
    throw new Error(
      'The file heading and filename disagree on the month. Correct the file before importing.',
    );
  const month = metadataMonth || filenameMonth;
  if (!month)
    throw new Error(
      'Include the month and year in the heading or filename, for example September 2026.',
    );
  const header = parsed.data[headerIndex];
  const nameColumn = header.findIndex((c) => normalize(c) === 'student name');
  const admissionColumn = header.findIndex((c) =>
    ['admission number', 'student id', 'admission no'].includes(normalize(c)),
  );
  const dates: { column: number; date: string }[] = [];
  header.forEach((cell, column) => {
    const label = cell.trim();
    let date = '';
    const iso = label.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const named = label.match(/^([a-z]+)\s+(\d{1,2})(?:[,\s]+(\d{4}))?$/i);
    if (iso) date = label;
    else if (
      named &&
      months.some((m) => m === named[1].toLowerCase() || m.slice(0, 3) === named[1].toLowerCase())
    ) {
      const m =
        months.findIndex(
          (m) => m === named[1].toLowerCase() || m.slice(0, 3) === named[1].toLowerCase(),
        ) + 1;
      date = `${named[3] || month.slice(0, 4)}-${String(m).padStart(2, '0')}-${named[2].padStart(2, '0')}`;
    }
    if (!date) return;
    if (
      date.slice(0, 7) !== month ||
      !Number(date.slice(-2)) ||
      new Date(`${date}T12:00:00Z`).toISOString().slice(0, 10) !== date
    )
      throw new Error(`Date column ${label} does not belong to ${month} or is invalid.`);
    if (dates.some((d) => d.date === date)) throw new Error(`Duplicate date column: ${label}.`);
    dates.push({ column, date });
  });
  if (!dates.length)
    throw new Error('No daily attendance columns found. Expected columns such as Sep 08.');
  const statuses: Record<string, AttendanceStatus> = {
    present: 'Present',
    p: 'Present',
    absent: 'Absent',
    a: 'Absent',
    late: 'Late',
    l: 'Late',
    excused: 'Excused',
    e: 'Excused',
  };
  let ignoredCells = 0;
  const rows = parsed.data
    .slice(headerIndex + 1)
    .filter((r) => r[nameColumn]?.trim())
    .map((row) => {
      const marks: Record<string, AttendanceStatus> = {};
      for (const { column, date } of dates) {
        const value = row[column]?.trim().toLowerCase();
        if (value && Object.hasOwn(statuses, value)) marks[date] = statuses[value];
        else if (value) ignoredCells++;
      }
      return { name: row[nameColumn].trim(), admission: row[admissionColumn]?.trim() || '', marks };
    });
  if (!rows.length) throw new Error('The file contains no student rows.');
  return { className, month, rows, ignoredCells };
}

export const classKey = (s: string) =>
  normalize(s)
    .replace(/^class\s+/, '')
    .replace(/^(bs|basic|primary)\s*0*(\d+)/, 'basic $2');
export function matchAttendanceClass(name: string, classes: string[]): string {
  const exact = classes.filter((c) => classKey(c) === classKey(name));
  if (exact.length === 1) return exact[0];
  const base = classKey(name);
  const candidates = base ? classes.filter((c) => classKey(c).startsWith(`${base} `)) : [];
  return candidates.length === 1 ? candidates[0] : '';
}
export function similarity(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let previous = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const old = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
      previous = old;
    }
  }
  return 1 - row[b.length] / Math.max(a.length, b.length, 1);
}
export function matchAttendanceStudents(
  file: AttendanceFile,
  students: Student[],
  classId: string,
) {
  const roster = students.filter((s) => s.classId === classId);
  const matches = file.rows.map((row) => {
    let candidates = row.admission
      ? roster.filter((s) => normalize(s.id) === normalize(row.admission))
      : [];
    let method = 'Admission number';
    if (!candidates.length) {
      candidates = roster.filter((s) => nameKey(s.name) === nameKey(row.name));
      method = 'Name';
    }
    if (!candidates.length) {
      const ranked = roster
        .map((s) => ({ student: s, score: similarity(nameKey(s.name), nameKey(row.name)) }))
        .sort((a, b) => b.score - a.score);
      if (ranked[0]?.score >= 0.9 && ranked[0].score - (ranked[1]?.score || 0) >= 0.08)
        candidates = [ranked[0].student];
      method = 'Close name match';
    }
    return {
      row,
      student: candidates.length === 1 ? candidates[0] : undefined,
      method: candidates.length === 1 ? method : 'Skipped: unmatched or ambiguous',
    };
  });
  const counts = new Map<string, number>();
  matches.forEach((m) => {
    if (m.student) counts.set(m.student.id, (counts.get(m.student.id) || 0) + 1);
  });
  return matches.map((m) =>
    m.student && counts.get(m.student.id)! > 1
      ? { ...m, student: undefined, method: 'Skipped: duplicate student rows' }
      : m,
  );
}
export function attendanceImportEntries(
  file: AttendanceFile,
  students: Student[],
  classId: string,
  term: number,
) {
  return Object.fromEntries(
    matchAttendanceStudents(file, students, classId).flatMap((m) =>
      m.student
        ? Object.entries(m.row.marks).map(([date, status]) => [
            `${date}|${term}|${m.student!.id}`,
            status,
          ])
        : [],
    ),
  ) as Record<string, AttendanceStatus>;
}

