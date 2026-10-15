import type { PendingSave } from './pendingSaves.ts';
import type { State, User } from './data.ts';
import { rebaseChanges } from './saveRecovery.ts';
import { applyChanges } from './backendAccess.ts';
import { applyScoreImport } from './scoreImport.ts';
import { workspaceSchema } from './validation.ts';

export const recoveryFileLimit = 20 * 1024 * 1024;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function parsePendingRecovery(text: string, owner: string): PendingSave[] {
  if (new TextEncoder().encode(text).length > recoveryFileLimit)
    throw Error('Choose a pending-entry file smaller than 20 MB.');
  const value = JSON.parse(text, (key, value) => {
    if (['__proto__', 'prototype', 'constructor'].includes(key))
      throw Error('Unsafe record key in file.');
    return value;
  });
  if (!Array.isArray(value) || !value.length || value.length > 100)
    throw Error(
      'Choose a pending-school-saves.json file containing 1–100 saves, not a workspace backup.',
    );
  const ids = new Set<string>();
  for (const save of value) {
    if (
      !save ||
      typeof save !== 'object' ||
      typeof save.id !== 'string' ||
      !uuid.test(save.id) ||
      ids.has(save.id) ||
      typeof save.createdAt !== 'string' ||
      !Number.isFinite(Date.parse(save.createdAt)) ||
      !Array.isArray(save.changes) ||
      save.changes.length > 10000 ||
      save.changes.some(
        (c: any) => !c || typeof c.collection !== 'string' || typeof c.id !== 'string',
      ) ||
      (save.event !== undefined && typeof save.event !== 'string') ||
      (save.conflict !== undefined && typeof save.conflict !== 'string')
    )
      throw Error('The pending-entry file contains invalid or duplicate saves.');
    if (save.owner !== owner)
      throw Error(
        'This file belongs to another account. Sign in with the account that downloaded it.',
      );
    ids.add(save.id);
  }
  return value.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}
export interface RecoveryRow {
  id: string;
  status: 'ready' | 'confirmed' | 'conflict' | 'blocked';
  reason: string;
}
export function previewPendingRecovery(
  state: State,
  user: User,
  saves: PendingSave[],
  confirmed: Set<string>,
): RecoveryRow[] {
  let next = state;
  let blocked = false;
  return saves.map((save) => {
    if (confirmed.has(save.id))
      return {
        id: save.id,
        status: 'confirmed',
        reason: 'Already confirmed by the database; will be skipped.',
      };
    if (blocked)
      return {
        id: save.id,
        status: 'blocked',
        reason:
          'Review the earlier conflicting or invalid save first, then preview this file again.',
      };
    try {
      const changes = rebaseChanges(next, save.changes);
      next = workspaceSchema.parse(
        save.scoreRequest
          ? applyScoreImport(next, user, save.scoreRequest)
          : applyChanges(next, user, changes),
      ) as State;
      return {
        id: save.id,
        status: 'ready',
        reason: 'Ownership, permissions and database values checked.',
      };
    } catch (error) {
      blocked = true;
      const reason = error instanceof Error ? error.message : 'Unable to validate this save.';
      return {
        id: save.id,
        status: reason.startsWith('Conflict:') ? 'conflict' : 'blocked',
        reason,
      };
    }
  });
}
