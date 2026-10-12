import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { randomBytes, randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { changesBetween } from '../src/backendAccess';
import { parseScoreCsv } from '../src/scoreSheetParser';

test('teacher score sheet upload persists marks and updates an open report in realtime', async ({
  page,
  browser,
}) => {
  test.skip(!process.env.AOS_TEST_SERVICE_KEY, 'Requires isolated live verification credentials');
  test.setTimeout(150000);
  const project = JSON.parse(readFileSync('src/supabase-project.json', 'utf8'));
  const credentials = JSON.parse(readFileSync(process.env.AOS_TEST_CREDENTIALS!, 'utf8'));
  const options = { auth: { persistSession: false, autoRefreshToken: false } };
  const admin = createClient(project.url, project.publishableKey, options);
  const service = createClient(project.url, process.env.AOS_TEST_SERVICE_KEY!, options);
  const teacher = createClient(project.url, project.publishableKey, options);
  const signed = await admin.auth.signInWithPassword(credentials);
  if (signed.error) throw signed.error;
  async function load() {
    const result = await admin.functions.invoke('workspace', { body: { action: 'load' } });
    if (result.error) throw result.error;
    return result.data;
  }
  async function mutate(fn: (state: any) => any) {
    for (let attempt = 0; attempt < 4; attempt++) {
      const current = await load();
      const result = await admin.functions.invoke('workspace', {
        body: {
          action: 'save',
          revision: current.revision,
          changes: changesBetween(current.state, fn(structuredClone(current.state))),
          event: 'Isolated score upload verification',
        },
      });
      if (!result.error) return result.data;
      if (attempt === 3) throw result.error;
    }
  }
  const suffix = randomUUID().slice(0, 8);
  const cls = `JHS 1 - SCORE-${suffix}`,
    sid = `SCORE-${suffix}`;
  const email = `score-${suffix}@example.com`,
    password = `${randomBytes(20).toString('base64url')}!aA7`;
  const initial = await load();
  const term = initial.state.settings.term;
  const key = `${sid}|${term}|English Language`;
  const teacherContext = await browser.newContext();
  let teacherId = '';
  try {
    await mutate((state) => ({
      ...state,
      classes: [...state.classes, cls],
      students: [
        ...state.students,
        {
          id: sid,
          name: 'Score Test Learner',
          classId: cls,
          gender: '',
          dob: '',
          guardian: '',
          phone: '',
          status: 'Active',
          enrolled: '2026-10-12',
        },
      ],
      grades: { ...state.grades, [key]: { sba: 0, exam: 25, remark: 'Preserved' } },
    }));
    const created = await service.auth.admin.createUser({ email, password, email_confirm: true });
    if (created.error) throw created.error;
    teacherId = created.data.user.id;
    const profile = await service
      .from('profiles')
      .update({
        full_name: 'Score upload test teacher',
        role: 'Teacher',
        active: true,
        classes: [cls],
        class_allowed_subjects: { [cls]: ['sub_eng'] },
      })
      .eq('id', teacherId);
    if (profile.error) throw profile.error;
    const login = await teacher.auth.signInWithPassword({ email, password });
    if (login.error) throw login.error;
    await page.goto('/');
    await page.getByLabel('Username or email').fill(credentials.email);
    await page.getByLabel('Password', { exact: true }).fill(credentials.password);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page.getByRole('navigation').first()).toBeVisible({ timeout: 30000 });
    await page.goto(`/#/reports?student=${sid}`);
    const reportRow = page
      .locator('.assessment-table tbody tr')
      .filter({ hasText: 'English Language' });
    await expect(reportRow.locator('td').nth(2)).toHaveText('25');
    const teacherPage = await teacherContext.newPage();
    await teacherPage.goto('/');
    await teacherPage.getByLabel('Username or email').fill(email);
    await teacherPage.getByLabel('Password', { exact: true }).fill(password);
    await teacherPage.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(teacherPage.getByRole('navigation').first()).toBeVisible({ timeout: 30000 });
    await teacherPage.goto('/#/coursework');
    await expect(
      teacherPage.getByRole('button', { name: 'Open Excel grading sheet' }).first(),
    ).toBeVisible({ timeout: 30000 });
    const text = `Subject,English Language,Class,${cls}\nAssessment Category,Class Exercises,Term,Term ${term}\nStudent Name,Admission Number,EXE1 (/15),EXE2 (/15),EXE3 (/15)\nScore Test Learner,${sid},[ABS],11,14`;
    async function upload(content: string) {
      await teacherPage.getByRole('button', { name: 'Upload score sheet', exact: true }).click();
      await teacherPage
        .getByLabel('Assessment score sheet (.csv or .xlsx)')
        .setInputFiles({ name: 'scores.csv', mimeType: 'text/csv', buffer: Buffer.from(content) });
      await expect(teacherPage.getByLabel('Matched class')).toHaveValue(cls);
      await expect(teacherPage.getByLabel('Matched subject')).toHaveValue('English Language');
      await expect(teacherPage.getByLabel('Student match for row 1')).toHaveValue(sid);
      await teacherPage.screenshot({
        path: 'test-results/score-upload-preview.png',
        fullPage: true,
      });
      await teacherPage
        .getByRole('button', { name: 'Save scores and update report cards', exact: true })
        .click();
      await expect(
        teacherPage.getByText('Score sheet saved. Subject cards and report cards are updated.', {
          exact: true,
        }),
      ).toBeVisible({ timeout: 30000 });
    }
    await upload(text);
    // This tab stays open throughout the upload; the 15s deadline is shorter than fallback polling.
    await expect(reportRow.locator('td').nth(1)).toHaveText('11', { timeout: 15000 });
    await expect(reportRow.locator('td').nth(3)).toHaveText('36');
    let stored = await service
      .from('school_workspace')
      .select('document,revision')
      .eq('id', true)
      .single();
    if (stored.error) throw stored.error;
    const assignmentId = `cc_${cls}_English_Language_exercise_term${term}`;
    const card = stored.data.document.assignments.find((a: any) => a.id === assignmentId);
    expect(card.slotScores[sid].EXE1.feedbackType).toBe('absent');
    expect(card.slotScores[sid].EXE2.score).toBe(11);
    expect(stored.data.document.grades[key]).toEqual({ sba: 11, exam: 25, remark: 'Preserved' });
    const revision = await teacher.from('workspace_revisions').select('*').single();
    expect(revision.error).toBeNull();
    expect(revision.data?.revision).toBe(stored.data.revision);
    const privateRead = await teacher.from('school_workspace').select('*');
    expect(privateRead.error).not.toBeNull();
    const body = {
      action: 'import-scores',
      revision: stored.data.revision,
      request: {
        sheet: parseScoreCsv(text),
        classId: cls,
        subject: 'Mathematics',
        studentOverrides: {},
      },
    };
    const denied = await teacher.functions.invoke('workspace', { body });
    expect(denied.error).not.toBeNull();
    stored = await service
      .from('school_workspace')
      .select('document,revision')
      .eq('id', true)
      .single();
    expect(stored.data?.revision).toBe(body.revision);
    // Repeat upload replaces marks without creating duplicate slots/cards.
    const openExerciseCard = teacherPage
      .locator('.assignment-card')
      .filter({ hasText: 'Class Exercises' });
    await openExerciseCard.getByRole('button', { name: 'Open Excel grading sheet' }).click();
    await expect(
      teacherPage.locator(`input[name="score-${assignmentId}-EXE2-${sid}"]`),
    ).toHaveValue('11');
    await upload(text.replace(',11,14', ',15,15'));
    await expect(
      teacherPage.locator(`input[name="score-${assignmentId}-EXE2-${sid}"]`),
    ).toHaveValue('15');
    await expect(reportRow.locator('td').nth(1)).toHaveText('13', { timeout: 15000 });
    stored = await service
      .from('school_workspace')
      .select('document,revision')
      .eq('id', true)
      .single();
    expect(
      stored.data?.document.assignments.filter((a: any) => a.id === assignmentId),
    ).toHaveLength(1);
    await teacherPage.reload();
    await expect(
      teacherPage.getByRole('button', { name: 'Upload score sheet', exact: true }),
    ).toBeVisible({ timeout: 30000 });
    const exerciseCard = teacherPage
      .locator('.assignment-card')
      .filter({ hasText: 'Class Exercises' });
    await exerciseCard.getByRole('button', { name: 'Open Excel grading sheet' }).click();
    await expect(
      teacherPage.locator(`input[name="score-${assignmentId}-EXE2-${sid}"]`),
    ).toHaveValue('15');
    await teacherPage.screenshot({ path: 'test-results/score-upload-grid.png', fullPage: true });
  } finally {
    await teacherContext.close();
    await page.close();
    await teacher.auth.signOut({ scope: 'local' });
    if (teacherId) {
      const removed = await service.auth.admin.deleteUser(teacherId);
      if (removed.error) throw removed.error;
    }
    await mutate((state) => ({
      ...state,
      classes: state.classes.filter((c: string) => c !== cls),
      students: state.students.filter((s: any) => s.id !== sid),
      assignments: state.assignments.filter((a: any) => a.classId !== cls),
      grades: Object.fromEntries(
        Object.entries(state.grades).filter(([k]) => !k.startsWith(`${sid}|`)),
      ),
    }));
    await admin.auth.signOut({ scope: 'local' });
  }
});

