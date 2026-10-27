import { test, expect, type Page } from '@playwright/test';
import { seed } from '../src/data';
import { emptyState } from '../src/emptyState';
import { applyChanges } from '../src/backendAccess';
async function login(page: Page, role = 'Administrator') {
  await page.goto('/');
  await page
    .getByRole('button', { name: role + ' ', exact: false })
    .first()
    .click();
  await page.getByRole('button', { name: `Explore as ${role}` }).click();
  await expect(page.getByRole('heading', { name: /Good morning/ })).toBeVisible();
}

test('compact grading grid preserves edits through search and contains horizontal scrolling', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  let state = seed();
  state.students = Array.from({ length: 24 }, (_, i) => ({
    ...state.students[0],
    id: `GRID-${i}`,
    name: `Grid pupil ${String(i).padStart(2, '0')}`,
  }));
  const owner = state.users.find((user) => user.role === 'Administrator')!;
  state.assignments = [
    {
      id: 'cc_grid',
      title: 'Class Exercises',
      subject: 'English Language',
      classId: state.students[0].classId,
      points: 15,
      due: '2026-10-27',
      description: '',
      category: 'Exercise',
      term: `Term ${state.settings.term}`,
    },
  ];
  let revision = 1;
  await page.routeWebSocket('**', (socket) => socket.close());
  await page.addInitScript((owner) => {
    localStorage.setItem(
      'sb-itqfnzqksuacbeemrqok-auth-token',
      JSON.stringify({
        access_token: 'test-token',
        refresh_token: 'test-refresh',
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        token_type: 'bearer',
        user: { id: owner.id, email: owner.email, aud: 'authenticated', role: 'authenticated' },
      }),
    );
  }, owner);
  await page.route('https://*.supabase.co/**', async (route) => {
    if (!route.request().url().includes('/functions/v1/workspace'))
      return route.fulfill({ json: {} });
    const body = route.request().postDataJSON();
    if (body.action !== 'load') {
      for (const save of body.saves || [body])
        state = applyChanges(state, owner, save.changes) as typeof state;
      revision++;
    }
    return route.fulfill({ json: { state, revision } });
  });
  await page.goto('/#/coursework');
  await page
    .locator('.assignment-card')
    .filter({ hasText: state.students[0].classId })
    .first()
    .getByRole('button', { name: 'Open Excel grading sheet' })
    .click();
  const grid = page.locator('.coursework-grid-scroll');
  const rows = grid.locator('tbody tr:visible');
  await expect(rows).toHaveCount(24);
  const bounds = await grid.boundingBox();
  const eighth = await rows.nth(7).boundingBox();
  expect(eighth!.y + eighth!.height).toBeLessThan(bounds!.y + bounds!.height);
  const score = rows.first().locator('input[type=number]').first();
  await score.fill('0');
  await rows.first().locator('summary').first().click();
  await rows.first().locator('select').first().selectOption('late');
  await rows.first().locator('input[placeholder=Feedback]').first().fill('Submitted after class');
  await rows.first().locator('summary').first().click();
  await page.getByLabel('Search students', { exact: true }).fill('Grid pupil 01');
  await expect(rows).toHaveCount(1);
  await page.getByLabel('Search students', { exact: true }).fill('');
  await expect(score).toHaveValue('0');
  const url = page.url();
  await grid.hover();
  await page.mouse.wheel(900, 0);
  await expect.poll(() => grid.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
  await page.mouse.wheel(-5000, 0);
  await expect.poll(() => grid.evaluate((el) => el.scrollLeft)).toBe(0);
  await page.mouse.wheel(-5000, 0);
  await expect(page).toHaveURL(url);
  expect(
    await page.evaluate(() => getComputedStyle(document.documentElement).overscrollBehaviorX),
  ).toBe('none');
  await page.screenshot({ path: 'test-results/compact-score-grid.png' });
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
  await page.screenshot({ path: 'test-results/compact-score-grid-dark.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('button', { name: 'Save scores', exact: true })).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: 'test-results/compact-score-grid-mobile.png' });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole('button', { name: 'Save scores', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const saved = state;
  const entries = saved.assignments.flatMap(
    (a: {
      slotScores?: Record<
        string,
        Record<string, { score: number; feedbackType: string; feedbackReason: string }>
      >;
    }) => Object.values(a.slotScores?.['GRID-0'] || {}),
  );
  expect(entries).toContainEqual(
    expect.objectContaining({
      score: 0,
      feedbackType: 'late',
      feedbackReason: 'Submitted after class',
    }),
  );
});

test('supplied multi-sheet workbook imports all classes once', async ({ page }) => {
  test.skip(!process.env.AOS_ROSTER_SAMPLE_PATH, 'Optional private reference workbook');
  await login(page);
  const state = emptyState();
  state.users = seed().users.filter((u) => u.role === 'Administrator');
  await page.evaluate((s) => localStorage.setItem('aos-lms-demo-v1', JSON.stringify(s)), state);
  await page.reload();
  await page.goto('/#/students');
  async function upload() {
    await page.getByRole('button', { name: 'Bulk import', exact: true }).click();
    await page
      .getByLabel('Roster file (.xlsx or .csv)')
      .setInputFiles(process.env.AOS_ROSTER_SAMPLE_PATH!);
  }
  await upload();
  await expect(page.getByRole('dialog')).toContainText('239 new students', { timeout: 20000 });
  await page.getByRole('button', { name: 'Apply roster updates' }).click();
  const counts = await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('aos-lms-demo-v1')!);
    return {
      students: s.students.length,
      classes: s.classes.length,
      bills: Object.keys(s.studentBills).length,
    };
  });
  expect(counts).toEqual({ students: 239, classes: 9, bills: 0 });
  await upload();
  await expect(page.getByRole('dialog')).toContainText(
    '0 new students · 0 class changes · 239 already in class',
  );
  await expect(page.getByRole('button', { name: 'Apply roster updates' })).toBeDisabled();
});

