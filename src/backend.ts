import { supabase } from './supabase';
import type { State } from './data';
import { changesBetween } from './backendAccess';

export async function invokeBackend(name: string, body: unknown) {
  if (!supabase) throw new Error('Supabase is not configured');
  const { data, error } = await supabase.functions.invoke(name, {
    body: body as Record<string, unknown>,
  });
  if (error) {
    if (error.context instanceof Response) {
      const detail = await error.context.json().catch(() => null);
      if (detail?.error) throw new Error(detail.error);
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
export const loadWorkspace = (): Promise<Snapshot> =>
  invokeBackend('workspace', { action: 'load' });
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
