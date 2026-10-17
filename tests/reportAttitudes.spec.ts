import { test, expect } from '@playwright/test';
import { emptyState } from '../src/emptyState';
import { attitudeItems } from '../src/reportAttitudes';
import { applyChanges } from '../src/backendAccess';
import { workspaceSchema } from '../src/validation';

test('report attitude dropdowns save, reopen, print and remain term-specific', async ({
  page,
}, testInfo) => {
  const owner = '00000000-0000-4000-8000-000000000001';
  let state = emptyState();
  state.settings.year = '2026/2027';
  state.users = [
    {
      id: owner,
      name: 'Test Admin',
      email: 'test@example.test',
      role: 'Administrator',
      active: true,
      classes: [],
    },
  ];
  state.classes = ['BS 1'];
  state.students = [
    {
      id: 'S1',
      name: 'Synthetic Pupil',
      classId: 'BS 1',
      gender: '',
      dob: '',
      guardian: '',
      phone: '',
      status: 'Active',
      enrolled: '2026-10-17',
    },
  ];
  let revision = 1;
  let saveRequests = 0;
  await page.routeWebSocket('**', (socket) => socket.close());
  await page.addInitScript(
    ({ owner }) => {
      localStorage.setItem(
        'sb-itqfnzqksuacbeemrqok-auth-token',
        JSON.stringify({
          access_token: 'test-token',
          refresh_token: 'test-refresh',
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          token_type: 'bearer',
          user: {
            id: owner,
            email: 'test@example.test',
            aud: 'authenticated',
            role: 'authenticated',
          },
        }),
      );
    },
    { owner },
  );
  await page.route('https://*.supabase.co/**', async (route) => {
    if (!route.request().url().includes('/functions/v1/workspace'))
      return route.fulfill({ json: {} });
    const body = route.request().postDataJSON();
    if (body.action === 'load') return route.fulfill({ json: { state, revision } });
    expect(['save-pending', 'save-batch']).toContain(body.action);
    saveRequests++;
    for (const save of body.saves || [body]) {
      state = workspaceSchema.parse(
        applyChanges(state, state.users[0], save.changes),
      ) as typeof state;
    }
    return route.fulfill({ json: { state, revision: ++revision } });
  });
  await page.goto('/#/reports?student=S1');
  await expect(page.locator('.assessment-attitude-item')).toHaveCount(8);
  await expect(page.locator('.assessment-attitude-item strong')).toHaveText(Array(8).fill('-'));
  await page.evaluate(() => {
    window.print = () => {
      (window as any).printed = true;
    };
  });
  await page.getByRole('button', { name: 'Print / Save PDF', exact: true }).click();
  await expect.poll(() => page.evaluate(() => !!(window as any).printed)).toBe(true);
  await page.getByRole('button', { name: 'Edit report card', exact: true }).click();
  const dialog = page.getByRole('dialog');
  for (const item of attitudeItems) {
    await expect(dialog.getByLabel(item.label, { exact: true })).toHaveValue('');
    await expect(
      dialog.getByLabel(item.label, { exact: true }).locator('option').first(),
    ).toHaveText('Select...');
    await expect(
      dialog.getByLabel(item.label, { exact: true }).locator('option').first(),
    ).toBeDisabled();
  }
  for (const [width, columns] of [
    [1280, 4],
    [800, 2],
    [390, 1],
  ]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page
        .locator('.attitude-editor-grid')
        .evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length),
    ).toBe(columns);
    expect(
      await page
        .locator('.attitude-editor-grid')
        .evaluate((el) => el.scrollWidth <= el.clientWidth),
    ).toBe(true);
  }
  await page.locator('.attitude-editor').scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath('attitudes-phone.png'), fullPage: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  for (const { key, label, options } of attitudeItems) {
    await dialog.getByLabel(label, { exact: true }).selectOption(options[0]);
  }
  await page
    .locator('.attitude-editor')
    .screenshot({ path: testInfo.outputPath('attitudes-desktop.png') });
  await dialog.getByLabel('Class Teacher’s Remarks').fill('Steady progress.');
  await dialog.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  expect(saveRequests).toBe(1);
  expect(state.remarks['S1|1']).toBe('Steady progress.');
  expect(state.conduct['S1|1'].attitudes).toEqual(
    Object.fromEntries(attitudeItems.map(({ key, options }) => [key, options[0]])),
  );
  await page.reload();
  await expect(page.locator('.assessment-attitude-item strong')).toHaveText(
    attitudeItems.map((item) => item.options[0]),
  );
  await page.getByRole('button', { name: 'Edit report card', exact: true }).click();
  for (const { label, options } of attitudeItems)
    await expect(dialog.getByLabel(label, { exact: true })).toHaveValue(options[0]);
  await dialog.getByLabel('Conduct', { exact: true }).selectOption({ label: 'Leave blank' });
  await dialog.getByLabel('Science Expo', { exact: true }).selectOption('NEEDS ENCOURAGEMENT');
  await dialog.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.locator('.assessment-attitude-item strong').first()).toHaveText('-');
  await page.evaluate(() => {
    (window as any).printed = false;
    window.print = () => {
      (window as any).printed = true;
    };
  });
  await page.getByRole('button', { name: 'Print selected class (1)', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as any).printed)).toBe(true);
  await page.emulateMedia({ media: 'print' });
  expect(
    await page
      .locator('.assessment-attitudes-grid')
      .last()
      .evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length),
  ).toBe(4);
  expect(
    await page
      .locator('.assessment-attitude-item')
      .evaluateAll((elements) => elements.every((el) => el.scrollWidth <= el.clientWidth)),
  ).toBe(true);
  await page.pdf({
    path: testInfo.outputPath('attitudes-report.pdf'),
    format: 'A4',
    preferCSSPageSize: true,
  });
  await page.screenshot({ path: testInfo.outputPath('attitudes-print.png'), fullPage: true });
  await page.emulateMedia({ media: 'screen' });
  await page.getByLabel('Report term', { exact: true }).selectOption('2');
  await expect(page.locator('.assessment-attitude-item strong')).toHaveText(Array(8).fill('-'));
  // A future/legacy value stays visible, then can be explicitly cleared.
  state.conduct['S1|1'].attitudes!.conduct = 'Obsolete word';
  await page.reload();
  await page.getByRole('button', { name: 'Edit report card', exact: true }).click();
  await expect(dialog.getByLabel('Conduct', { exact: true })).toHaveValue('Obsolete word');
  await expect(dialog.getByLabel('Conduct', { exact: true })).toHaveAttribute(
    'aria-invalid',
    'true',
  );
  await dialog.getByLabel('Conduct', { exact: true }).selectOption({ label: 'Leave blank' });
  await dialog.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(dialog).not.toBeVisible();
});
