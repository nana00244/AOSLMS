import { indicatorLessonId } from './indicatorLessonId';
import { naccaIndicators } from './naccaBank';
import { basicTwoEnglishLessons } from './englishBank';

/** Content standards can contain several indicators; route by the lesson's exact ID. */
export function getLessonPracticeIndicator(lesson: { id: string; subject: string; level: string }) {
  return (
    naccaIndicators.find(
      (indicator) =>
        indicator.subject === lesson.subject &&
        indicator.level === lesson.level &&
        lesson.id === indicatorLessonId(indicator.subject, indicator.code),
    ) ??
    naccaIndicators.find(
      (indicator) =>
        indicator.subject === lesson.subject &&
        indicator.code ===
          basicTwoEnglishLessons.find((candidate) => candidate.id === lesson.id)?.standard,
    )
  );
}
