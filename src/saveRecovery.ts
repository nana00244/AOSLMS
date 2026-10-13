import type { Change } from './backendAccess.ts';
import type { State } from './data.ts';

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
/** Three-way merge. Disjoint edits merge; competing edits to the same field never silently win. */
export function mergeSavedValue(
  before: unknown,
  after: unknown,
  current: unknown,
  path: string,
  keepLocal = false,
): unknown {
  if (same(before, after) || same(after, current)) return current;
  if (same(before, current)) return after;
  if (object(before) && object(after) && object(current)) {
    const result = { ...current };
    for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
      if (['__proto__', 'prototype', 'constructor'].includes(key))
        throw new Error('Invalid record key');
      const value = mergeSavedValue(
        before[key],
        after[key],
        current[key],
        `${path}.${key}`,
        keepLocal,
      );
      if (value === undefined) delete result[key];
      else result[key] = value;
    }
    return result;
  }
  if (keepLocal) return after;
  throw new Error(
    `Conflict: ${path} was also changed by another save. Your pending entry is retained for review.`,
  );
}
export function recordValue(state: State, change: Change): any {
  const value = (state as any)[change.collection];
  if (['settings', 'classes', 'version'].includes(change.collection)) return value;
  if (Array.isArray(value))
    return value.find((v: any) => (typeof v === 'string' ? v : v.id) === change.id);
  return value?.[change.id];
}
export function rebaseChanges(state: State, changes: Change[]): Change[] {
  return changes.flatMap((change) => {
    const before = recordValue(state, change);
    const after = mergeSavedValue(
      change.before,
      change.after,
      before,
      `${change.collection}/${change.id}`,
    );
    return same(before, after) ? [] : [{ ...change, before, after }];
  });
}
/** Display the user's retained edits while offline; server authorization still runs on every retry. */
export function overlayChanges(state: State, changes: Change[]): State {
  const next = { ...state } as any;
  for (const { collection, id, after } of changes) {
    if (['__proto__', 'prototype', 'constructor', 'users', 'logs', 'version'].includes(collection))
      continue;
    const value = next[collection];
    if (['settings', 'classes'].includes(collection)) next[collection] = after;
    else if (Array.isArray(value))
      next[collection] = [
        ...value.filter((v: any) => (typeof v === 'string' ? v : v.id) !== id),
        ...(after === undefined ? [] : [after]),
      ];
    else {
      next[collection] = { ...value };
      if (after === undefined) delete next[collection][id];
      else next[collection][id] = after;
    }
  }
  return next;
}
