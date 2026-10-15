import { authenticate, json } from '../_shared/http.ts';
import { applyChanges, projectWorkspace } from '../../../src/backendAccess.ts';
import { workspaceSchema } from '../../../src/validation.ts';
import { emptyState } from '../../../src/emptyState.ts';
import { applyScoreImport } from '../../../src/scoreImport.ts';
import { parsePendingRecovery, previewPendingRecovery } from '../../../src/pendingRecovery.ts';
import { isFastSave } from '../../../src/saveBatch.ts';
import { rebaseChanges, recordValue, overlayChanges } from '../../../src/saveRecovery.ts';

export const toUser = (p: any) => ({
  id: p.id,
  name: p.full_name,
  email: p.email,
  ...(p.username ? { username: p.username } : {}),
  role: p.role,
  active: p.active,
  classes: p.classes,
  classAllowedSubjects: p.class_allowed_subjects,
  ...(p.student_id ? { studentId: p.student_id } : {}),
});

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return json({});
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const { client, profile } = await authenticate(request);
    const input = await request.json();
    if (
      ![
        'load',
        'preview-recovery',
        'save-batch',
        'save-pending',
        'save',
        'import-scores',
        'file-url',
      ].includes(input.action)
    )
      return json({ error: 'Unknown action' }, 400);
    const requestWasSave = ['save-batch', 'save-pending', 'save', 'import-scores'].includes(
      input.action,
    );
    const readSnapshot = async (knownRevision: number | null = null) => {
      const { data, error } = await client.rpc('read_workspace_snapshot', {
        known_revision: knownRevision,
      });
      if (error) throw error;
      if (!data) throw new Error('School workspace is unavailable');
      return data;
    };
    const stored = await readSnapshot(
      input.action === 'load' &&
        Number.isSafeInteger(input.knownRevision) &&
        input.knownRevision >= 0
        ? input.knownRevision
        : null,
    );
    if (stored.unchanged) return json({ unchanged: true, revision: stored.revision });
    const profiles = stored.profiles;
    const snapshotProfile = profiles.find((p: any) => p.id === profile.id);
    if (!snapshotProfile?.active) return json({ error: 'Account is inactive' }, 403);
    const user = toUser(snapshotProfile);
    let state = { ...emptyState(), ...stored.document, users: profiles.map(toUser) };
    if (input.action === 'preview-recovery') {
      const saves = parsePendingRecovery(JSON.stringify(input.saves), profile.id);
      const receipts = await client
        .from('workspace_save_receipts')
        .select('operation_id,revision')
        .eq('actor', profile.id)
        .in(
          'operation_id',
          saves.map((save) => save.id),
        );
      if (receipts.error) throw receipts.error;
      if (receipts.data.some((r: any) => Number(r.revision) > stored.revision))
        throw new Error('Records changed while checking the file. Preview it again.');
      return json({
        rows: previewPendingRecovery(
          state,
          user,
          saves,
          new Set(receipts.data.map((r: any) => r.operation_id)),
        ),
        revision: stored.revision,
      });
    }
    let savedSnapshot: any;
    if (input.action === 'save-batch' || (input.action === 'save-pending' && isFastSave(input))) {
      const saves = input.action === 'save-batch' ? input.saves : [input];
      if (
        !Array.isArray(saves) ||
        saves.length < 1 ||
        saves.length > 10 ||
        saves.some(
          (save: any) =>
            !save ||
            !isFastSave(save) ||
            save.changes.length > 10000 ||
            typeof save.operationId !== 'string' ||
            !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
              save.operationId,
            ),
        ) ||
        new Set(saves.map((save: any) => save.operationId)).size !== saves.length
      )
        throw new Error('Invalid save batch');
      const receipts = await client
        .from('workspace_save_receipts')
        .select('operation_id,revision')
        .eq('actor', profile.id)
        .in(
          'operation_id',
          saves.map((save: any) => save.operationId),
        );
      if (receipts.error) throw receipts.error;
      if (receipts.data.some((r: any) => Number(r.revision) > stored.revision))
        throw new Error('Conflict: records changed. Reload and try again.');
      const completed = new Set(receipts.data.map((r: any) => r.operation_id));
      const remaining = saves.filter((save: any) => !completed.has(save.operationId));
      const initial = state;
      for (const save of remaining)
        state = workspaceSchema.parse(
          applyChanges(state, user, rebaseChanges(state, save.changes)),
        );
      if (remaining.length) {
        // Only explicitly edited keys are written; schema normalization must not
        // rewrite unrelated records as a side effect of a small edit.
        const touched = new Map<string, any>();
        for (const save of remaining)
          for (const change of save.changes)
            touched.set(JSON.stringify([change.collection, change.id]), change);
        const changes = [...touched.values()]
          .map((change) => ({
            collection: change.collection,
            id: change.id,
            before: recordValue(initial, change),
            after: recordValue(state, change),
          }))
          .filter((change) => JSON.stringify(change.before) !== JSON.stringify(change.after));
        state = overlayChanges(initial, changes);
        const committed = await client.rpc('commit_workspace_maps_once', {
          expected_revision: stored.revision,
          changes,
          actor: profile.id,
          operations: remaining.map((save: any) => ({
            id: save.operationId,
            event: typeof save.event === 'string' ? save.event : 'School records updated',
          })),
        });
        if (committed.error) throw committed.error;
        // CAS guarantees state is the snapshot we committed. A duplicate receipt race
        // needs a fresh read because another request may have committed different work.
        if (!committed.data.alreadyApplied)
          savedSnapshot = { ...stored, document: state, revision: committed.data.revision };
      } else {
        // All receipts are at or before the snapshot revision checked above.
        savedSnapshot = stored;
      }
      input.action = 'load';
    }
    if (input.action === 'save-pending') {
      if (typeof input.operationId !== 'string' || !/^[0-9a-f-]{36}$/i.test(input.operationId))
        throw new Error('Invalid save identifier');
      const receipt = await client
        .from('workspace_save_receipts')
        .select('revision')
        .eq('actor', profile.id)
        .eq('operation_id', input.operationId)
        .maybeSingle();
      if (receipt.error) throw receipt.error;
      if (!receipt.data) {
        if (!Array.isArray(input.changes) || input.changes.length > 10000)
          throw new Error('Invalid change set');
        const changes = rebaseChanges(state, input.changes);
        state = input.scoreRequest
          ? applyScoreImport(state, user, input.scoreRequest)
          : applyChanges(state, user, changes);
        state = workspaceSchema.parse(state);
        const committed = await client.rpc('commit_workspace_once', {
          expected_revision: stored.revision,
          replacement: state,
          actor: profile.id,
          event: typeof input.event === 'string' ? input.event : 'School records updated',
          operation_id: input.operationId,
        });
        if (committed.error) throw committed.error;
      }
      input.action = 'load';
    }
    if (input.action === 'file-url') {
      const visible = projectWorkspace(state, user);
      const record = [...visible.resources, ...visible.submissions].find(
        (r) => r.storagePath === input.path,
      );
      if (!record) return json({ error: 'File is not available to your account' }, 403);
      const { data: signed, error: signedError } = await client.storage
        .from('learning-files')
        .createSignedUrl(input.path, 60, { download: record.filename || true });
      if (signedError) throw signedError;
      return json({ url: signed.signedUrl });
    }
    if (input.action === 'save' || input.action === 'import-scores') {
      if (input.revision !== stored.revision)
        return json({ error: 'Conflict: records changed. Reload and try again.' }, 409);
      state =
        input.action === 'import-scores'
          ? applyScoreImport(state, user, input.request)
          : applyChanges(state, user, input.changes);
      state = workspaceSchema.parse(state);
      const { error: saveError } = await client.rpc('commit_workspace', {
        expected_revision: stored.revision,
        replacement: state,
        actor: profile.id,
        event:
          input.action === 'import-scores'
            ? `Assessment upload: ${input.request.classId}, ${input.request.subject}, ${input.request.sheet.category}, term ${input.request.sheet.term}`
            : typeof input.event === 'string'
              ? input.event
              : 'School records updated',
      });
      if (saveError) throw saveError;
    } else if (input.action !== 'load') return json({ error: 'Unknown action' }, 400);
    // Loads reuse the snapshot already read. Only writes need a post-commit read.
    const current = savedSnapshot || (requestWasSave ? await readSnapshot() : stored);
    const currentProfiles = current.profiles;
    const currentUser = currentProfiles.find((p: any) => p.id === profile.id);
    if (!currentUser?.active) return json({ error: 'Account is inactive' }, 403);
    state = { ...emptyState(), ...current.document, users: currentProfiles.map(toUser), logs: [] };
    if (currentUser.role === 'Administrator') {
      const { data: logs, error: logError } = await client
        .from('audit_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1000);
      if (logError) throw logError;
      state.logs = logs.map((l: any) => ({
        id: String(l.id),
        action: l.action,
        actor: state.users.find((u: any) => u.id === l.actor_id)?.name || 'System',
        date: l.created_at,
        type: 'Server',
      }));
    }
    return json({
      state: projectWorkspace(state, toUser(currentUser)),
      revision: current.revision,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : (error as any)?.message || 'Workspace request failed';
    return json(
      { error: message, code: (error as any)?.code },
      message.includes('Conflict')
        ? 409
        : message === 'Unauthorized'
          ? 401
          : ['57014', '55P03', '53300'].includes((error as any)?.code)
            ? 503
            : 400,
    );
  }
});
