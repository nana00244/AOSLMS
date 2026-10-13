import { workspaceSchema } from './validation';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { type State, type Role, type User } from './data';
import { assignedClassIdsForTeacher } from './services/teacherService';
import { supabase } from './supabase';
import { loginIdentifier } from './accountRules';
import { emptyState } from './emptyState';
import { loadWorkspace, commitPendingSave, type Snapshot } from './backend';
import { changesBetween } from './backendAccess';
import { applyScoreImport, type ScoreImportRequest } from './scoreImport';
import { overlayChanges, mergeSavedValue, recordValue } from './saveRecovery';
import { readPendingSaves, retainSave, removeSave, type PendingSave } from './pendingSaves';
export function validateState(value: unknown): value is State {
  return workspaceSchema.safeParse(value).success;
}
export type Theme = 'light' | 'dark';
interface Store {
  data: State;
  role: Role | null;
  setRole: (r: Role | null) => void;
  update: (fn: (s: State) => State, action?: string) => Promise<boolean>;
  importScores: (request: ScoreImportRequest) => Promise<boolean>;
  notify: (message: string) => void;
  toast: string;
  storageError: string;
  allowedClasses: string[];
  me: string;
  ownId: string;
  user: User | undefined;
  authLoading: boolean;
  signIn: (identifier: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
  pendingCount: number;
  retrySaves: () => Promise<void>;
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
}
const Context = createContext<Store>(null!);
export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<State>(emptyState);
  const dataRef = useRef(data);
  const snapshot = useRef<Snapshot | null>(null);
  const owner = useRef('');
  const busy = useRef(false);
  const syncing = useRef<Promise<void> | null>(null);
  const lastRefresh = useRef(0);
  const generation = useRef(0);
  const refreshing = useRef<Promise<void> | null>(null);
  const refreshAgain = useRef(false);
  const serial = useRef<Promise<unknown>>(Promise.resolve());
  const pendingRef = useRef<PendingSave[]>([]);
  const writing = useRef(0);
  const [saving, setSaving] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncingNow, setSyncingNow] = useState(false);
  const [pendingExpanded, setPendingExpanded] = useState(false);
  const [role, setRoleState] = useState<Role | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authProfile, setAuthProfile] = useState<User | undefined>();
  const [toast, setToast] = useState('');
  const [storageError, setStorageError] = useState('');
  const [theme, setThemeState] = useState<Theme>(() => {
    const stored = localStorage.getItem('aos-theme');
    return stored === 'light' || stored === 'dark'
      ? stored
      : window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
  });
  useEffect(() => {
    localStorage.setItem('aos-theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);
  useEffect(() => {
    const favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (favicon) favicon.href = data.settings.crest || './crest.svg';
  }, [data.settings.crest]);
  function notify(message: string) {
    setToast(message);
    window.setTimeout(() => setToast((current) => (current === message ? '' : current)), 4500);
  }
  function show(result: Snapshot, pending: PendingSave[]) {
    snapshot.current = result;
    pendingRef.current = pending;
    setPendingCount(pending.length);
    const visible = pending.reduce(
      (state, save) => overlayChanges(state, save.changes),
      result.state,
    );
    dataRef.current = visible;
    setData(visible);
    const profile = result.state.users.find((u) => u.id === owner.current);
    setAuthProfile(profile);
    setRoleState(profile?.role || null);
  }
  async function refresh(minimumRevision?: number) {
    if (!supabase || !owner.current) return;
    if (syncing.current) await syncing.current;
    if (!owner.current) return;
    // A save response already includes its resulting snapshot. Its realtime event
    // can arrive before the response, so check only after the save has finished.
    if (
      minimumRevision !== undefined &&
      snapshot.current &&
      minimumRevision <= snapshot.current.revision
    )
      return;
    if (refreshing.current) {
      refreshAgain.current = true;
      return refreshing.current;
    }
    const current = generation.current,
      userId = owner.current;
    const task = (async () => {
      const result = await loadWorkspace(snapshot.current?.revision);
      const pending = await readPendingSaves(userId);
      if (
        current !== generation.current ||
        busy.current ||
        (snapshot.current && result.revision < snapshot.current.revision)
      )
        return;
      if (!('unchanged' in result)) show(result, pending);
      else if (snapshot.current) show(snapshot.current, pending);
      lastRefresh.current = Date.now();
      if (!pending.length) setStorageError('');
    })();
    refreshing.current = task;
    try {
      await task;
    } finally {
      if (refreshing.current === task) {
        refreshing.current = null;
        if (refreshAgain.current) {
          refreshAgain.current = false;
          // An invalidation during a slow read needs one trailing read, not overlapping requests.
          void refresh().catch(() => {});
        }
      }
    }
  }
  async function syncQueue() {
    if (!owner.current || !supabase) return;
    if (syncing.current) return syncing.current;
    const userId = owner.current,
      current = generation.current;
    const execute = async () => {
      if (busy.current || current !== generation.current) return;
      busy.current = true;
      setSyncingNow(true);
      try {
        let pending = await readPendingSaves(userId);
        while (pending.length && current === generation.current) {
          const save = pending[0];
          let result: Snapshot | undefined;
          for (let attempt = 0; attempt < 3; attempt++) {
            try {
              result = await commitPendingSave(save);
              break;
            } catch (error) {
              const message = error instanceof Error ? error.message : String(error);
              // Only the transactional compare-and-swap race is retryable immediately.
              if (attempt === 2 || !message.includes('Conflict: records changed')) throw error;
            }
          }
          if (!result || current !== generation.current) return;
          await removeSave(save.id);
          pending = await readPendingSaves(userId);
          show(result, pending);
          lastRefresh.current = Date.now();
        }
        if (current === generation.current) setStorageError('');
      } catch (error) {
        if (current === generation.current)
          setStorageError(
            `Not synced: ${error instanceof Error ? error.message : 'Connection failed'}. Your pending entries are retained on this device.`,
          );
      } finally {
        busy.current = false;
        if (current === generation.current) setSyncingNow(false);
      }
    };
    const task = (async () => {
      if (navigator.locks) await navigator.locks.request(`aos-save-${userId}`, execute);
      else await execute();
    })();
    syncing.current = task;
    try {
      await task;
    } finally {
      if (syncing.current === task) syncing.current = null;
    }
  }
  async function retrySaves() {
    if (pendingRef.current.length) await syncQueue();
    else await refresh();
  }
  async function resolveConflict() {
    if (!storageError.includes('Conflict:') || !owner.current) return;
    if (
      !window.confirm(
        'Keep the fields from your oldest pending save where they conflict with newer database entries? Other fields will be preserved. Download pending entries first if you want a separate copy.',
      )
    )
      return;
    const result = await loadWorkspace();
    const first = (await readPendingSaves(owner.current))[0];
    if (!first) return;
    const changes = first.changes.map((change) => {
      const before = recordValue(result.state, change);
      return {
        ...change,
        before,
        after: mergeSavedValue(
          change.before,
          change.after,
          before,
          `${change.collection}/${change.id}`,
          true,
        ),
      };
    });
    await retainSave({ ...first, changes });
    await retrySaves();
  }
  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false);
      setStorageError('Supabase is not configured. Saving is unavailable.');
      return;
    }
    let active = true;
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        const changedUser = owner.current !== session.user.id;
        if (changedUser) {
          generation.current++;
          refreshing.current = null;
          refreshAgain.current = false;
          owner.current = session.user.id;
          setAuthLoading(true);
          setStorageError('');
          lastRefresh.current = 0;
          snapshot.current = null;
          dataRef.current = emptyState();
          setData(dataRef.current);
          pendingRef.current = [];
          setPendingCount(0);
          setAuthProfile(undefined);
          setRoleState(null);
        }
        if (changedUser || (!snapshot.current && event !== 'TOKEN_REFRESHED'))
          window.setTimeout(async () => {
            const authGeneration = generation.current;
            if (!active || owner.current !== session.user.id) return;
            try {
              await refresh();
              if (active && authGeneration === generation.current) {
                setAuthLoading(false);
                if (pendingRef.current.length) await syncQueue();
              }
            } catch (error) {
              if (active && authGeneration === generation.current)
                setStorageError(
                  error instanceof Error ? error.message : 'Could not load school records',
                );
            } finally {
              if (active && authGeneration === generation.current) setAuthLoading(false);
            }
          }, 0);
      } else {
        generation.current++;
        refreshing.current = null;
        refreshAgain.current = false;
        owner.current = '';
        setStorageError('');
        setPendingExpanded(false);
        snapshot.current = null;
        dataRef.current = emptyState();
        setData(dataRef.current);
        pendingRef.current = [];
        setPendingCount(0);
        setAuthProfile(undefined);
        setRoleState(null);
        setAuthLoading(false);
      }
    });
    const reload = () => {
      if (
        owner.current &&
        document.visibilityState !== 'hidden' &&
        (pendingRef.current.length || Date.now() - lastRefresh.current > 30000)
      )
        void retrySaves().catch(() => {});
    };
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (pendingRef.current.length || writing.current) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('online', reload);
    window.addEventListener('focus', reload);
    window.addEventListener('beforeunload', beforeUnload);
    return () => {
      active = false;
      generation.current++;
      listener.subscription.unsubscribe();
      window.removeEventListener('online', reload);
      window.removeEventListener('focus', reload);
      window.removeEventListener('beforeunload', beforeUnload);
    };
  }, []);
  useEffect(() => {
    if (!supabase || !authProfile?.id) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    let queuedRevision: number | undefined;
    let fullCheck = false;
    const reload = (revision?: number) => {
      if (revision === undefined) fullCheck = true;
      else queuedRevision = Math.max(queuedRevision ?? revision, revision);
      clearTimeout(timer);
      timer = setTimeout(() => {
        const minimumRevision = fullCheck ? undefined : queuedRevision;
        queuedRevision = undefined;
        fullCheck = false;
        if (active && document.visibilityState !== 'hidden') {
          // External edits still arrive promptly; ignore own/duplicate revisions.
          const task = minimumRevision === undefined ? retrySaves() : refresh(minimumRevision);
          void task.catch(() => {});
        }
      }, 250);
    };
    const channel = supabase
      .channel(`workspace-revision-${authProfile.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'workspace_revisions' },
        (payload) => {
          const revision = payload.new.revision;
          reload(Number.isSafeInteger(revision) && revision >= 0 ? revision : undefined);
        },
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') reload();
      });
    const interval = setInterval(() => reload(), 60000);
    return () => {
      active = false;
      clearTimeout(timer);
      clearInterval(interval);
      void supabase?.removeChannel(channel);
    };
  }, [authProfile?.id]);
  const user = authProfile;
  const linkedStudent =
    role === 'Student' ? data.students.find((s) => s.id === user?.studentId) : undefined;
  async function signIn(identifier: string, password: string) {
    if (!supabase) throw new Error('Supabase is not configured');
    const result = await supabase.auth.signInWithPassword({
      email: loginIdentifier(identifier),
      password,
    });
    if (result.error) throw result.error;
  }
  async function signOut() {
    if (pendingRef.current.length || writing.current) {
      notify('Sync your pending saves before signing out. They are retained on this device.');
      return;
    }
    if (!supabase) return;
    const result = await supabase.auth.signOut();
    if (result.error) notify(result.error.message);
  }
  function update(
    fn: (s: State) => State,
    action?: string,
    scoreRequest?: ScoreImportRequest,
  ): Promise<boolean> {
    writing.current++;
    setSaving(true);
    const currentOwner = owner.current;
    const task = serial.current
      .catch(() => {})
      .then(async () => {
        if (!supabase || !snapshot.current || !currentOwner || currentOwner !== owner.current) {
          notify('Sign in and load school records before saving.');
          return false;
        }
        try {
          const next = fn(dataRef.current);
          const changes = changesBetween(dataRef.current, next);
          let id = '';
          if (changes.length) {
            const save: PendingSave = {
              id: crypto.randomUUID(),
              owner: currentOwner,
              createdAt: new Date().toISOString(),
              changes,
              event: action,
              scoreRequest,
            };
            await retainSave(save); // Durable before sending; do not announce success yet.
            id = save.id;
            const pending = await readPendingSaves(currentOwner);
            if (currentOwner !== owner.current) return false;
            show(snapshot.current!, pending);
          }
          await syncQueue();
          const remaining = await readPendingSaves(currentOwner);
          if (currentOwner !== owner.current) return false;
          const saved = !remaining.some((p) => !id || p.id === id);
          if (saved) notify('Changes saved to the school database.');
          return saved;
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Could not retain this save';
          setStorageError(`Not saved: ${message}`);
          notify(`Not saved: ${message}`);
          return false;
        }
      });
    serial.current = task;
    return task.finally(() => {
      writing.current--;
      if (!writing.current) setSaving(false);
    });
  }
  async function importScores(request: ScoreImportRequest) {
    if (!user) return false;
    const saved = await update(
      (state) => applyScoreImport(state, user, request),
      `Assessment upload: ${request.classId}, ${request.subject}, ${request.sheet.category}, term ${request.sheet.term}`,
      request,
    );
    if (saved) notify('Score sheet saved. Subject cards and report cards are updated.');
    return saved;
  }
  return (
    <Context.Provider
      value={{
        data,
        role,
        setRole: () => {},
        update,
        importScores,
        notify,
        toast,
        storageError,
        allowedClasses:
          role === 'Teacher'
            ? assignedClassIdsForTeacher(data, user)
            : role === 'Student'
              ? linkedStudent
                ? [linkedStudent.classId]
                : []
              : data.classes,
        me: user?.name || 'Guest',
        ownId: linkedStudent?.id || (role === 'Student' ? '' : data.students[0]?.id || ''),
        user,
        authLoading,
        signIn,
        signOut,
        refresh,
        pendingCount,
        retrySaves,
        theme,
        setTheme: setThemeState,
        toggleTheme: () => setThemeState(theme === 'light' ? 'dark' : 'light'),
      }}
    >
      {children}
      {pendingCount > 0 && (
        <aside className="pending-save-banner" aria-label="Pending saves">
          <button
            className="pending-save-toggle"
            aria-expanded={pendingExpanded}
            onClick={() => setPendingExpanded(!pendingExpanded)}
          >
            {pendingExpanded ? 'Hide details' : 'Show details'}
          </button>
          <strong>
            {pendingCount} pending save{pendingCount === 1 ? '' : 's'} —{' '}
            {syncingNow ? 'syncing…' : 'retained on this device.'}
          </strong>
          {pendingExpanded && (
            <>
              <span>
                {storageError || 'Retained on this device until the database confirms the save.'}
              </span>
              <button
                disabled={syncingNow}
                onClick={() => void retrySaves().catch((error) => notify(String(error)))}
              >
                {syncingNow ? 'Syncing…' : 'Retry sync'}
              </button>
              <button
                onClick={() =>
                  download(
                    'pending-school-saves.json',
                    JSON.stringify(pendingRef.current, null, 2),
                    'application/json',
                  )
                }
              >
                Download pending entries
              </button>
              {storageError.includes('Conflict:') && (
                <button
                  onClick={() => void resolveConflict().catch((error) => notify(String(error)))}
                >
                  Keep my changed fields and retry
                </button>
              )}
            </>
          )}
        </aside>
      )}
      {saving && (
        <div className="cloud-save-overlay" role="status" aria-live="polite">
          Saving to your school database…
        </div>
      )}
    </Context.Provider>
  );
}

export const useStore = () => useContext(Context);
export function download(name: string, content: string, type = 'text/plain') {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function csv(name: string, rows: (string | number)[][]) {
  download(
    name,
    rows
      .map((r) =>
        r
          .map(
            (c) =>
              `"${String(c)
                .replace(/^[=+@-]/, "'$&")
                .replaceAll('"', '""')}"`,
          )
          .join(','),
      )
      .join('\r\n'),
    'text/csv;charset=utf-8',
  );
}
export async function checksum(text: string) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(bytes))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
export async function backup(data: State) {
  const payload = JSON.stringify(data);
  download(
    `AOS_Backup_${new Date().toISOString().slice(0, 10)}.json`,
    JSON.stringify(
      { format: 'aos-backup-v1', checksum: await checksum(payload), payload },
      null,
      2,
    ),
    'application/json',
  );
}
