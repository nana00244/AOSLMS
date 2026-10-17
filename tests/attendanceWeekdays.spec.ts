import { test, expect } from '@playwright/test';
import { emptyState } from '../src/emptyState';
import { applyChanges } from '../src/backendAccess';
import { workspaceSchema } from '../src/validation';
import { isSchoolAttendanceKey, schoolDaysInMonth } from '../src/schoolDays';

test('attendance hides legacy weekends, offers only weekdays and saves valid school days', async ({
  page,
}) => {
  const owner = '00000000-0000-4000-8000-000000000001';
  let state = emptyState();
  state.settings.year = '2026/2027';
  state.classes = ['BS 1'];
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
      enrolled: '',
    },
  ];
  state.attendance = {
    '2026-10-16|1|S1': 'Present',
    '2026-10-17|1|S1': 'Present',
    '2026-10-18|1|S1': 'Absent',
    '2026-10-19|1|S1': 'Late',
  };
  let saves = 0;
  await page.routeWebSocket('**', (socket) => socket.close());
  await page.addInitScript(
    ({ owner }) =>
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
      ),
    { owner },
  );
  await page.route('https://*.supabase.co/**', async (route) => {
    if (!route.request().url().includes('/functions/v1/workspace'))
      return route.fulfill({ json: {} });
    const body = route.request().postDataJSON();
    if (body.action === 'load') return route.fulfill({ json: { state, revision: 1 + saves } });
    expect(['save-pending', 'save-batch']).toContain(body.action);
    // Emulate the production cleanup; the first response deliberately contained legacy data.
    state.attendance = Object.fromEntries(
      Object.entries(state.attendance).filter(([key]) => isSchoolAttendanceKey(key)),
    );
    for (const save of body.saves || [body])
      state = workspaceSchema.parse(
        applyChanges(state, state.users[0], save.changes),
      ) as typeof state;
    saves++;
    return route.fulfill({ json: { state, revision: 1 + saves } });
  });
  await page.goto('/#/attendance');
  await page.getByLabel('Attendance month', { exact: true }).fill('2026-10');
  expect(
    await page
      .getByLabel('Attendance date', { exact: true })
      .locator('option')
      .evaluateAll((options) => options.map((option) => (option as HTMLOptionElement).value)),
  ).toEqual(schoolDaysInMonth('2026-10'));
  await page.getByRole('tab', { name: 'Monthly audit', exact: true }).click();
  await expect(page.locator('.monthly-register thead th')).toHaveText([
    'Student',
    ...schoolDaysInMonth('2026-10').map((day) => String(Number(day.slice(-2)))),
    'P / L / A / E',
    'Standing',
  ]);
  await expect(page.locator('.monthly-register tbody')).toContainText('1 / 1 / 0 / 0');
  await page.goto('/#/reports?student=S1');
  await expect(page.locator('.assessment-bar').first()).toContainText(
    /ATTENDANCE:\s*2\s*OUT OF\s*2\s*SESSIONS/,
  );
  await page.goto('/#/attendance');
  await page.getByLabel('Attendance month', { exact: true }).fill('2026-10');
  await page.getByLabel('Attendance date', { exact: true }).selectOption('2026-10-20');
  await page.getByRole('button', { name: 'Mark all present', exact: true }).click();
  await page.getByRole('button', { name: /Save register/ }).click();
  await expect.poll(() => saves).toBe(1);
  expect(state.attendance['2026-10-20|1|S1']).toBe('Present');
  expect(Object.keys(state.attendance).every(isSchoolAttendanceKey)).toBe(true);
  await page.getByLabel('Attendance month', { exact: true }).fill('2026-11');
  await expect(page.getByLabel('Attendance date', { exact: true })).toHaveValue('2026-11-02');
  expect(await page.getByLabel('Attendance date', { exact: true }).locator('option').count()).toBe(
    schoolDaysInMonth('2026-11').length,
  );
  await page.getByRole('tab', { name: 'Monthly audit', exact: true }).click();
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.monthly-register thead th')).toHaveCount(
    schoolDaysInMonth('2026-11').length + 3,
  );
});
