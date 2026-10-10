import { authenticate, json } from '../_shared/http.ts';
import { applyChanges, projectWorkspace } from '../../../src/backendAccess.ts';
import { workspaceSchema } from '../../../src/validation.ts';
import { emptyState } from '../../../src/emptyState.ts';

export const toUser = (p: any) => ({
  id: p.id,
  name: p.full_name,
  email: p.email,
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
    const { data: stored, error } = await client
      .from('school_workspace')
      .select('*')
      .eq('id', true)
      .single();
    if (error) throw error;
    const { data: profiles, error: profileError } = await client.from('profiles').select('*');
    if (profileError) throw profileError;
    const user = toUser(profile);
    let state = { ...emptyState(), ...stored.document, users: profiles.map(toUser) };
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
    if (input.action === 'save') {
      if (input.revision !== stored.revision)
        return json({ error: 'Conflict: records changed. Reload and try again.' }, 409);
      state = applyChanges(state, user, input.changes);
      state = workspaceSchema.parse(state);
      const { error: saveError } = await client.rpc('commit_workspace', {
        expected_revision: stored.revision,
        replacement: state,
        actor: profile.id,
        event: typeof input.event === 'string' ? input.event : 'School records updated',
      });
      if (saveError) throw saveError;
    } else if (input.action !== 'load') return json({ error: 'Unknown action' }, 400);
    // Re-read after save and account changes, returning a consistent current snapshot.
    const { data: current, error: readError } = await client
      .from('school_workspace')
      .select('*')
      .eq('id', true)
      .single();
    if (readError) throw readError;
    const { data: currentProfiles, error: currentProfilesError } = await client
      .from('profiles')
      .select('*');
    if (currentProfilesError) throw currentProfilesError;
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
      { error: message },
      message.includes('Conflict') ? 409 : message === 'Unauthorized' ? 401 : 400,
    );
  }
});
