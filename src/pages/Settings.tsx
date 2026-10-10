import { useState } from 'react';
import {
  Save,
  Download,
  Upload,
  ShieldCheck,
  School,
  CalendarDays,
  Plus,
  Pencil,
  Search,
  RotateCcw,
  Trash2,
  Sun,
  Moon,
} from 'lucide-react';
import { useStore, backup, checksum, validateState, csv } from '../store';
import {
  seed,
  uid,
  classes,
  classSubjects,
  courseworkSubjectId,
  type State,
  type User,
  type Role,
} from '../data';
import {
  PageHeader,
  Button,
  Card,
  CardTitle,
  Field,
  Tabs,
  Modal,
  Badge,
  SearchBox,
  Person,
  Empty,
} from '../components/ui';
import { adminService } from '../services/adminService';
import { isSupabaseConfigured } from '../supabase';
import { invokeBackend } from '../backend';
import { normalizeUsername, usernameAuthEmail, normalizeTeachingAccess } from '../accountRules';
export function SettingsPage() {
  const { data, update, notify, theme, setTheme } = useStore();
  const [settings, setSettings] = useState(data.settings),
    [restore, setRestore] = useState<State | null>(null),
    [confirm, setConfirm] = useState(''),
    [reset, setReset] = useState(false),
    [error, setError] = useState('');
  async function readRestore(f?: File) {
    if (!f) return;
    try {
      if (f.size > 10 * 1024 * 1024) throw Error('Backup is too large. Maximum size is 10 MB.');
      const envelope = JSON.parse(await f.text());
      if (
        envelope.format !== 'aos-demo-v1' ||
        typeof envelope.payload !== 'string' ||
        (await checksum(envelope.payload)) !== envelope.checksum
      )
        throw Error('The backup checksum is invalid. No records were changed.');
      const parsed = JSON.parse(envelope.payload);
      if (!validateState(parsed))
        throw Error('This file does not contain a valid LMS demo workspace.');
      setRestore(parsed);
      setConfirm('');
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to restore this file.');
    }
  }
  return (
    <>
      <PageHeader
        eyebrow="MAKE IT YOUR SCHOOL"
        title="System settings"
        description="Your school’s identity, academic cycle, and workspace care."
        actions={
          <Button form="settings-form" type="submit">
            <Save size={16} />
            Save all changes
          </Button>
        }
      />
      <div className="settings-grid">
        <form
          id="settings-form"
          className="settings-column"
          onSubmit={(e) => {
            e.preventDefault();
            update((d) => ({ ...d, settings }), 'Institution settings updated');
            notify('School settings saved.');
          }}
        >
          <Card>
            <CardTitle
              title="Institution profile"
              description="The details that appear on reports and receipts."
            />
            <div className="crest-upload">
              <img src={settings.crest || './crest.svg'} alt="School crest" />
              <Field label="Upload school crest" hint="PNG or JPEG, up to 500 KB.">
                <input
                  type="file"
                  accept="image/png,image/jpeg"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    if (f.size > 500000) {
                      notify('Choose an image under 500 KB.');
                      return;
                    }
                    const r = new FileReader();
                    r.onload = () => setSettings({ ...settings, crest: String(r.result) });
                    r.readAsDataURL(f);
                  }}
                />
              </Field>
            </div>
            {(['name', 'motto', 'address', 'phone', 'email'] as const).map((k) => (
              <Field
                label={
                  {
                    name: 'School name',
                    motto: 'School motto',
                    address: 'Address',
                    phone: 'Contact phone',
                    email: 'School email',
                  }[k]
                }
                key={k}
              >
                <input
                  required
                  type={k === 'email' ? 'email' : 'text'}
                  value={settings[k]}
                  onChange={(e) => setSettings({ ...settings, [k]: e.target.value })}
                />
              </Field>
            ))}
          </Card>
          <Card>
            <CardTitle
              title="Academic cycle"
              description="Keep the whole school on the same page."
            />
            <Field label="Academic year">
              <input
                required
                value={settings.year}
                onChange={(e) => setSettings({ ...settings, year: e.target.value })}
              />
            </Field>
            <Field label="Active term">
              <div className="term-selector">
                {[1, 2, 3].map((t) => (
                  <button
                    type="button"
                    aria-pressed={settings.term === t}
                    className={settings.term === t ? 'active' : ''}
                    key={t}
                    onClick={() => setSettings({ ...settings, term: t })}
                  >
                    Term {t}
                  </button>
                ))}
              </div>
            </Field>
            <div className="form-grid">
              <Field label="Vacation date">
                <input
                  required
                  type="date"
                  value={settings.vacation}
                  onChange={(e) => setSettings({ ...settings, vacation: e.target.value })}
                />
              </Field>
              <Field label="Next term reopening">
                <input
                  required
                  type="date"
                  value={settings.reopening}
                  onChange={(e) => setSettings({ ...settings, reopening: e.target.value })}
                />
              </Field>
            </div>
            <div className="notice">
              <CalendarDays size={18} />
              Saving a new term updates gradebooks, report cards, and fee balances throughout this
              workspace.
            </div>
          </Card>
        </form>
        <div className="settings-column">
          <Card>
            <CardTitle
              title="Appearance & Theme"
              description="Customize your workspace display according to your preference."
            />
            <div className="theme-switcher-grid">
              <button
                type="button"
                className={`theme-option-btn ${theme === 'light' ? 'active' : ''}`}
                onClick={() => setTheme('light')}
              >
                <Sun size={20} />
                <div>
                  <strong>Light mode</strong>
                  <small>Clean, high-clarity daylight theme</small>
                </div>
              </button>
              <button
                type="button"
                className={`theme-option-btn ${theme === 'dark' ? 'active' : ''}`}
                onClick={() => setTheme('dark')}
              >
                <Moon size={20} />
                <div>
                  <strong>Dark mode</strong>
                  <small>Comfortable, low-glare nighttime theme</small>
                </div>
              </button>
            </div>
          </Card>
          <Card>
            <CardTitle
              title="Workspace backup & restore"
              description={
                isSupabaseConfigured
                  ? 'Export the school records currently loaded from the database.'
                  : 'Keep a copy of your browser-local demo records.'
              }
            />
            <div className="backup-panel">
              <span className="icon-tile blue">
                <ShieldCheck size={27} />
              </span>
              <h3>A little peace of mind.</h3>
              <p>Export school records to a JSON file with a SHA-256 integrity checksum.</p>
              <Button
                variant="secondary"
                onClick={() =>
                  backup(data)
                    .then(() =>
                      notify(
                        isSupabaseConfigured ? 'Backup downloaded.' : 'Demo backup downloaded.',
                      ),
                    )
                    .catch(() => notify('Backup could not be generated.'))
                }
              >
                <Download size={16} />
                Download backup
              </Button>
            </div>
            <h3>Restore a saved workspace</h3>
            <p className="muted">
              Choose a backup to verify it before replacing your school records.
            </p>
            <Field label="Upload restore file">
              <input
                type="file"
                accept=".json"
                onChange={(e) => {
                  readRestore(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
            </Field>
            {error && (
              <div className="error" role="alert">
                {error}
              </div>
            )}
            <div className="notice">
              <ShieldCheck size={18} />
              {isSupabaseConfigured
                ? 'Database records sync across devices. Exports include file references; stored files and login accounts are managed separately.'
                : 'These backups cover this browser’s demo data.'}
            </div>
          </Card>
          {!isSupabaseConfigured && (
            <Card>
              <CardTitle
                title="Reset demo workspace"
                description="Start again with the original sample records."
              />
              <div className="danger-panel">
                <h3>A fresh start</h3>
                <p>
                  This replaces local changes with the initial demonstration data. Download a backup
                  first if you want to keep your work.
                </p>
                <Button
                  variant="danger"
                  onClick={() => {
                    setReset(true);
                    setConfirm('');
                  }}
                >
                  <RotateCcw size={16} />
                  Reset demo data
                </Button>
              </div>
            </Card>
          )}
        </div>
      </div>
      {(restore || reset) && (
        <Modal
          title={
            restore
              ? isSupabaseConfigured
                ? 'Restore school records'
                : 'Restore demo workspace'
              : 'Reset demo workspace'
          }
          onClose={() => {
            setRestore(null);
            setReset(false);
          }}
        >
          <p>
            {restore
              ? 'The backup checksum has been verified. Restoring will replace current school records. Login accounts are retained.'
              : 'Resetting replaces your local changes with the initial sample data.'}
          </p>
          <Field label={`Type ${restore ? 'RESTORE SYSTEM' : 'RESET DEMO'} to confirm`}>
            <input value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </Field>
          <div className="modal-actions">
            <Button
              variant="secondary"
              onClick={() => {
                setRestore(null);
                setReset(false);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={confirm !== (restore ? 'RESTORE SYSTEM' : 'RESET DEMO')}
              onClick={() => {
                const replacement = restore || seed();
                update(
                  (current) =>
                    isSupabaseConfigured
                      ? {
                          ...replacement,
                          users: current.users,
                          teacherAssignments: current.teacherAssignments,
                        }
                      : replacement,
                  restore ? 'School backup restored' : 'Demo workspace reset',
                );
                setSettings(replacement.settings);
                setRestore(null);
                setReset(false);
                notify(
                  isSupabaseConfigured
                    ? 'Workspace update requested.'
                    : 'Demo workspace updated successfully.',
                );
              }}
            >
              Confirm {restore ? 'restore' : 'reset'}
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
export function UsersPage() {
  const { data, user: adminUser, update, notify, refresh } = useStore();
  const [savingAccount, setSavingAccount] = useState(false);
  const [q, setQ] = useState(''),
    [edit, setEdit] = useState<User | null>(null),
    [remove, setRemove] = useState<User | null>(null);
  const setClassSubjectAccess = (
    user: User,
    classId: string,
    subject: string,
    checked: boolean,
  ) => {
    const current = user.classAllowedSubjects || {};
    const currentSubjects = current[classId] || [];
    const nextSubjects = checked
      ? [...new Set([...currentSubjects, subject])]
      : currentSubjects.filter((item) => item !== subject);
    setEdit({
      ...user,
      classAllowedSubjects: { ...current, [classId]: nextSubjects },
    });
  };
  const users = data.users.filter((u) =>
    (u.name + (u.username || u.email) + u.role).toLowerCase().includes(q.toLowerCase()),
  );
  return (
    <>
      <PageHeader
        eyebrow="YOUR SCHOOL TEAM"
        title="Users & access"
        description="Organise staff profiles, workspace roles, and teaching assignments."
        actions={
          <Button
            onClick={() =>
              setEdit({ id: '', name: '', email: '', role: 'Teacher', active: true, classes: [] })
            }
          >
            <Plus size={16} />
            Add user
          </Button>
        }
      />
      <div className="notice">
        {isSupabaseConfigured
          ? 'Create a username and password for each user. Usernames do not need an email address or @ symbol. Existing email accounts can still sign in.'
          : 'User records are for the frontend preview. Configure Supabase to create real login accounts.'}
      </div>
      <Card>
        <div className="filter-bar">
          <SearchBox value={q} onChange={setQ} placeholder="Search people, roles, or username..." />
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Team member</th>
                <th>Role</th>
                <th>Assigned classes</th>
                <th>Teaching scope</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>
                    <Person name={u.name} sub={u.username || u.email} />
                  </td>
                  <td>{u.role}</td>
                  <td>{u.classes.join(', ') || '—'}</td>
                  <td>
                    {u.role === 'Teacher'
                      ? u.classes
                          .map((classId) => {
                            const whitelist = u.classAllowedSubjects?.[classId];
                            const scope =
                              whitelist === undefined
                                ? 'Class teacher · all subjects'
                                : classSubjects(classId)
                                    .filter(
                                      (subject) =>
                                        whitelist.includes(subject) ||
                                        whitelist.includes(courseworkSubjectId(subject)),
                                    )
                                    .join(', ') || 'No subjects selected';
                            return `${classId}: ${scope}`;
                          })
                          .join(' · ') || 'No class assigned'
                      : '—'}
                  </td>
                  <td>
                    <Badge tone={u.active ? 'green' : 'amber'}>
                      {u.active ? 'Active' : 'Inactive'}
                    </Badge>
                  </td>
                  <td>
                    <div className="row-actions">
                      <button
                        className="icon-btn"
                        aria-label={`Edit ${u.name}`}
                        onClick={() => setEdit(u)}
                      >
                        <Pencil size={16} />
                      </button>
                      {u.id !== (isSupabaseConfigured ? adminUser?.id : 'u1') && (
                        <button
                          className="icon-btn"
                          aria-label={`Remove ${u.name}`}
                          onClick={() => setRemove(u)}
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!users.length && <Empty title="No people found" />}
      </Card>
      {edit && (
        <Modal
          title={edit.id ? 'Edit user profile' : 'Add a team member'}
          onClose={() => setEdit(null)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              let username: string | undefined;
              let teaching: { classes: string[]; classAllowedSubjects: Record<string, string[]> };
              try {
                username = edit.username?.trim() ? normalizeUsername(edit.username) : undefined;
                if (!edit.id && !username)
                  throw new Error('Choose a username for the new account.');
                teaching =
                  edit.role === 'Teacher'
                    ? normalizeTeachingAccess(
                        edit.classes,
                        edit.classAllowedSubjects || {},
                        data.classes,
                      )
                    : { classes: [], classAllowedSubjects: {} };
              } catch (error) {
                notify(error instanceof Error ? error.message : 'Check account details.');
                return;
              }
              if (isSupabaseConfigured) {
                const form = e.currentTarget;
                const formData = new FormData(form);
                const password = String(formData.get('temporaryPassword') || '');
                if ((!edit.id || password) && password.length < 12) {
                  notify('Temporary password must contain at least 12 characters.');
                  return;
                }
                if (savingAccount) return;
                setSavingAccount(true);
                void invokeBackend('admin-create-user', {
                  action: edit.id ? 'update' : 'create',
                  id: edit.id || undefined,
                  email: username ? undefined : edit.email,
                  username,
                  fullName: edit.name,
                  role: edit.role,
                  password: password || undefined,
                  active: edit.active,
                  studentId: edit.studentId,
                  classes: teaching.classes,
                  classAllowedSubjects: teaching.classAllowedSubjects,
                })
                  .then(async () => {
                    await refresh();
                    notify('Login account saved. Share any new password securely.');
                    setEdit(null);
                  })
                  .catch((error: unknown) =>
                    notify(
                      error instanceof Error ? error.message : 'Could not create login account.',
                    ),
                  )
                  .finally(() => setSavingAccount(false));
                return;
              }
              if (
                data.users.some(
                  (u) =>
                    (username
                      ? u.username === username
                      : u.email.toLowerCase() === edit.email.toLowerCase()) && u.id !== edit.id,
                )
              ) {
                notify('This login already belongs to another user.');
                return;
              }
              const user = {
                ...edit,
                ...teaching,
                username,
                email: username ? usernameAuthEmail(username) : edit.email,
                id: edit.id || uid(),
              };
              update(
                (d) => {
                  let next: State = {
                    ...d,
                    users: [...d.users.filter((existing) => existing.id !== user.id), user],
                  };
                  next = adminService.syncTeacherAssignments(next, user, adminUser?.id || 'u1');
                  return next;
                },
                `${user.role === 'Teacher' ? 'Teacher assignment/profile' : 'User profile'} saved: ${user.name}`,
              );
              setEdit(null);
              notify('User profile saved.');
            }}
          >
            <Field label="Full name">
              <input
                required
                value={edit.name}
                onChange={(e) => setEdit({ ...edit, name: e.target.value })}
              />
            </Field>
            <Field
              label="Username"
              hint="3–32 letters, numbers, dots, underscores or hyphens. No @ symbol. Existing email accounts may leave this blank to keep email login."
            >
              <input
                type="text"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                required={!edit.id || !!data.users.find((u) => u.id === edit.id)?.username}
                minLength={3}
                maxLength={32}
                pattern="[a-zA-Z0-9][a-zA-Z0-9._\-]{2,31}"
                value={edit.username || ''}
                onChange={(e) => setEdit({ ...edit, username: e.target.value.toLowerCase() })}
              />
            </Field>
            {edit.id && !edit.username && (
              <Field label="Email address (existing login)">
                <input
                  required
                  type="email"
                  value={edit.email}
                  onChange={(e) => setEdit({ ...edit, email: e.target.value })}
                />
              </Field>
            )}
            {isSupabaseConfigured && (
              <Field
                label={
                  edit.id
                    ? 'New password (leave blank to keep current)'
                    : 'Temporary password (minimum 12 characters)'
                }
              >
                <input
                  required={!edit.id}
                  type="password"
                  name="temporaryPassword"
                  minLength={12}
                  autoComplete="new-password"
                />
              </Field>
            )}
            <div className="form-grid">
              <Field label="Role">
                <select
                  disabled={edit.id === (isSupabaseConfigured ? adminUser?.id : 'u1')}
                  value={edit.role}
                  onChange={(e) => setEdit({ ...edit, role: e.target.value as Role })}
                >
                  {['Administrator', 'Teacher', 'Student', 'Accountant'].map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
              </Field>
              <Field label="Status">
                <select
                  disabled={edit.id === (isSupabaseConfigured ? adminUser?.id : 'u1')}
                  value={edit.active ? 'Active' : 'Inactive'}
                  onChange={(e) => setEdit({ ...edit, active: e.target.value === 'Active' })}
                >
                  <option>Active</option>
                  <option>Inactive</option>
                </select>
              </Field>
            </div>
            {edit.role === 'Student' && (
              <Field label="Linked student record">
                <select
                  required={isSupabaseConfigured}
                  value={edit.studentId || ''}
                  onChange={(e) => setEdit({ ...edit, studentId: e.target.value || undefined })}
                >
                  <option value="">Choose a student</option>
                  {data.students.map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.name} · {student.classId}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            {edit.role === 'Teacher' && (
              <fieldset className="class-checkboxes">
                <legend>Assigned classes</legend>
                {(data.classes || classes).map((c) => (
                  <label key={c}>
                    <input
                      type="checkbox"
                      checked={edit.classes.includes(c)}
                      onChange={(e) => {
                        const restrictions = { ...(edit.classAllowedSubjects || {}) };
                        delete restrictions[c];
                        setEdit({
                          ...edit,
                          classAllowedSubjects: restrictions,
                          classes: e.target.checked
                            ? [...edit.classes, c]
                            : edit.classes.filter((x) => x !== c),
                        });
                      }}
                    />
                    {c}
                  </label>
                ))}
              </fieldset>
            )}
            {edit.role === 'Teacher' && (
              <fieldset className="class-checkboxes">
                <legend>Subject access by class</legend>
                <p className="muted">
                  Choose each class independently: all subjects in one class, and selected subjects
                  in another.
                </p>
                {edit.classes.map((classId) => {
                  const restricted = edit.classAllowedSubjects?.[classId] !== undefined;
                  return (
                    <div key={classId} className="teacher-subject-access">
                      <Field label={`${classId} teaching role`}>
                        <select
                          value={restricted ? 'selected' : 'all'}
                          onChange={(event) => {
                            const next = { ...(edit.classAllowedSubjects || {}) };
                            if (event.target.value === 'selected') next[classId] = [];
                            else delete next[classId];
                            setEdit({ ...edit, classAllowedSubjects: next });
                          }}
                        >
                          <option value="all">All subjects (class teacher)</option>
                          <option value="selected">Selected subjects (subject teacher)</option>
                        </select>
                      </Field>
                      {restricted && (
                        <div className="class-checkboxes teacher-subject-options">
                          {classSubjects(classId).map((subject) => {
                            const subjectId = courseworkSubjectId(subject);
                            const allowed = edit.classAllowedSubjects?.[classId] || [];
                            return (
                              <label key={subjectId}>
                                <input
                                  type="checkbox"
                                  checked={allowed.includes(subjectId) || allowed.includes(subject)}
                                  onChange={(event) =>
                                    setClassSubjectAccess(
                                      edit,
                                      classId,
                                      subjectId,
                                      event.target.checked,
                                    )
                                  }
                                />
                                {subject}
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </fieldset>
            )}
            <div className="modal-actions">
              <Button type="submit" disabled={savingAccount}>
                {isSupabaseConfigured && !edit.id ? 'Create login account' : 'Save user profile'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
      {remove && (
        <Modal title="Remove user profile?" onClose={() => setRemove(null)}>
          <p>
            {isSupabaseConfigured
              ? `Deactivate ${remove.name}'s login and database access? Their historical records will be retained.`
              : `Remove ${remove.name} from the demo team directory?`}
          </p>
          <div className="modal-actions">
            <Button variant="secondary" onClick={() => setRemove(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={savingAccount}
              onClick={() => {
                if (isSupabaseConfigured) {
                  setSavingAccount(true);
                  void invokeBackend('admin-create-user', { action: 'deactivate', id: remove.id })
                    .then(async () => {
                      await refresh();
                      setRemove(null);
                      notify('Account deactivated.');
                    })
                    .catch((error: Error) => notify(error.message))
                    .finally(() => setSavingAccount(false));
                  return;
                }
                update(
                  (d) => ({ ...d, users: d.users.filter((u) => u.id !== remove.id) }),
                  'User profile removed',
                );
                setRemove(null);
                notify('User profile removed.');
              }}
            >
              Remove profile
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
export function Audit() {
  const { data } = useStore();
  const [q, setQ] = useState('');
  const logs = data.logs.filter((l) =>
    (l.action + l.actor + l.type).toLowerCase().includes(q.toLowerCase()),
  );
  return (
    <>
      <PageHeader
        eyebrow="A CLEARER PICTURE"
        title="Activity log"
        description="A chronological record of changes in this demo workspace."
        actions={
          <Button
            variant="secondary"
            onClick={() =>
              csv('activity-log.csv', [
                ['Time', 'User', 'Action', 'Type'],
                ...logs.map((l) => [l.date, l.actor, l.action, l.type]),
              ])
            }
          >
            <Download size={16} />
            Export log
          </Button>
        }
      />
      <Card>
        <div className="filter-bar">
          <SearchBox value={q} onChange={setQ} placeholder="Search activities or people..." />
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Activity</th>
                <th>User</th>
                <th>Time</th>
                <th>Type</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id}>
                  <td>
                    <strong>{l.action}</strong>
                  </td>
                  <td>{l.actor}</td>
                  <td>{new Date(l.date).toLocaleString()}</td>
                  <td>
                    <Badge tone="blue">{l.type}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!logs.length && <Empty title="No matching activity" />}
      </Card>
      <p className="muted">
        {isSupabaseConfigured
          ? 'These events are recorded by the backend with the authenticated actor and server timestamp.'
          : 'This browser-local activity log is a demo.'}
      </p>
    </>
  );
}
