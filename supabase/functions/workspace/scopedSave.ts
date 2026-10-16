import { emptyState } from '../../../src/emptyState.ts';
import { applyChanges, projectWorkspace } from '../../../src/backendAccess.ts';
import { isFastSave } from '../../../src/saveBatch.ts';
import { recordValue, rebaseChanges, overlayChanges } from '../../../src/saveRecovery.ts';
import { workspaceSchema } from '../../../src/validation.ts';

export async function scopedSave(client: any, profile: any, input: any) {
  const saves = input.action === 'save-batch' ? input.saves : [input];
  if (
    !Array.isArray(saves) ||
    !saves.length ||
    saves.length > 10 ||
    saves.some(
      (s) =>
        !s ||
        !isFastSave(s) ||
        s.changes.length > 2000 ||
        !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(s.operationId) ||
        s.changes.some((c: any) => typeof c.id !== 'string' || !c.id || c.id.length > 20000),
    ) ||
    new Set(saves.map((s) => s.operationId)).size !== saves.length
  )
    throw Error('Invalid save batch');
  const requested = saves.flatMap((s) => s.changes);
  const read = await client.rpc('read_workspace_save_context', {
    changes: requested.map(({ collection, id }: any) => ({ collection, id })),
  });
  if (read.error) throw read.error;
  const stored = read.data;
  const p = stored.profiles.find((p: any) => p.id === profile.id);
  if (!p?.active) throw Error('Account is inactive');
  const user = {
    ...p,
    name: p.full_name,
    classAllowedSubjects: p.class_allowed_subjects,
    studentId: p.student_id,
  };
  const initial = { ...emptyState(), ...stored.document, users: [user] };
  // SQL NULL aggregates represent empty requested maps.
  for (const c of requested) (initial as any)[c.collection] ||= {};
  const receipts = await client
    .from('workspace_save_receipts')
    .select('operation_id,revision')
    .eq('actor', profile.id)
    .in(
      'operation_id',
      saves.map((s) => s.operationId),
    );
  if (receipts.error) throw receipts.error;
  if (receipts.data.some((r: any) => r.revision > stored.revision))
    throw Error('Conflict: records changed. Reload and try again.');
  const confirmed = new Set(receipts.data.map((r: any) => r.operation_id));
  const remaining = saves.filter((s) => !confirmed.has(s.operationId));
  let state = initial;
  for (const save of remaining)
    state = workspaceSchema.parse(applyChanges(state, user, rebaseChanges(state, save.changes)));
  const touched = [
    ...new Map(requested.map((c: any) => [JSON.stringify([c.collection, c.id]), c])).values(),
  ] as any[];
  const delta = touched
    .map((c) => ({
      collection: c.collection,
      id: c.id,
      before: recordValue(initial, c),
      after: recordValue(state, c),
    }))
    .filter((c) => JSON.stringify(c.before) !== JSON.stringify(c.after));
  state = overlayChanges(initial, delta);
  let revision = stored.revision;
  if (remaining.length) {
    const commit = await client.rpc('commit_workspace_maps_once', {
      expected_revision: stored.revision,
      changes: delta,
      actor: profile.id,
      operations: remaining.map((s) => ({
        id: s.operationId,
        event: typeof s.event === 'string' ? s.event : 'School records updated',
      })),
    });
    if (commit.error) throw commit.error;
    if (commit.data.alreadyApplied) throw Error('Conflict: records changed. Reload and try again.');
    revision = commit.data.revision;
  }
  const visible = projectWorkspace(state, user);
  return {
    confirmed: true,
    revision,
    baseRevision: stored.revision,
    changes: touched.map((c) => ({
      collection: c.collection,
      id: c.id,
      after: recordValue(visible, c),
    })),
  };
}
