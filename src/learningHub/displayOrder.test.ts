import { describe, expect, it } from 'vitest';
import {
  compareHubCourseGroups,
  compareHubLevels,
  compareHubSubjects,
  displayHubLevel,
} from './displayOrder';

describe('Learning Hub curriculum display order', () => {
  it('places English, Mathematics and Science before other subjects', () => {
    expect(
      ['Science', 'History', 'Mathematics', 'English Language'].sort(compareHubSubjects),
    ).toEqual(['English Language', 'Mathematics', 'Science', 'History']);
  });

  it('shows Basic levels first in numeric order and normalizes shorthand labels', () => {
    expect(
      ['Basic 6', 'KG1', 'B4', 'Basic 1', 'B3', 'Basic 2', 'JHS 1'].sort(compareHubLevels),
    ).toEqual(['Basic 1', 'Basic 2', 'B3', 'B4', 'Basic 6', 'KG1', 'JHS 1']);
    expect(['B2', 'B3', 'B4'].map(displayHubLevel)).toEqual(['Basic 2', 'Basic 3', 'Basic 4']);
    expect(displayHubLevel('B7')).toBe('B7 · JHS 1');
  });

  it('keeps all primary course groups before JHS, ordered by level then subject', () => {
    expect(
      [
        'B7|Science',
        'Basic 1|Mathematics',
        'B2|English Language',
        'Basic 1|English Language',
        'Basic 6|Science',
        'B7|Mathematics',
      ].sort(compareHubCourseGroups),
    ).toEqual([
      'Basic 1|English Language',
      'Basic 1|Mathematics',
      'B2|English Language',
      'Basic 6|Science',
      'B7|Mathematics',
      'B7|Science',
    ]);
  });
});