test('admin creates a plain username and mixed teaching assignments through the form', async ({
  page,
  browser,
}) => {
  test.skip(
    !process.env.AOS_TEST_SERVICE_KEY,
    'Run with verify-with-temporary-admin.mjs for isolated account cleanup.',
  );
  test.setTimeout(90000);
  const project = JSON.parse(readFileSync('src/supabase-project.json', 'utf8'));
  const credentials = JSON.parse(
    readFileSync(process.env.AOS_TEST_CREDENTIALS || '.temp/admin-credentials.json', 'utf8'),
  );
  const options = { auth: { persistSession: false, autoRefreshToken: false } };
  const admin = createClient(project.url, project.publishableKey, options);
  const service = createClient(project.url, process.env.AOS_TEST_SERVICE_KEY!, options);
  const signed = await admin.auth.signInWithPassword(credentials);
  if (signed.error) throw signed.error;
  const suffix = randomUUID().slice(0, 8);
  const username = `browser-${suffix}`;
  const password = `${randomBytes(18).toString('base64url')}!aA7`;
  const classNames = [`UI-A-${suffix}`, `UI-B-${suffix}`];
  async function workspace(body: object) {
    const { data, error } = await admin.functions.invoke('workspace', { body });
    if (error) throw error;
    return data;
  }
  const initial = await workspace({ action: 'load' });
  await workspace({
    action: 'save',
    revision: initial.revision,
    changes: [
      {
        collection: 'classes',
        id: 'singleton',
        before: initial.state.classes,
        after: [...initial.state.classes, ...classNames],
      },
    ],
  });
  const teacherContext = await browser.newContext();
  try {
    await page.goto('/');
    await page.getByLabel('Username or email').fill(credentials.email);
    await page.getByLabel('Password', { exact: true }).fill(credentials.password);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page.getByRole('navigation').first()).toBeVisible({ timeout: 30000 });
    await page.goto('/#/users');
    await page.getByRole('button', { name: 'Add user', exact: true }).click();
    await page.getByLabel('Full name', { exact: true }).fill(`Browser teacher ${suffix}`);
    await page.getByLabel('Username', { exact: true }).fill(username);
    await page.getByLabel('Temporary password (minimum 12 characters)').fill(password);
    for (const className of classNames) await page.getByLabel(className, { exact: true }).check();
    await expect(page.getByLabel(`${classNames[0]} teaching role`)).toHaveValue('all');
    await page.getByLabel(`${classNames[1]} teaching role`).selectOption('selected');
    await page.getByLabel('Mathematics', { exact: true }).check();
    await page.getByRole('button', { name: 'Create login account', exact: true }).click();
    await expect(page.getByText('Login account saved.', { exact: false })).toBeVisible({
      timeout: 30000,
    });
    const state = await workspace({ action: 'load' });
    const teacher = state.state.users.find((u: { username?: string }) => u.username === username);
    expect(teacher.classes).toEqual(classNames);
    expect(teacher.classAllowedSubjects).toEqual({ [classNames[1]]: ['sub_math'] });
    const teacherPage = await teacherContext.newPage();
    await teacherPage.goto('http://127.0.0.1:5173/');
    await teacherPage.getByLabel('Username or email').fill(username);
    await teacherPage.getByLabel('Password', { exact: true }).fill(password);
    await teacherPage.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(teacherPage.getByRole('navigation').first()).toBeVisible({ timeout: 30000 });
    await teacherPage.reload();
    await expect(teacherPage.getByRole('navigation').first()).toBeVisible({ timeout: 30000 });
  } finally {
    await teacherContext.close();
    const lookup = await service
      .from('profiles')
      .select('id')
      .eq('username', username)
      .maybeSingle();
    if (lookup.error) throw lookup.error;
    if (lookup.data) {
      const deleted = await service.auth.admin.deleteUser(lookup.data.id);
      if (deleted.error) throw deleted.error;
    }
    const current = await workspace({ action: 'load' });
    await workspace({
      action: 'save',
      revision: current.revision,
      changes: [
        {
          collection: 'classes',
          id: 'singleton',
          before: current.state.classes,
          after: current.state.classes.filter((c: string) => !classNames.includes(c)),
        },
      ],
    });
    await admin.auth.signOut({ scope: 'local' });
  }
});

test('administrator signs in, reloads cloud data, and navigates the empty school', async ({
  page,
}) => {
  const credentials = JSON.parse(
    readFileSync(process.env.AOS_TEST_CREDENTIALS || '.temp/admin-credentials.json', 'utf8'),
  );
  const errors: string[] = [];
  page.on('pageerror', (error) => {
    errors.push(error.message);
    console.log('Page error:', error.message);
  });
  await page.goto('/');
  await page.getByLabel('Username or email').fill(credentials.email);
  await page.getByLabel('Password', { exact: true }).fill(credentials.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('navigation').first()).toBeVisible({ timeout: 30000 });
  await page.reload();
  await expect(page.getByRole('navigation').first()).toBeVisible({ timeout: 30000 });
  for (const route of [
    'students',
    'community',
    'users',
    'finance',
    'payroll',
    'attendance',
    'coursework',
    'reports',
    'resources',
    'timetable',
    'settings',
  ]) {
    await page.goto(`/#/${route}`);
    console.log('Checking screen:', route);
    await expect(page.locator('main')).toBeVisible();
  }
  expect(errors).toEqual([]);
  await page.screenshot({ path: 'test-results/cloud-admin.png', fullPage: true });
});
