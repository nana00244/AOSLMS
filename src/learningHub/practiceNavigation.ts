import { naccaIndicators } from './naccaBank';

/** Content standards can contain several indicators; route by the lesson's exact ID. */
export function getLessonPracticeIndicator(lesson: { id: string; subject: string; level: string }) {
  return naccaIndicators.find(
    (indicator) =>
      indicator.subject === lesson.subject &&
      indicator.level === lesson.level &&
      lesson.id ===
        `nacca-${indicator.subject.toLowerCase()}-${indicator.code.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
  );
}
