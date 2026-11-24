import { supabase } from './supabase';
import type { State } from './data';
import { changesBetween } from './backendAccess';
import type { ScoreImportRequest } from './scoreImport';
import type { PendingSave } from './pendingSaves';

export class BackendError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export const isAccessDenied = (error: unknown) =>
  error instanceof BackendError && (error.status === 401 || error.status === 403);

export async function invokeBackend(name: string, body: unknown, expectedOwner?: string) {
  if (!supabase) throw new Error('Supabase is not configured');
  if (typeof navigator !== 'undefined' && navigator.onLine === false)
    throw new Error('Offline: this action needs an internet connection.');
  let headers: Record<string, string> | undefined;
  if (expectedOwner) {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    if (!data.session || data.session.user.id !== expectedOwner)
      throw new BackendError('Sign in with the account that created these pending entries.', 401);
    headers = { Authorization: `Bearer ${data.session.access_token}` };
  }
  const { data, error } = await supabase.functions.invoke(name, {
    body: body as Record<string, unknown>,
    headers,
    signal: AbortSignal.timeout(60000),
  });
  if (error) {
    if (error.context instanceof Response) {
      const detail = await error.context.json().catch(() => null);
      throw new BackendError(
        detail?.error || `Request failed (${error.context.status})`,
        error.context.status,
      );
    }
    throw error;
  }
  if (data?.error) throw new Error(data.error);
  return data;
}
export interface Snapshot {
  state: State;
  revision: number;
}
export interface SaveAcknowledgement {
  confirmed: true;
  revision: number;
  baseRevision: number;
  changes: import('./backendAccess').Change[];
}
export type SaveResult = Snapshot | SaveAcknowledgement;
export function loadWorkspace(): Promise<Snapshot>;
export function loadWorkspace(
  knownRevision: number | undefined,
): Promise<Snapshot | { unchanged: true; revision: number }>;
export function loadWorkspace(
  knownRevision?: number,
): Promise<Snapshot | { unchanged: true; revision: number }> {
  return invokeBackend('workspace', { action: 'load', knownRevision });
}
export const commitPendingSave = (save: PendingSave): Promise<SaveResult> =>
  invokeBackend(
    'workspace',
    {
      action: 'save-pending',
      response: 'ack',
      operationId: save.id,
      changes: save.changes,
      event: save.event,
      scoreRequest: save.scoreRequest,
    },
    save.owner,
  );
export const commitPendingSaves = (saves: PendingSave[]): Promise<SaveResult> =>
  invokeBackend(
    'workspace',
    {
      action: 'save-batch',
      response: 'ack',
      saves: saves.map((save) => ({
        operationId: save.id,
        changes: save.changes,
        event: save.event,
      })),
    },
    saves[0]?.owner,
  );
export const importScoreSheet = (
  snapshot: Snapshot,
  request: ScoreImportRequest,
): Promise<Snapshot> =>
  invokeBackend('workspace', { action: 'import-scores', revision: snapshot.revision, request });
export const saveWorkspace = (snapshot: Snapshot, next: State, event?: string): Promise<Snapshot> =>
  invokeBackend('workspace', {
    action: 'save',
    revision: snapshot.revision,
    changes: changesBetween(snapshot.state, next),
    event,
  });

export async function uploadLearningFile(file: File): Promise<string> {
  if (!supabase) throw new Error('Supabase is not configured');
  if (file.size > 5 * 1024 * 1024) throw new Error('Choose a file smaller than 5 MB');
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error('Sign in before uploading');
  const path = `${data.user.id}/${crypto.randomUUID()}/${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const { error } = await supabase.storage
    .from('learning-files')
    .upload(path, file, { upsert: false });
  if (error) throw error;
  return path;
}
export async function downloadLearningFile(path: string) {
  const { url } = await invokeBackend('workspace', { action: 'file-url', path });
  const link = document.createElement('a');
  link.href = url;
  link.rel = 'noopener noreferrer';
  link.click();
}
