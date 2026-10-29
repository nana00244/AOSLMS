// Opt-in live Learning Hub verification. Creates and removes only unique test fixtures.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { randomBytes, randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
const project = JSON.parse(readFileSync('src/supabase-project.json', 'utf8'));
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const shell = process.platform === 'win32' ? 'cmd.exe' : 'sh';
const command =
  'npx --yes supabase projects api-keys --project-ref itqfnzqksuacbeemrqok --output json --agent no';
const keys = JSON.parse(
  execFileSync(
    shell,
    process.platform === 'win32' ? ['/d', '/s', '/c', command] : ['-c', command],
    { encoding: 'utf8' },
  ),
);
const key = (Array.isArray(keys) ? keys : keys.api_keys).find(
  (k) => k.name === 'service_role',
).api_key;
const service = createClient(project.url, key, options);
const makeClient = () => createClient(project.url, project.publishableKey, options);
const suffix = randomUUID().slice(0, 8);
const cls = `HUB-${suffix}`,
  otherClass = `HUB-OTHER-${suffix}`;
const studentIds = [`HUB-A-${suffix}`, `HUB-B-${suffix}`];
const accountIds = [],
  lessonIds = [],
  assignmentIds = [];
let admin,
  fixtures = false;
async function call(client, name, body, denied = false) {
  const result = await client.functions.invoke(name, { body });
  if (denied) {
    assert(result.error || result.data?.error, `Expected ${body.action} to be denied`);
    return;
  }
  if (result.error)
    throw new Error(
      result.error.context instanceof Response
        ? await result.error.context.text()
        : result.error.message,
    );
  assert(!result.data?.error, result.data?.error);
  return result.data;
}
const hub = (client, body, denied) => call(client, 'learning-hub', body, denied);
const workspace = (body) => call(admin, 'workspace', body);
async function account(role, studentId, classes = []) {
  const email = `hub-${role.toLowerCase()}-${randomUUID()}@example.com`;
  const password = `${randomBytes(24).toString('base64url')}!aA7`;
  const result = await service.auth.admin.createUser({ email, password, email_confirm: true });
  if (result.error) throw result.error;
  const id = result.data.user.id;
  accountIds.push(id);
  const updated = await service
    .from('profiles')
    .update({
      full_name: `Hub verification ${role}`,
      role,
      active: true,
      student_id: studentId || null,
      classes,
    })
    .eq('id', id);
  if (updated.error) throw updated.error;
  const client = makeClient();
  const signed = await client.auth.signInWithPassword({ email, password });
  if (signed.error) throw signed.error;
  return { client, id };
}
try {
  admin = (await account('Administrator')).client;
  const initial = await workspace({ action: 'load' });
  await workspace({
    action: 'save',
    revision: initial.revision,
    changes: [
      {
        collection: 'classes',
        id: 'singleton',
        before: initial.state.classes,
        after: [...initial.state.classes, cls, otherClass],
      },
      ...studentIds.map((id, index) => ({
        collection: 'students',
        id,
        after: {
          id,
          name: `Hub pupil ${index + 1}`,
          classId: cls,
          gender: '',
          dob: '',
          guardian: '',
          phone: '',
          status: 'Active',
          enrolled: '2026-10-28',
        },
      })),
    ],
    event: 'Learning Hub verification setup',
  });
  fixtures = true;
  const teacher = await account('Teacher', undefined, [cls]);
  const outsider = await account('Teacher', undefined, [otherClass]);
  const pupilA = await account('Student', studentIds[0]);
  const pupilB = await account('Student', studentIds[1]);
  const finance = await account('Accountant');
  const lessonInput = {
    title: `Synthetic mathematics ${suffix}`,
    subject: 'Mathematics',
    level: 'B7',
    strand: 'Number',
    standard: 'Synthetic verification standard',
    description: 'Test-only lesson for checking secure assignment and grading.',
    body: ['Two groups of three objects make six objects.'],
    sourceUrl: 'https://nacca.gov.gh/',
    sourceTitle: 'NaCCA',
    questions: [
      {
        id: 'q1',
        prompt: 'What is 3 + 3?',
        options: ['5', '6', '9'],
        answer: 1,
        explanation: 'Adding three to three gives six.',
      },
      {
        id: 'q2',
        prompt: 'What is 2 × 3?',
        options: ['6', '5', '8'],
        answer: 0,
        explanation: 'Two equal groups of three total six.',
      },
    ],
  };
  const lesson = await hub(teacher.client, { action: 'create-lesson', lesson: lessonInput });
  lessonIds.push(lesson.id);
  await hub(pupilA.client, { action: 'create-lesson', lesson: lessonInput }, true);
  await hub(finance.client, { action: 'load' }, true);
  await hub(makeClient(), { action: 'load' }, true);
  const dueDate = '2026-12-20';
  await hub(
    outsider.client,
    { action: 'assign', lessonId: lesson.id, classId: cls, dueDate },
    true,
  );
  const classAssignment = await hub(teacher.client, {
    action: 'assign',
    lessonId: lesson.id,
    classId: cls,
    dueDate,
  });
  assignmentIds.push(classAssignment.id);
  assert.deepEqual([...classAssignment.studentIds].sort(), [...studentIds].sort());
  const individual = await hub(teacher.client, {
    action: 'assign',
    lessonId: lesson.id,
    classId: cls,
    studentIds: [studentIds[0]],
    dueDate,
  });
  assignmentIds.push(individual.id);
  const aBefore = await hub(pupilA.client, { action: 'load' });
  const bBefore = await hub(pupilB.client, { action: 'load' });
  assert(aBefore.assignments.some((a) => a.id === individual.id));
  assert(!bBefore.assignments.some((a) => a.id === individual.id));
  assert(
    aBefore.lessons
      .find((l) => l.id === lesson.id)
      .questions.every((q) => !('answer' in q) && !('explanation' in q)),
  );
  await hub(
    pupilB.client,
    {
      action: 'submit-practice',
      lessonId: lesson.id,
      assignmentId: individual.id,
      answers: [1, 0],
    },
    true,
  );
  await hub(pupilA.client, { action: 'assign', lessonId: lesson.id, classId: cls, dueDate }, true);
  await hub(
    pupilA.client,
    {
      action: 'submit-practice',
      lessonId: lesson.id,
      assignmentId: classAssignment.id,
      answers: [1, 1],
      score: 100,
    },
    true,
  );
  const reading = await hub(pupilA.client, {
    action: 'complete-reading',
    lessonId: lesson.id,
    assignmentId: classAssignment.id,
  });
  assert.equal(reading.studentId, studentIds[0]);
  const first = await hub(pupilA.client, {
    action: 'submit-practice',
    lessonId: lesson.id,
    assignmentId: classAssignment.id,
    answers: [1, 1],
  });
  assert.equal(first.attempt.score, 50);
  assert.equal(first.attempt.correct, 1);
  assert.equal(first.feedback[1].correct, false);
  const second = await hub(pupilA.client, {
    action: 'submit-practice',
    lessonId: lesson.id,
    assignmentId: classAssignment.id,
    answers: [1, 0],
  });
  assert.equal(second.attempt.score, 100);
  const staffView = await hub(teacher.client, { action: 'load' });
  assert.equal(staffView.attempts.filter((a) => a.lessonId === lesson.id).length, 2);
  assert(staffView.readings.some((r) => r.id === reading.id));
  const privateView = await hub(pupilB.client, { action: 'load' });
  assert(!privateView.attempts.some((a) => a.studentId === studentIds[0]));
  const unrelated = await hub(outsider.client, { action: 'load' });
  assert(!unrelated.assignments.some((a) => assignmentIds.includes(a.id)));
  assert(!unrelated.attempts.some((a) => a.lessonId === lesson.id));
  const direct = await pupilA.client
    .from('learning_hub_attempts')
    .insert({ lesson_id: lesson.id, student_id: studentIds[0], score: 100, correct: 2, total: 2 });
  assert(direct.error, 'Direct client attempts writes must be denied');
  const disabled = await service.from('profiles').update({ active: false }).eq('id', pupilA.id);
  if (disabled.error) throw disabled.error;
  await hub(pupilA.client, { action: 'load' }, true);
  console.log(
    'PASS: Learning Hub authoring, class/individual assignments, reading completion, server-scored retries, teacher progress, answer redaction, student privacy, role/class restrictions and direct-write protection.',
  );
} finally {
  for (const table of [
    'learning_hub_readings',
    'learning_hub_attempts',
    'learning_hub_assignments',
  ]) {
    if (lessonIds.length) {
      const result = await service.from(table).delete().in('lesson_id', lessonIds);
      if (result.error) throw result.error;
    }
  }
  if (lessonIds.length) {
    const result = await service.from('learning_hub_lessons').delete().in('id', lessonIds);
    if (result.error) throw result.error;
  }
  if (fixtures) {
    const current = await workspace({ action: 'load' });
    await workspace({
      action: 'save',
      revision: current.revision,
      changes: [
        {
          collection: 'classes',
          id: 'singleton',
          before: current.state.classes,
          after: current.state.classes.filter((c) => c !== cls && c !== otherClass),
        },
        ...current.state.students
          .filter((s) => studentIds.includes(s.id))
          .map((s) => ({ collection: 'students', id: s.id, before: s })),
      ],
      event: 'Learning Hub verification cleanup',
    });
  }
  for (const id of accountIds.reverse()) {
    const result = await service.auth.admin.deleteUser(id);
    if (result.error) throw result.error;
  }
  console.log('Learning Hub temporary fixtures removed.');
}
