import type { Snapshot, SaveResult } from './backend';
import { overlayChanges } from './saveRecovery';
// Never label a partial snapshot with a newer revision if other changes were missed.
export function mergeSaveResult(current: Snapshot, result: SaveResult): Snapshot {
  if ('state' in result) return result;
  return {
    state: overlayChanges(current.state, result.changes),
    revision: current.revision === result.baseRevision ? result.revision : current.revision,
  };
}
