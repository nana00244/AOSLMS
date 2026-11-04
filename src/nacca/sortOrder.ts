import type { NaccaIndicator, NaccaQuestion } from './types';

/**
 * Extracts the integer level rank (e.g. 'Basic 1' -> 1, 'Basic 4' -> 4, 'B2' -> 2).
 */
export function getLevelRank(levelStr: string): number {
  const m = String(levelStr || '').match(/\d+/);
  return m ? parseInt(m[0], 10) : 99;
}

/**
 * Normalizes and extracts numeric components from an indicator code (e.g. 'B1.1.1.1.1' -> [1, 1, 1, 1, 1]).
 * Normalizes 'BI.' to 'B1.' as well.
 */
export function parseCodeNumbers(codeStr: string): number[] {
  const c = (codeStr || '').replace(/^BI\./i, 'B1.').replace(/\s+/g, '');
  const parts = c.split('.');
  const res: number[] = [];
  for (const p of parts) {
    const m = p.match(/\d+/);
    if (m) res.push(parseInt(m[0], 10));
  }
  return res;
}

/**
 * Canonical comparator to order indicators in ascending curriculum order:
 * 1. Subject alphabetical order
 * 2. Level ascending (Basic 1 < Basic 2 < Basic 3 < Basic 4)
 * 3. Curriculum source page ascending (Page 23 < Page 39)
 * 4. Indicator code numbers ascending (1.1.1.1 < 1.4.1.1)
 * 5. Deterministic string locale comparison
 */
export function compareIndicators(a: NaccaIndicator, b: NaccaIndicator): number {
  // 1. Subject order
  const subjA = (a.subject || 'Mathematics').trim();
  const subjB = (b.subject || 'Mathematics').trim();
  if (subjA !== subjB) {
    return subjA.localeCompare(subjB);
  }

  // 2. Level order (Basic 1 < Basic 2 < Basic 3 < Basic 4)
  const lvlA = getLevelRank(a.level);
  const lvlB = getLevelRank(b.level);
  if (lvlA !== lvlB) {
    return lvlA - lvlB;
  }

  // 3. Source page (exact curriculum sequence in NaCCA syllabus)
  const pageA = a.source_page || 0;
  const pageB = b.source_page || 0;
  if (pageA && pageB && pageA !== pageB) {
    return pageA - pageB;
  }

  // 4. Numeric breakdown of the code e.g. [1, 1, 1, 1, 1] vs [1, 4, 1, 1, 1]
  const numsA = parseCodeNumbers(a.code);
  const numsB = parseCodeNumbers(b.code);
  const maxLen = Math.max(numsA.length, numsB.length);
  for (let i = 0; i < maxLen; i++) {
    const valA = numsA[i] ?? 0;
    const valB = numsB[i] ?? 0;
    if (valA !== valB) {
      return valA - valB;
    }
  }

  // 5. Fallback alphanumeric
  return a.code.localeCompare(b.code);
}

/**
 * Returns a new array with indicators sorted in ascending curriculum order.
 */
export function sortIndicators<T extends NaccaIndicator>(list: T[]): T[] {
  return [...list].sort(compareIndicators);
}

/**
 * Sorts questions in ascending curriculum order based on their indicator sequence and level.
 */
export function sortQuestions<T extends NaccaQuestion>(
  questions: T[],
  sortedIndicators?: NaccaIndicator[],
): T[] {
  const indicatorOrderMap = new Map<string, number>();
  if (sortedIndicators) {
    sortedIndicators.forEach((ind, idx) => {
      indicatorOrderMap.set(`${ind.subject}:${ind.code}`, idx);
      indicatorOrderMap.set(ind.code, idx);
    });
  }

  return [...questions].sort((qA, qB) => {
    if (qA.subject !== qB.subject) {
      return (qA.subject || '').localeCompare(qB.subject || '');
    }
    if (qA.level !== qB.level) {
      return getLevelRank(qA.level) - getLevelRank(qB.level);
    }
    if (sortedIndicators && indicatorOrderMap.size > 0) {
      const idxA =
        indicatorOrderMap.get(`${qA.subject}:${qA.indicator_code}`) ??
        indicatorOrderMap.get(qA.indicator_code) ??
        9999;
      const idxB =
        indicatorOrderMap.get(`${qB.subject}:${qB.indicator_code}`) ??
        indicatorOrderMap.get(qB.indicator_code) ??
        9999;
      if (idxA !== idxB) return idxA - idxB;
    }
    // Secondary sort by question id (q1, q2, ...)
    const numA = parseInt(qA.id.replace(/\D/g, ''), 10) || 0;
    const numB = parseInt(qB.id.replace(/\D/g, ''), 10) || 0;
    if (numA !== numB) return numA - numB;
    return qA.id.localeCompare(qB.id);
  });
}
