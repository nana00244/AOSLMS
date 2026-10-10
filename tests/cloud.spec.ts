import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { randomBytes, randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

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
