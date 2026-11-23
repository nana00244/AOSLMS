// Saved assignments and question references use the codes from the first RME import.
const previousRmeCodes: Record<string, string> = {
  'B1.4.1.1.1': 'B1.4.1.1',
  'B5.1.1.1.2': 'B5.1.1.2.2',
  'B6.5.2.1.1': 'B6.5.1.1.3',
};

export function currentPracticeCode(subject: string | null, code: string | null) {
  if (subject !== 'Religious and Moral Education' || !code) return code;
  return Object.keys(previousRmeCodes).find((key) => previousRmeCodes[key] === code) ?? code;
}

export function indicatorLessonId(subject: string, code: string) {
  if (subject === 'Religious and Moral Education') code = previousRmeCodes[code] ?? code;
  return `nacca-${subject.toLowerCase()}-${code.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
}
