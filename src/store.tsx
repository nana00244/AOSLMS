import { workspaceSchema } from './validation';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { seed, uid, type State, type Role, type User, classes } from './data';
import { assignedClassIdsForTeacher } from './services/teacherService';
import { isSupabaseConfigured, supabase } from './supabase';
import { loginIdentifier } from './accountRules';
import { emptyState } from './emptyState';
import { loadWorkspace, saveWorkspace, type Snapshot } from './backend';
const KEY = 'aos-lms-demo-v1';
export function validateState(value: unknown): value is State {
  return workspaceSchema.safeParse(value).success;
}
function read(): State {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (validateState(parsed)) {
        if (!parsed.classes || !parsed.classes.length) {
          parsed.classes = [...classes];
        }
        const studentAccounts = parsed.users.filter((user) => user.role === 'Student');
        if (
          studentAccounts.length === 1 &&
          !studentAccounts[0].studentId &&
          parsed.students.length
        ) {
          studentAccounts[0].studentId =
            parsed.students.find((student) => student.classId === studentAccounts[0].classes[0])
              ?.id || parsed.students[0].id;
        }
        return parsed;
      }
    }
  } catch {
    /* Fall back to sample data without overwriting stored data. */
  }
  return seed();
}
export type Theme = 'light' | 'dark';

