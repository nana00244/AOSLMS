import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadPracticeHistory, savePracticeAttempt } from './nacca/practiceHistory';

afterEach(() => vi.unstubAllGlobals());
const record = {
  id: 'offline-attempt',
  studentId: 'offline-student',
  indicatorCode: 'B1.1.1.1.1',
  subject: 'Mathematics',
  level: 'Basic 1',
  category: 'auto' as const,
  score: 100,
  correctCount: 1,
  totalCount: 1,
  questions: [],
};

describe('durable practice history', () => {
  it('does not claim a successful save when browser storage is full', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => {
        throw new DOMException('Storage full', 'QuotaExceededError');
      },
    });
    expect(() => savePracticeAttempt(record)).toThrow('Storage full');
    expect(loadPracticeHistory(record.studentId)).toEqual([]);
  });
  it('preserves unreadable history instead of replacing it with a new attempt', () => {
    const setItem = vi.fn();
    vi.stubGlobal('localStorage', { getItem: () => '{bad json', setItem });
    expect(() => savePracticeAttempt(record)).toThrow();
    expect(setItem).not.toHaveBeenCalled();
  });
  it('retrying the same attempt does not create duplicate history', () => {
    const storage = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    });
    savePracticeAttempt(record);
    savePracticeAttempt(record);
    expect(loadPracticeHistory(record.studentId)).toHaveLength(1);
  });
});
