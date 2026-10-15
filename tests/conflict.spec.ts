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

test('recover pending upload previews, skips receipts, rejects another owner and syncs only ready entries', async ({
  page,
}) => {
  const userId = '00000000-0000-4000-8000-000000000001';
  const state = emptyState();
  state.users = [
    {
      id: userId,
      name: 'Recovery Admin',
      email: 'test@example.com',
      role: 'Administrator',
      active: true,
      classes: [],
    },
  ];
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
  const saves = [2, 3, 4].map((n) => ({
    id: '00000000-0000-4000-8000-' + String(n).padStart(12, '0'),
    owner: userId,
    createdAt: new Date(2026, 9, 15, 0, n).toISOString(),
    event: 'Recovery example ' + n,
    changes: [{ collection: 'remarks', id: 'example|1', after: 'Draft ' + n }],
  }));
  let writes = 0;
  let previews = 0;
  const transactions: any[] = [];
  await page.route('**/functions/v1/workspace', async (route) => {
    const body = route.request().postDataJSON();
    let response: any;
    if (body.action === 'load') response = { state, revision: 1 };
    else if (body.action === 'preview-recovery') {
      previews++;
      response = {
        rows: saves.map((s, i) => ({
          id: s.id,
          status: i === 0 || (writes && i === 1) ? 'confirmed' : i === 1 ? 'ready' : 'conflict',
          reason: i === 2 ? 'Conflict: another save changed this remark.' : 'Checked.',
        })),
        revision: 1,
      };
    } else {
      writes++;
      expect(body.action).toBe('save-pending');
      expect(body.operationId).toBe(saves[1].id);
      response = { state, revision: 2 };
    }
    transactions.push({ request: body, response });
    await route.fulfill({ json: response });
  });
  await page.goto('/');
  await expect(page.locator('.app-shell')).toBeVisible();
  await page.getByRole('button', { name: 'Recover pending entries', exact: true }).click();
  const dialog = page.getByRole('dialog');
  const file = dialog.getByLabel('Pending entries file');
  await file.setInputFiles({
    name: 'pending-school-saves.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify([{ ...saves[0], owner: 'other' }])),
  });
  await expect(dialog).toContainText('another account');
  expect(previews).toBe(0);
  await file.setInputFiles({
    name: 'pending-school-saves.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(saves)),
  });
  await expect(dialog).toContainText('1 ready');
  await expect(dialog).toContainText('1 already confirmed');
  await expect(dialog).toContainText('CONFLICT');
  await page.screenshot({ path: '.temp/recovery-preview.png' });
  expect(writes).toBe(0);
  await dialog.getByRole('button', { name: 'Recover 1 ready entries and sync' }).click();
  await expect(dialog).toContainText('Recovery sync finished');
  expect(writes).toBe(1);
  await expect(dialog).toContainText('2 already confirmed');
  await expect(dialog.getByRole('button', { name: /ready entries and sync/ })).toBeDisabled();
  const remaining = await page.evaluate(async (userId) => {
    const path = '/src/pendingSaves.ts';
    const { readPendingSaves } = await import(path);
    return readPendingSaves(userId);
  }, userId);
  expect(remaining).toHaveLength(0);
  // Synthetic mocked traffic only; authentication headers and tokens are omitted.
  const { mkdirSync, writeFileSync } = await import('node:fs');
  mkdirSync('.temp', { recursive: true });
  writeFileSync(
    '.temp/recovery-ui.har',
    JSON.stringify({
      log: {
        version: '1.2',
        creator: { name: 'Recovery controlled browser test', version: '1' },
        entries: transactions.map((t) => ({
          startedDateTime: new Date().toISOString(),
          time: 0,
          request: {
            method: 'POST',
            url: 'http://controlled-test.invalid/functions/v1/workspace',
            httpVersion: 'HTTP/1.1',
            headers: [],
            queryString: [],
            cookies: [],
            headersSize: -1,
            bodySize: -1,
            postData: { mimeType: 'application/json', text: JSON.stringify(t.request) },
          },
          response: {
            status: 200,
            statusText: 'OK',
            httpVersion: 'HTTP/1.1',
            headers: [],
            cookies: [],
            headersSize: -1,
            bodySize: -1,
            redirectURL: '',
            content: {
              size: Buffer.byteLength(JSON.stringify(t.response)),
              mimeType: 'application/json',
              text: JSON.stringify(t.response),
            },
          },
          cache: {},
          timings: { send: 0, wait: 0, receive: 0 },
          comment: 'Controlled mock; times not measured.',
        })),
      },
    }),
  );
});