interface Store {
  data: State;
  role: Role | null;
  setRole: (r: Role | null) => void;
  update: (fn: (s: State) => State, action?: string) => void;
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
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
}
const Context = createContext<Store>(null!);
export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState(() => (isSupabaseConfigured ? emptyState() : read()));
  const snapshot = useRef<Snapshot | null>(null);
  const busy = useRef(false);
  const generation = useRef(0);
  const [saving, setSaving] = useState(false);
  const [role, setRoleState] = useState<Role | null>(() => {
    if (isSupabaseConfigured) return null;
    const r = sessionStorage.getItem('aos-role');
    return ['Administrator', 'Teacher', 'Student', 'Accountant'].includes(r || '')
      ? (r as Role)
      : null;
  });
  const [authLoading, setAuthLoading] = useState(isSupabaseConfigured);
  const [authProfile, setAuthProfile] = useState<User | undefined>();

  async function refresh() {
    if (!supabase || busy.current) return;
    const currentGeneration = generation.current;
    const result = await loadWorkspace();
    if (currentGeneration !== generation.current || busy.current) return;
    snapshot.current = result;
    setData(result.state);
    setStorageError('');
    const { data: session } = await supabase.auth.getSession();
    if (currentGeneration !== generation.current) return;
    const profile = result.state.users.find((u) => u.id === session.session?.user.id);
    setAuthProfile(profile);
    setRoleState(profile?.role || null);
  }

  useEffect(() => {
    const client = supabase;
    if (!client) return;
    let active = true;
    const load = async () => {
      try {
        await refresh();
      } catch (error) {
        if (active) {
          setStorageError(error instanceof Error ? error.message : 'Could not load school records');
          setRoleState(null);
          setAuthProfile(undefined);
          snapshot.current = null;
          setData(emptyState());
        }
      } finally {
        if (active) setAuthLoading(false);
      }
    };
    const { data: listener } = client.auth.onAuthStateChange((_event, session) => {
      if (session) {
        if (_event !== 'TOKEN_REFRESHED') {
          setAuthLoading(true);
          // Supabase callbacks must not await another auth operation under its lock.
          window.setTimeout(() => {
            if (active) void load();
          }, 0);
        }
      } else {
        generation.current++;
        snapshot.current = null;
        setData(emptyState());
        setAuthProfile(undefined);
        setRoleState(null);
        setAuthLoading(false);
      }
    });
    const onFocus = () => {
      if (snapshot.current && !busy.current) void load();
    };
    window.addEventListener('focus', onFocus);
    return () => {
      active = false;
      generation.current++;
      window.removeEventListener('focus', onFocus);
      listener.subscription.unsubscribe();
    };
  }, []);
  const [theme, setThemeState] = useState<Theme>(() => {
    const stored = localStorage.getItem('aos-theme');
    if (stored === 'light' || stored === 'dark') {
      document.documentElement.setAttribute('data-theme', stored);
      document.documentElement.classList.toggle('dark', stored === 'dark');
      return stored;
    }
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initial = prefersDark ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', initial);
    document.documentElement.classList.toggle('dark', initial === 'dark');
    return initial;
  });
  const [toast, setToast] = useState('');
  const [storageError, setStorageError] = useState('');

  function setTheme(t: Theme) {
    setThemeState(t);
    localStorage.setItem('aos-theme', t);
    document.documentElement.setAttribute('data-theme', t);
    document.documentElement.classList.toggle('dark', t === 'dark');
  }

  function toggleTheme() {
    setTheme(theme === 'light' ? 'dark' : 'light');
  }

  const roleId =
    role === 'Teacher' ? 'u2' : role === 'Student' ? 'u3' : role === 'Accountant' ? 'u4' : 'u1';
  const user = isSupabaseConfigured
    ? authProfile
    : data.users.find((u) => u.id === roleId && u.active);
  const linkedStudent =
    role === 'Student'
      ? data.students.find((student) => student.id === user?.studentId || student.id === user?.id)
      : undefined;
  const me = user?.name || role || 'Guest';
  function setRole(r: Role | null) {
    if (isSupabaseConfigured) return;
    setRoleState(r);
    if (r) sessionStorage.setItem('aos-role', r);
    else sessionStorage.removeItem('aos-role');
  }
  async function signIn(identifier: string, password: string) {
    if (!supabase) throw new Error('Supabase is not configured.');
    const { error } = await supabase.auth.signInWithPassword({
      email: loginIdentifier(identifier),
      password,
    });
    if (error) throw error;
  }
  async function signOut() {
    if (supabase) {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } else {
      setRole(null);
    }
  }
  function notify(message: string) {
    setToast(message);
    window.setTimeout(() => setToast((current) => (current === message ? '' : current)), 4500);
  }
  function update(fn: (s: State) => State, action?: string) {
    if (isSupabaseConfigured) {
      if (!snapshot.current || busy.current) {
        notify('Please wait for the current save to finish.');
        return;
      }
      const previous = snapshot.current;
      const currentGeneration = generation.current;
      busy.current = true;
      setSaving(true);
      setStorageError('');
      void Promise.resolve()
        .then(() => saveWorkspace(previous, fn(previous.state), action))
        .then((result) => {
          if (generation.current !== currentGeneration) return;
          snapshot.current = result;
          setData(result.state);
          notify('Changes saved to the school database.');
        })
        .catch((error: unknown) => {
          if (generation.current !== currentGeneration) return;
          const message = error instanceof Error ? error.message : 'Could not save changes';
          setStorageError(`Not saved: ${message}`);
          notify(`Not saved: ${message}`);
        })
        .finally(() => {
          busy.current = false;
          setSaving(false);
        });
      return;
    }
    setData((s) => {
      let next = fn(s);
      if (!next.classes || !next.classes.length) {
        next.classes = [...classes];
      }
      if (action)
        next = {
          ...next,
          logs: [
            {
              id: uid(),
              action,
              actor: me,
              date: new Date().toISOString(),
              type: role || 'System',
            },
            ...next.logs,
          ],
        };
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
        setStorageError('');
      } catch {
        setStorageError(
          'Browser storage is full or unavailable. Your latest changes are in memory only. Export a backup before closing this tab.',
        );
      }
      return next;
    });
  }
  return (
    <Context.Provider
      value={{
        data,
        role,
        authLoading,
        signIn,
        signOut,
        refresh,
        setRole,
        update,
        notify,
        toast,
        storageError,
        allowedClasses:
          role === 'Teacher'
            ? assignedClassIdsForTeacher(data, user)
            : role === 'Student'
              ? linkedStudent?.classId
                ? [linkedStudent.classId]
                : []
              : data.classes || classes,
        me,
        ownId: linkedStudent?.id || (role === 'Student' ? '' : data.students[0]?.id || ''),
        user,
        theme,
        setTheme,
        toggleTheme,
      }}
    >
      {children}
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
    `AOS_Demo_Backup_${new Date().toISOString().slice(0, 10)}.json`,
    JSON.stringify({ format: 'aos-demo-v1', checksum: await checksum(payload), payload }, null, 2),
    'application/json',
  );
}
