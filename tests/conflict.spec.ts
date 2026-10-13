import { test, expect } from '@playwright/test';
import { emptyState } from '../src/emptyState';

for (const keepLocal of [false, true]) {
  test(`conflict survives reload without retrying, allows sign-out and ${keepLocal ? 'keeps local' : 'uses database'} resolution`, async ({
    page,
  }) => {
    const userId = '00000000-0000-4000-8000-000000000001';
    const state = emptyState();
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
    state.settings.name = 'Database school';
    await page.addInitScript(
      ({ userId }) => {
        // Seed only once; a real sign-out must remove the persisted session.
        if (localStorage.getItem('fixture-initialized')) return;
        localStorage.setItem('fixture-initialized', 'yes');
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
    let attempts = 0;
    let resolved = false;
    await page.route('**/auth/v1/logout**', (route) => route.fulfill({ status: 204 }));
    await page.route('**/auth/v1/token**', (route) =>
      route.fulfill({
        json: {
          access_token: 'test-token',
          refresh_token: 'test-refresh',
          expires_in: 3600,
          token_type: 'bearer',
          user: {
            id: userId,
            email: 'test@example.com',
            aud: 'authenticated',
            role: 'authenticated',
          },
        },
      }),
    );
    await page.route('**/functions/v1/workspace', async (route) => {
      const body = route.request().postDataJSON();
      if (body.action === 'load') return route.fulfill({ json: { state, revision: 1 } });
      attempts++;
      if (!resolved)
        return route.fulfill({
          status: 409,
          json: {
            error:
              'Conflict: settings/singleton.name was also changed by another save. Your pending entry is retained for review.',
          },
        });
      expect(body.changes[0].before.name).toBe('Database school');
      expect(body.changes[0].after.name).toBe('Local school');
      return route.fulfill({
        json: {
          state: { ...state, settings: { ...state.settings, name: 'Local school' } },
          revision: 2,
        },
      });
    });
    await page.goto('/');
    await expect(page.locator('.app-shell')).toBeVisible();
    await page.evaluate(
      async ({ userId }) => {
        const path = '/src/pendingSaves.ts';
        const { retainSave } = await import(path);
        await retainSave({
          id: '00000000-0000-4000-8000-000000000002',
          owner: userId,
          createdAt: new Date().toISOString(),
          changes: [
            {
              collection: 'settings',
              id: 'singleton',
              before: { name: 'Original school' },
              after: { name: 'Local school' },
            },
          ],
        });
      },
      { userId },
    );
    await page.reload();
    const notice = page.getByRole('complementary', { name: 'Pending saves' });
    await expect(notice).toContainText('needs review');
    await expect(
      notice.getByRole('button', { name: 'Use database version for oldest save' }),
    ).toBeVisible();
    expect(attempts).toBe(1);
    await notice.getByRole('button', { name: 'Dismiss notice' }).click();
    await expect(notice).toBeHidden();
    await expect(page.getByRole('alert')).toHaveCount(0);
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await page.reload();
    await expect(notice).toContainText('needs review');
    await page.waitForTimeout(400);
    expect(attempts).toBe(1);
    page.on('dialog', (dialog) => dialog.accept());
    await page.locator('.profile-button').click();
    await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
    await expect(notice).toBeHidden();
    await page.reload();
    await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
    await page.getByLabel('Username or email').fill('test@example.com');
    await page.getByLabel('Password', { exact: true }).fill('test-password');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(notice).toContainText('needs review');
    expect(attempts).toBe(1);
    await notice.getByRole('button', { name: 'Show details' }).click();
    resolved = true;
    await notice
      .getByRole('button', {
        name: keepLocal
          ? 'Keep my changed fields and retry'
          : 'Use database version for oldest save',
      })
      .click();
    await expect(notice).toBeHidden();
    expect(attempts).toBe(keepLocal ? 2 : 1);
    await expect(page.getByRole('alert')).toHaveCount(0);
  });
}
