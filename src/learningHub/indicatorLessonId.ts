// Saved lessons retain the IDs assigned by the original curriculum imports.
const previousRmeCodes: Record<string, string> = {
  'B1.4.1.1.1': 'B1.4.1.1',
  'B5.1.1.1.2': 'B5.1.1.2.2',
  'B6.5.2.1.1': 'B6.5.1.1.3',
};

const previousArtsCodes: Record<string, string> = {
  'B1.1.1.1.1': 'B1.1.1.1',
  'B1.1.1.1.2': 'B1.1.1.2',
  'B1.1.1.1.3': 'B1.1.1.3',
  'B1.1.1.1.4': 'B1.1.1.4',
  'B1.1.2.2.1': 'B1.2.2.1',
  'B1.1.2.2.2': 'B1.2.2.2',
  'B1.1.2.2.3': 'B1.2.2.3',
  'B1.1.2.2.4': 'B1.2.2.4',
  'B1.1.2.3.1': 'B1.2.3.1',
  'B1.1.2.3.2': 'B1.2.3.2',
  'B1.1.2.3.3': 'B1.2.3.3',
  'B2.1.1.1.1': 'B2.1.1.1',
  'B2.1.1.1.2': 'B2.1.1.2',
  'B2.1.1.1.3': 'B2.1.1.3',
  'B2.1.1.1.4': 'B2.1.1.4',
  'B2.1.2.2.1': 'B2.2.2.1',
  'B2.1.2.2.2': 'B2.2.2.2',
  'B2.2.2.2.3': 'B2.2.2.3',
  'B2.2.2.2.4': 'B2.2.2.4',
  'B2.2.2.3.1': 'B2.2.3.1',
  'B2.2.3.5.1': 'B2.3.5.1',
  'B2.1.4.6.1': 'B2.4.6.1',
  'B3.1.1.1.1': 'B3.VA.1*',
  'B3.1.1.1.3': 'B3.VA.2*',
  'B3.1.2.2.1': 'B3.VA.3*',
  'B3.1.2.3.3': 'B3.VA.4*',
  'B3.2.1.1.1': 'B3.PA.1*',
  'B3.2.2.2.1': 'B3.PA.2*',
  'B3.2.2.3.3': 'B3.PA.3*',
  'B3.2.3.5.1': 'B3.PA.4*',
  'B3.1.3.4.1': 'B3.VA.5*',
  'B3.2.3.4.1': 'B3.PA.5*',
  'B3.1.4.7.1': 'B3.VA.6*',
  'B3.2.4.7.1': 'B3.PA.6*',
  'B4.2.4.7.2 (Topical issues)': 'B4.2.4.7.3',
};

function previousCodes(subject: string | null): Record<string, string> | undefined {
  if (subject === 'Creative Arts') return previousArtsCodes;
  if (subject === 'Religious and Moral Education') return previousRmeCodes;
}

export function currentPracticeCode(subject: string | null, code: string | null) {
  const previous = previousCodes(subject);
  if (!previous || !code) return code;
  return Object.keys(previous).find((key) => previous[key] === code) ?? code;
}

export function indicatorLessonId(subject: string, code: string) {
  code = previousCodes(subject)?.[code] ?? code;
  return `nacca-${subject.toLowerCase()}-${code.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
}