test('roster import is repeatable and admin can bulk reassign and delete', async ({ page }) => {
  await login(page);
  const state = emptyState();
  state.users = seed().users.filter((u) => u.role === 'Administrator' || u.role === 'Accountant');
  state.classes = ['Basic 1', 'Basic 2'];
  state.students = [
    {
      id: 'OLD',
      name: 'Ama Mensah',
      classId: 'Basic 2',
      gender: '',
      dob: '',
      guardian: '',
      phone: '',
      status: 'Active',
      enrolled: '2026-10-11',
    },
  ];
  await page.evaluate((s) => localStorage.setItem('aos-lms-demo-v1', JSON.stringify(s)), state);
  await page.reload();
  await page.goto('/#/students');
  const buffer = Buffer.from(
    'Full Name,Admission Number,Class\nMensah Ama,EXT,BS 1\nKofi New,NEW,BS 2',
  );
  async function upload() {
    await page.getByRole('button', { name: 'Bulk import', exact: true }).click();
    await page
      .getByLabel('Roster file (.xlsx or .csv)')
      .setInputFiles({ name: 'roster.csv', mimeType: 'text/csv', buffer });
  }
  await upload();
  await expect(page.getByRole('dialog')).toContainText('1 new students · 1 class changes');
  await page.getByRole('button', { name: 'Apply roster updates' }).click();
  await upload();
  await expect(page.getByRole('dialog')).toContainText(
    '0 new students · 0 class changes · 2 already in class',
  );
  await page.keyboard.press('Escape');
  await page.getByRole('checkbox', { name: 'Select all filtered students', exact: true }).check();
  await page.getByRole('button', { name: 'Reassign selected' }).click();
  await page.getByLabel('Destination class').selectOption('Basic 2');
  await page.getByRole('button', { name: 'Confirm reassignment' }).click();
  await page.reload();
  await expect(page.locator('tbody')).toContainText('Ama Mensah');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('aos-lms-demo-v1')!));
  expect(saved.students.every((s: { classId: string }) => s.classId === 'Basic 2')).toBe(true);
  expect(saved.studentBills).toEqual({});
  await page.getByRole('checkbox', { name: 'Select all filtered students', exact: true }).check();
  await page.getByRole('button', { name: 'Delete selected' }).click();
  await page.getByRole('button', { name: 'Confirm deletion' }).click();
  await page.reload();
  await expect(page.getByText('No students found', { exact: true })).toBeVisible();
});

