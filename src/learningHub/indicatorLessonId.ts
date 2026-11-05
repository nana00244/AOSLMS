export function indicatorLessonId(subject: string, code: string) {
  return `nacca-${subject.toLowerCase()}-${code.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
}
