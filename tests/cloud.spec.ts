import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

test('administrator signs in, reloads cloud data, and navigates the empty school', async ({
  page,
}) => {
  const credentials = JSON.parse(readFileSync('.temp/admin-credentials.json', 'utf8'));
  const errors: string[] = [];
  page.on('pageerror', (error) => {
    errors.push(error.message);
    console.log('Page error:', error.message);
  });
  await page.goto('/');
  await page.getByLabel('Email address').fill(credentials.email);
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