test('accountant explicitly bills a class and edits an individual bill', async ({ page }) => {
  await page.goto('/');
  const state = emptyState();
  state.users = seed().users.filter((u) => u.role === 'Administrator' || u.role === 'Accountant');
  state.classes = ['Basic 1'];
  state.fees = { 'Basic 1': { Tuition: 100 } };
  state.students = ['A', 'B'].map((id) => ({
    id,
    name: `Student ${id}`,
    classId: 'Basic 1',
    gender: '',
    dob: '',
    guardian: '',
    phone: '',
    status: 'Active' as const,
    enrolled: '2026-10-11',
  }));
  await page.evaluate((s) => {
    localStorage.setItem('aos-lms-demo-v1', JSON.stringify(s));
    sessionStorage.setItem('aos-role', 'Accountant');
  }, state);
  await page.reload();
  await page.goto('/#/accountant/fees');
  await page.getByRole('button', { name: 'Issue or edit student bills' }).click();
  await expect(page.getByRole('dialog')).toContainText('2 student(s) will be billed');
  await page.getByRole('button', { name: 'Save student bills' }).click();
  await page.getByRole('button', { name: 'Issue or edit student bills' }).click();
  await expect(page.getByRole('dialog')).toContainText('0 student(s) will be billed');
  await page.getByLabel('Bill by').selectOption('student');
  await page.getByLabel('Billed student').selectOption('A');
  await page.getByLabel('Tuition billed (GH₵)').fill('75');
  await page.getByRole('button', { name: 'Save student bills' }).click();
  await page.reload();
  const bills = await page.evaluate(
    () => JSON.parse(localStorage.getItem('aos-lms-demo-v1')!).studentBills,
  );
  expect(bills['A|2026/2027|1'].items.Tuition).toBe(75);
  expect(bills['B|2026/2027|1'].items.Tuition).toBe(100);
});
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

