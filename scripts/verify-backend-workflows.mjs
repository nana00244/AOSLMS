// Opt-in live integration test. Uses unique fixtures and removes only its own accounts/records.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { randomBytes, randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .trim()
    .split(/\r?\n/)
    .map((line) => {
      const i = line.indexOf('=');
      return [line.slice(0, i), line.slice(i + 1)];
    }),
);
const creds = JSON.parse(
  readFileSync(process.env.AOS_TEST_CREDENTIALS || '.temp/admin-credentials.json', 'utf8'),
);
const makeClient = () =>
  createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
const admin = makeClient();
const signedIn = await admin.auth.signInWithPassword(creds);
if (signedIn.error) throw signedIn.error;
const command =
  'npx --yes supabase projects api-keys --project-ref itqfnzqksuacbeemrqok --output json --agent no';
const raw = execFileSync(
  process.platform === 'win32' ? 'cmd.exe' : 'sh',
  process.platform === 'win32' ? ['/d', '/s', '/c', command] : ['-c', command],
  { encoding: 'utf8' },
);
const parsed = JSON.parse(raw);
const serviceKey = (Array.isArray(parsed) ? parsed : parsed.api_keys).find(
  (k) => k.name === 'service_role',
).api_key;
const service = createClient(env.VITE_SUPABASE_URL, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
async function call(client, name, body, reject = false) {
  const { data, error } = await client.functions.invoke(name, { body });
  if (reject) {
    assert(error || data?.error, 'Expected request to be denied');
    return;
  }
  if (error)
    throw new Error(error.context instanceof Response ? await error.context.text() : error.message);
  assert(!data.error, data.error);
  return data;
}
const load = (c) => call(c, 'workspace', { action: 'load' });
const save = async (c, changes) => {
  const s = await load(c);
  return call(c, 'workspace', {
    action: 'save',
    revision: s.revision,
    changes,
    event: 'Backend integration test',
  });
};
const suffix = randomUUID().slice(0, 8);
const cls = `TEST-${suffix}`;
const subjectClass = `TEST-SUBJECT-${suffix}`;
const sid = `TEST-STUDENT-${suffix}`;
const aid = `TEST-ASSIGNMENT-${suffix}`;
const student = {
  id: sid,
  name: 'Integration Test Student',
  classId: cls,
  gender: '',
  dob: '',
  guardian: '',
  phone: '',
  status: 'Active',
  enrolled: '2026-10-10',
};
const assignment = {
  id: aid,
  title: 'Integration test',
  classId: cls,
  subject: 'Mathematics',
  points: 10,
  due: '2026-10-31',
  description: '',
  category: 'Homework',
};
const ids = [];
const sessions = [admin];
const uploadedPaths = [];
let fixtures = false;
try {
  const start = await load(admin);
  await save(admin, [
    {
      collection: 'classes',
      id: 'singleton',
      before: start.state.classes,
      after: [...start.state.classes, cls, subjectClass],
    },
    { collection: 'students', id: sid, after: student },
    { collection: 'assignments', id: aid, after: assignment },
  ]);
  fixtures = true;
  const accounts = {};
  for (const role of ['Student', 'Teacher', 'Accountant']) {
    const username = `test-${suffix}-${role.toLowerCase()}`;
    const email = `${username}@users.aoslms.invalid`;
    const password = `${randomBytes(18).toString('base64url')}!aA7`;
    const result = await call(admin, 'admin-create-user', {
      username,
      password,
      fullName: `Integration ${role}`,
      role,
      studentId: role === 'Student' ? sid : undefined,
      classes: role === 'Teacher' ? [cls, subjectClass] : [],
      classAllowedSubjects: role === 'Teacher' ? { [subjectClass]: ['sub_math'] } : {},
    });
    ids.push(result.user.id);
    const client = makeClient();
    sessions.push(client);
    const login = await client.auth.signInWithPassword({ email, password });
    if (login.error) throw login.error;
    assert.equal(result.user.username, username);
    accounts[role] = { client, id: result.user.id, email, username };
  }
  const teacherAccount = accounts.Teacher;
  const teacherProfile = (await load(teacherAccount.client)).state.users.find(
    (u) => u.id === teacherAccount.id,
  );
  assert.deepEqual(teacherProfile.classes, [cls, subjectClass]);
  assert.deepEqual(teacherProfile.classAllowedSubjects, { [subjectClass]: ['sub_math'] });
  const template = {
    username: teacherAccount.username.toUpperCase(),
    password: `${randomBytes(18).toString('base64url')}!aA7`,
    fullName: 'Rejected duplicate',
    role: 'Teacher',
  };
  await call(admin, 'admin-create-user', template, true);
  await call(admin, 'admin-create-user', { ...template, username: 'invalid@username' }, true);
  await call(
    admin,
    'admin-create-user',
    {
      ...template,
      username: `invalid-${suffix}`,
      classes: [subjectClass],
      classAllowedSubjects: { [subjectClass]: [] },
    },
    true,
  );
  for (const [classId, subject, allowed] of [
    [cls, 'English Language', true],
    [subjectClass, 'Mathematics', true],
    [subjectClass, 'English Language', false],
  ]) {
    const record = { ...assignment, id: `TEST-${suffix}-${classId}-${subject}`, classId, subject };
    const current = await load(teacherAccount.client);
    await call(
      teacherAccount.client,
      'workspace',
      {
        action: 'save',
        revision: current.revision,
        changes: [{ collection: 'assignments', id: record.id, after: record }],
      },
      !allowed,
    );
  }
  const hidden = {
    ...assignment,
    id: `TEST-${suffix}-hidden`,
    classId: subjectClass,
    subject: 'English Language',
  };
  await save(admin, [{ collection: 'assignments', id: hidden.id, after: hidden }]);
  assert(!(await load(teacherAccount.client)).state.assignments.some((a) => a.id === hidden.id));
  const newUsername = `renamed-${suffix}`;
  const newPassword = `${randomBytes(18).toString('base64url')}!aA7`;
  await call(admin, 'admin-create-user', {
    action: 'update',
    id: teacherAccount.id,
    username: newUsername,
    password: newPassword,
    fullName: 'Integration Teacher',
    role: 'Teacher',
    classes: [cls, subjectClass],
    classAllowedSubjects: { [subjectClass]: ['sub_math'] },
  });
  const relogin = await teacherAccount.client.auth.signInWithPassword({
    email: `${newUsername}@users.aoslms.invalid`,
    password: newPassword,
  });
  if (relogin.error) throw relogin.error;
  const rejectedLogin = await makeClient().auth.signInWithPassword({
    email: teacherAccount.email,
    password: newPassword,
  });
  assert(rejectedLogin.error, 'Renamed username must invalidate old login');
  console.log(
    'PASS: plain username creation/login for all roles, duplicate/invalid username rejection, username rename/password reset, all-subject and subject-only classes on the same teacher, denied out-of-subject reads/writes.',
  );
  const learner = accounts.Student.client;
  const view = await load(learner);
  assert.deepEqual(
    view.state.students.map((s) => s.id),
    [sid],
  );
  assert.equal(view.state.users.length, 1);
  const path = `${accounts.Student.id}/${randomUUID()}/verification.txt`;
  const upload = await learner.storage
    .from('learning-files')
    .upload(path, new Blob(['Private test file'], { type: 'text/plain' }));
  if (upload.error) throw upload.error;
  uploadedPaths.push(path);
  const submission = {
    id: `TEST-SUBMISSION-${suffix}`,
    assignmentId: aid,
    studentId: sid,
    text: 'Verified cloud work',
    link: '',
    date: new Date().toISOString(),
    filename: 'verification.txt',
    storagePath: path,
  };
  await save(learner, [{ collection: 'submissions', id: submission.id, after: submission }]);
  const teacherState = await load(accounts.Teacher.client);
  const storedSubmission = teacherState.state.submissions.find((s) => s.id === submission.id);
  assert.equal(storedSubmission.text, submission.text);
  const signedFile = await call(accounts.Teacher.client, 'workspace', { action: 'file-url', path });
  assert.equal(await (await fetch(signedFile.url)).text(), 'Private test file');
  await call(accounts.Accountant.client, 'workspace', { action: 'file-url', path }, true);
  await save(accounts.Teacher.client, [
    {
      collection: 'submissions',
      id: submission.id,
      before: storedSubmission,
      after: { ...storedSubmission, score: 8, feedback: 'Verified' },
    },
  ]);
  assert.equal((await load(learner)).state.submissions[0].score, 8);
  const current = await load(learner);
  await call(
    learner,
    'workspace',
    {
      action: 'save',
      revision: current.revision,
      changes: [
        {
          collection: 'submissions',
          id: submission.id,
          before: current.state.submissions[0],
          after: { ...current.state.submissions[0], score: 10 },
        },
      ],
    },
    true,
  );
  await call(
    learner,
    'admin-create-user',
    {
      email: 'forged@example.com',
      password: 'DeniedPassword123!',
      role: 'Administrator',
      fullName: 'Denied',
    },
    true,
  );
  const payment = {
    id: `TEST-PAYMENT-${suffix}`,
    studentId: sid,
    amount: 25,
    method: 'Cash',
    date: '2026-10-10',
    notes: '',
    term: 1,
  };
  await save(accounts.Accountant.client, [
    { collection: 'payments', id: payment.id, after: payment },
  ]);
  assert.equal((await load(learner)).state.payments[0].amount, 25);
  const stale = await load(admin);
  await save(admin, [
    {
      collection: 'settings',
      id: 'singleton',
      before: stale.state.settings,
      after: { ...stale.state.settings },
    },
  ]);
  await call(admin, 'workspace', { action: 'save', revision: stale.revision, changes: [] }, true);
  await call(admin, 'admin-create-user', { action: 'deactivate', id: accounts.Student.id });
  await call(learner, 'workspace', { action: 'load' }, true);
  console.log(
    'PASS: admin-created student/teacher/accountant logins; cross-session persistence; private upload and authorized download; accountant file access denied; student submission; teacher grading; student self-grading denied; admin endpoint denied to student; finance payment; stale-save rejection; immediate deactivation.',
  );
} finally {
  if (uploadedPaths.length) {
    const { error } = await service.storage.from('learning-files').remove(uploadedPaths);
    if (error) throw error;
  }
  for (const id of ids) {
    const { error } = await service.auth.admin.deleteUser(id);
    if (error) throw error;
  }
  if (fixtures) {
    const current = await load(admin);
    const changes = [
      {
        collection: 'classes',
        id: 'singleton',
        before: current.state.classes,
        after: current.state.classes.filter((c) => c !== cls && c !== subjectClass),
      },
    ];
    for (const key of ['students', 'assignments', 'submissions', 'payments'])
      for (const record of current.state[key]) {
        if (record.id.includes(suffix))
          changes.push({ collection: key, id: record.id, before: record });
      }
    await call(admin, 'workspace', {
      action: 'save',
      revision: current.revision,
      changes,
      event: 'Integration test fixtures removed',
    });
  }
  for (const session of sessions) await session.auth.signOut({ scope: 'local' });
}
