/** Calendar-only UTC checks avoid device timezone/DST changing the school day. */
export function isWeekday(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(`${date}T12:00:00Z`);
  return (
    Number.isFinite(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === date &&
    parsed.getUTCDay() !== 0 &&
    parsed.getUTCDay() !== 6
  );
}
export function schoolDaysInMonth(month: string): string[] {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return [];
  return Array.from({ length: 31 }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`).filter(
    isWeekday,
  );
}
export function previousSchoolDay(date: string): string {
  const day = new Date(`${date}T12:00:00Z`);
  if (!Number.isFinite(day.getTime())) throw Error('Invalid attendance date');
  while (!isWeekday(day.toISOString().slice(0, 10))) day.setUTCDate(day.getUTCDate() - 1);
  return day.toISOString().slice(0, 10);
}
export const isSchoolAttendanceKey = (key: string) => isWeekday(key.split('|')[0]);
