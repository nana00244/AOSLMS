import { indicatorLessonId } from './indicatorLessonId';
import { hubLessons } from './catalog';
import { naccaIndicators } from './naccaBank';
import {
  basicFiveEnglishLessons,
  basicFourEnglishLessons,
  basicThreeEnglishLessons,
  basicTwoEnglishLessons,
} from './englishBank';

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
          (
            [
              ...basicTwoEnglishLessons,
              ...basicThreeEnglishLessons,
              ...basicFourEnglishLessons,
              ...basicFiveEnglishLessons,
            ].find((candidate) => candidate.id === lesson.id) ??
            hubLessons.find((candidate) => candidate.id === lesson.id)
          )?.standard,
    )
  );
}
