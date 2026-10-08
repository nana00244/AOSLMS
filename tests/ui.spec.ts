import { test, expect, type Page } from '@playwright/test';
async function login(page: Page, role = 'Administrator') {
  await page.goto('/');
  await page
    .getByRole('button', { name: role + ' ', exact: false })
    .first()
    .click();
  await page.getByRole('button', { name: `Explore as ${role}` }).click();
  await expect(page.getByRole('heading', { name: /Good morning/ })).toBeVisible();
}
test('attendance persists and updates report card', async ({ page }) => {
  await login(page);
  await page.goto('/#/attendance');
  await page.getByRole('button', { name: 'Mark all present' }).click();
  await page.getByRole('button', { name: /Save register/ }).click();
  await expect(page.getByRole('status')).toContainText('Attendance saved');
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Present', exact: true, pressed: true }),
  ).toHaveCount(6);
  await page.goto('/#/reports');
  await expect(page.locator('.report-summary')).toContainText('1 / 1 days');
});
test('admission search and browser persistence', async ({ page }) => {
  await login(page);
  await page.goto('/#/students');
  await page.getByRole('button', { name: 'New admission' }).click();
  await page.getByLabel('Full name').fill('Akua Test Mensah');
  await page.getByLabel('Date of birth').fill('2015-01-14');
  await page.getByRole('button', { name: 'Save student', exact: true }).click();
  await page.getByRole('textbox', { name: 'Search name or admission number...' }).fill('Akua Test');
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await page.reload();
  await page.getByRole('textbox', { name: 'Search name or admission number...' }).fill('Akua Test');
  await expect(page.locator('tbody')).toContainText('Akua Test Mensah');
});
test('payment recalculates balance and produces receipt', async ({ page }) => {
  await login(page);
  await page.goto('/#/finance');
  await page.getByRole('button', { name: 'Record payment', exact: true }).click();
  await page.getByLabel('Student', { exact: true }).selectOption('AOS-2026-0893');
  await page.getByLabel('Amount (GH₵)', { exact: true }).fill('100');
  await page.getByRole('button', { name: 'Record & view receipt' }).click();
  await expect(page.getByRole('dialog')).toContainText('Ama Serwaa Antwi');
  await expect(page.locator('.receipt')).toContainText('100.00');
  await page.getByRole('button', { name: 'Close dialog' }).click();
  const row = page.locator('tbody tr').filter({ hasText: 'Ama Serwaa Antwi' });
  await expect(row).toContainText('400.00');
  await expect(row).toContainText('120.00');
});
test('teacher cannot open finance and student resources are scoped', async ({ page }) => {
  await login(page, 'Teacher');
  await page.goto('/#/finance');
  await expect(page.getByRole('heading', { name: /Good morning/ })).toBeVisible();
  await page.getByRole('button', { name: /Sarah Mensah Teacher/ }).click();
  await login(page, 'Student');
  await page.goto('/#/students');
  await expect(page.getByRole('heading', { name: /Good morning/ })).toBeVisible();
  await page.goto('/#/resources');
  await expect(page.getByLabel('Resource class').locator('option')).toHaveCount(1);
});
test('timetable rejects a double booking', async ({ page }) => {
  await login(page);
  await page.goto('/#/timetable');
  await page.getByRole('button', { name: 'Add period' }).click();
  await page.getByLabel('Class', { exact: true }).selectOption('Basic 4 - Blue');
  await page.getByRole('button', { name: 'Save period', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Conflict:');
});
test('grading normalizes SBA and updates report', async ({ page }) => {
  await login(page);
  await page.goto('/#/coursework');
  await page.getByRole('button', { name: 'Review', exact: true }).first().click();
  await page.getByLabel('Score (out of 50)').fill('40');
  await page.getByLabel('Feedback').fill('Good effort and clear explanations.');
  await page.getByRole('button', { name: 'Save grade', exact: true }).click();
  await page.goto('/#/reports');
  await expect(
    page
      .locator('.report-table tbody tr')
      .filter({ hasText: 'Integrated Science' })
      .locator('td')
      .nth(1),
  ).toHaveText('40');
});
for (const size of [
  { name: 'desktop', width: 1440, height: 1000 },
  { name: 'tablet', width: 820, height: 1180 },
  { name: 'phone', width: 390, height: 844 },
  { name: 'small-phone', width: 320, height: 740 },
]) {
  test(`${size.name}: all routes render without page overflow`, async ({ page }) => {
    await page.setViewportSize(size);
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await login(page);
    for (const route of [
      '',
      'students',
      'attendance',
      'coursework',
      'reports',
      'timetable',
      'resources',
      'certificates',
      'community',
      'finance',
      'payroll',
      'users',
      'audit',
      'settings',
    ]) {
      await page.goto('/#/' + route);
      await expect(page.locator('main h1')).toBeVisible();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth + 1,
      );
      expect(overflow, `${size.name} overflow on ${route}`).toBe(false);
    }
    expect(errors).toEqual([]);
  });
}
test('CSV import maps columns and prevents duplicate admissions', async ({ page }) => {
  await login(page);
  await page.goto('/#/students');
  await page.getByRole('button', { name: 'Bulk import', exact: true }).click();
  await page.getByLabel('Choose roster (.csv or .xlsx)').setInputFiles({
    name: 'students.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(
      'First Name,Last Name,Admission No,Gender,Class\nTest,Learner,TEST-1,Female,Basic 6 - Gold\nTest,Learner,TEST-1,Female,Basic 6 - Gold',
    ),
  });
  await page.getByRole('button', { name: 'Import students', exact: true }).click();
  await expect(page.getByRole('status')).toContainText(
    '1 students imported; 1 duplicate or invalid rows skipped',
  );
});
test('backup requires confirmation and rejects tampering', async ({ page }) => {
  await login(page);
  await page.goto('/#/settings');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download backup' }).click();
  const file = await downloadPromise;
  const path = await file.path();
  await page.getByLabel('Upload restore file').setInputFiles(path!);
  await expect(page.getByRole('button', { name: 'Confirm restore' })).toBeDisabled();
  await page.getByLabel('Type RESTORE SYSTEM to confirm').fill('RESTORE SYSTEM');
  await page.getByRole('button', { name: 'Confirm restore' }).click();
  await expect(page.getByRole('status')).toContainText('Demo workspace updated');
  await page.getByLabel('Upload restore file').setInputFiles({
    name: 'bad.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"format":"aos-demo-v1","payload":"{}","checksum":"bad"}'),
  });
  await expect(page.getByRole('alert')).toContainText('checksum is invalid');
});