test('monthly attendance CSV matches names and class and preserves unmatched records', async ({
  page,
}) => {
  await login(page);
  const fixture = await page.evaluate((state) => {
    const students = state.students.filter(
      (s: { classId: string }) => s.classId === 'Basic 1 - Green',
    );
    state.attendance[`2026-09-08|2|${students[1].id}`] = 'Excused';
    localStorage.setItem('aos-lms-demo-v1', JSON.stringify(state));
    return { first: students[0], missing: students[1] };
  }, seed());
  await page.reload();
  await page.goto('/#/attendance');
  await page.getByRole('button', { name: 'Import attendance CSV', exact: true }).click();
  const csv = `"MONTHLY REGISTER"\n"Class: BS 1 | Month: September 2026"\nStudent Name,Admission Number,Sep 08,Sep 09,Days Present\n"${fixture.first.name.split(' ').reverse().join(' ')}",external-id,PRESENT,ABSENT,1\nUnknown Person,unknown,PRESENT,PRESENT,2`;
  await page.getByLabel('Attendance CSV file').setInputFiles({
    name: 'Attendance_Register_BS_1_September_2026.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(csv),
  });
  await expect(page.getByLabel('Import into class')).toHaveValue('Basic 1 - Green');
  await page.getByLabel('Attendance term', { exact: true }).selectOption('2');
  await expect(page.getByRole('dialog')).toContainText('1 matched students · 1 skipped rows');
  await expect(page.getByRole('dialog')).toContainText('2026-09');
  await page.getByRole('button', { name: 'Import 2 attendance records', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByLabel('Attendance date')).toHaveValue('2026-09-01');
  await expect(page.getByLabel('Register term')).toHaveValue('2');
  await page.reload();
  const marks = await page.evaluate(
    () => JSON.parse(localStorage.getItem('aos-lms-demo-v1')!).attendance,
  );
  expect(marks[`2026-09-08|2|${fixture.first.id}`]).toBe('Present');
  expect(marks[`2026-09-09|2|${fixture.first.id}`]).toBe('Absent');
  expect(marks[`2026-09-08|2|${fixture.missing.id}`]).toBe('Excused');
  expect(Object.keys(marks).some((k) => k.includes('unknown'))).toBe(false);
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

test('pending timeout keeps navigation usable and retries the durable operation', async ({
  page,
}) => {
  const state = emptyState();
  const userId = '00000000-0000-4000-8000-000000000001';
  state.users = [
    {
      id: userId,
      name: 'Test Admin',
      email: 'test@example.com',
      role: 'Administrator',
      active: true,
      classes: [],
    },
  ];
  state.settings = {
    ...state.settings,
    name: 'Test School',
    motto: 'Learn',
    address: 'Test address',
    phone: '12345',
    email: 'test@example.com',
    year: '2026/2027',
    vacation: '2026-12-18',
    reopening: '2027-01-05',
  };
  await page.addInitScript(
    ({ userId }) => {
      localStorage.setItem(
        'sb-itqfnzqksuacbeemrqok-auth-token',
        JSON.stringify({
          access_token: 'test-token',
          refresh_token: 'test-refresh',
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          token_type: 'bearer',
          user: {
            id: userId,
            email: 'test@example.com',
            aud: 'authenticated',
            role: 'authenticated',
          },
        }),
      );
    },
    { userId },
  );
  let releaseSave!: () => void;
  const saveGate = new Promise<void>((resolve) => {
    releaseSave = resolve;
  });
  const operations: string[] = [];
  let loads = 0;
  await page.route('**/functions/v1/workspace', async (route) => {
    const body = route.request().postDataJSON();
    if (body.action === 'load') {
      loads++;
      await route.fulfill({
        json: body.knownRevision === 1 ? { unchanged: true, revision: 1 } : { state, revision: 1 },
      });
      return;
    }
    if (body.action === 'save-pending') {
      operations.push(body.operationId);
      if (operations.length === 1) {
        await saveGate;
        await route.fulfill({
          status: 503,
          json: { error: 'canceling statement due to statement timeout' },
        });
      } else {
        await route.fulfill({
          json: {
            state: { ...state, settings: { ...state.settings, name: 'Updated School' } },
            revision: 2,
          },
        });
      }
      return;
    }
    await route.fulfill({ status: 400, json: { error: 'Unexpected test request' } });
  });
  await page.goto('/#/settings');
  await page.getByLabel('School name', { exact: true }).fill('Updated School');
  await page.getByRole('button', { name: 'Save all changes' }).click();
  await expect(page.locator('.cloud-save-overlay')).toBeVisible();
  await page.getByRole('link', { name: 'Student directory', exact: true }).click();
  await expect(page).toHaveURL(/students/);
  releaseSave();
  const notice = page.getByRole('complementary', { name: 'Pending saves' });
  await expect(notice).toContainText('retained on this device.');
  await expect(page.locator('.cloud-save-overlay')).toBeHidden();
  await notice.getByRole('button', { name: 'Show details' }).click();
  await expect(notice).toContainText('statement timeout');
  await notice.getByRole('button', { name: 'Hide details' }).click();
  await expect(notice).not.toContainText('statement timeout');
  await notice.getByRole('button', { name: 'Show details' }).click();
  await notice.getByRole('button', { name: 'Retry sync' }).click();
  await expect(notice).toBeHidden();
  expect(operations).toHaveLength(2);
  expect(operations[1]).toBe(operations[0]);
  expect(loads).toBeLessThanOrEqual(2);
});

test('realtime skips the confirmed save revision and still loads another user edit', async ({
  page,
}) => {
  const state = seed();
  const userId = '00000000-0000-4000-8000-000000000001';
  state.users = [
    {
      id: userId,
      name: 'Test Admin',
      email: 'test@example.com',
      role: 'Administrator',
      active: true,
      classes: [],
    },
  ];
  state.settings.vacation = '2026-12-18';
  state.settings.reopening = '2027-01-05';
  await page.addInitScript(
    ({ userId }) => {
      localStorage.setItem(
        'sb-itqfnzqksuacbeemrqok-auth-token',
        JSON.stringify({
          access_token: 'test-token',
          refresh_token: 'test-refresh',
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          token_type: 'bearer',
          user: {
            id: userId,
            email: 'test@example.com',
            aud: 'authenticated',
            role: 'authenticated',
          },
        }),
      );
    },
    { userId },
  );
  const loads: (number | undefined)[] = [];
  let saves = 0;
  let revision = 1;
  let releaseSave!: () => void;
  const saveGate = new Promise<void>((resolve) => {
    releaseSave = resolve;
  });
  await page.route('**/functions/v1/workspace', async (route) => {
    const body = route.request().postDataJSON();
    if (body.action === 'load') {
      loads.push(body.knownRevision);
      await route.fulfill({
        json: body.knownRevision === revision ? { unchanged: true, revision } : { state, revision },
      });
      return;
    }
    if (body.action === 'save-pending') {
      saves++;
      await saveGate;
      revision = 2;
      state.settings.name = 'Locally updated school';
      await route.fulfill({ json: { state, revision } });
      return;
    }
    await route.fulfill({ status: 400, json: { error: 'Unexpected request' } });
  });
  async function emitRevision(value: number) {
    await page.evaluate(async (revision) => {
      const modulePath = '/src/supabase.ts';
      const { supabase } = await import(modulePath);
      const channel = supabase
        .getChannels()
        .find((entry: any) => entry.topic.includes('workspace-revision-'));
      // Deliver a decoded event to the real registered handler; the fixture does
      // not connect to or change a live school's realtime database.
      const binding = channel?.bindings.postgres_changes.find(
        (entry: any) => entry.filter.table === 'workspace_revisions',
      );
      if (!binding) throw new Error('Workspace realtime handler was not registered');
      binding.callback({ new: { id: true, revision } });
    }, value);
  }
  await page.goto('/#/settings');
  await expect(page.getByLabel('School name', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Save all changes' }).click();
  await expect(page.locator('.cloud-save-overlay')).toBeHidden();
  expect(saves).toBe(0); // Re-saving unchanged settings must not write a document.
  await page.getByLabel('School name', { exact: true }).fill('Locally updated school');
  await page.getByRole('button', { name: 'Save all changes' }).click();
  await expect.poll(() => saves).toBe(1);
  const initialLoads = loads.length;
  await emitRevision(2);
  await page.waitForTimeout(350); // Event handler is now waiting for the in-flight save.
  releaseSave();
  await expect(page.locator('.cloud-save-overlay')).toBeHidden();
  await page.waitForTimeout(350);
  expect(loads).toHaveLength(initialLoads);
  await emitRevision(1); // Out-of-order older events are also already represented.
  await page.waitForTimeout(350);
  expect(loads).toHaveLength(initialLoads);
  revision = 3;
  state.settings.name = 'Updated by another administrator';
  state.users[0].name = 'Remote Administrator';
  await emitRevision(3);
  await expect.poll(() => loads.length).toBe(initialLoads + 1);
  expect(loads.at(-1)).toBe(2);
  await expect(page.getByRole('button', { name: /Remote Administrator/ })).toBeVisible();
  await page.getByRole('link', { name: 'Student directory', exact: true }).click();
  await expect(page.getByLabel('School name', { exact: true })).toBeHidden();
  await page.goto('/#/settings');
  await expect(page.getByLabel('School name', { exact: true })).toHaveValue(
    'Updated by another administrator',
  );
});