test('mobile navigation and controlled dialog keyboard input work', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.getByRole('link', { name: 'Payroll', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Payroll ledger' })).toBeVisible();
  await page.getByRole('button', { name: 'Edit', exact: true }).first().click();
  const salary = page.getByLabel('Basic (GH₵)');
  await salary.fill('');
  await salary.pressSequentially('3500');
  await expect(salary).toHaveValue('3500');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('student submits coursework and teacher can review it', async ({ page }) => {
  await login(page, 'Student');
  await page.goto('/#/coursework');
  await page.getByRole('button', { name: 'Open task', exact: true }).first().click();
  await page
    .getByLabel('Your response')
    .fill('My school is a place for learning. We share ideas and help each other.');
  await page.getByRole('button', { name: 'Submit assignment', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Your work has been submitted');
  await page.getByRole('button', { name: /Kofi Mensah Boateng Student/ }).click();
  await login(page, 'Teacher');
  await page.goto('/#/coursework');
  await page
    .locator('.assignment-card')
    .filter({ hasText: 'Grammar & punctuation' })
    .getByRole('button', { name: 'Grade now' })
    .click();
  await expect(page.locator('tbody')).toContainText('Kofi Mensah Boateng');
});

test('Excel workbook imports with mapped columns', async ({ page }) => {
  await login(page);
  await page.goto('/#/students');
  await page.getByRole('button', { name: 'Bulk import', exact: true }).click();
  await page
    .getByLabel('Choose roster (.csv or .xlsx)')
    .setInputFiles('tests/fixtures/students.xlsx');
  await expect(
    page.getByRole('heading', { name: 'Match your columns · 1 rows found' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Import students', exact: true }).click();
  await page.getByRole('textbox', { name: 'Search name or admission number...' }).fill('XLSX-2001');
  await expect(page.locator('tbody')).toContainText('Akua Excel');
});
