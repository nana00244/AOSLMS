import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import { emptyState } from '../src/emptyState';
import { overlayChanges } from '../src/saveRecovery';

const owner = '00000000-0000-4000-8000-000000000001';
const authKey = 'sb-itqfnzqksuacbeemrqok-auth-token';
function session(userId = owner) {
  return {
    access_token: 'offline-test-token',
    refresh_token: 'offline-test-refresh',
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    token_type: 'bearer',
    user: { id: userId, email: 'offline@example.com', aud: 'authenticated', role: 'authenticated' },
  };
}

async function prepare(page: Page, context: BrowserContext) {
  let state = emptyState();
  state.users = [
    {
      id: owner,
      name: 'Offline Admin',
      email: 'offline@example.com',
      role: 'Administrator',
      active: true,
      classes: [],
    },
  ];
  state.classes = ['BS 1'];
  state.students = [
    {
      id: 'S1',
      name: 'Offline Report Pupil',
      classId: 'BS 1',
      gender: 'Male',
      dob: '',
      guardian: '',
      phone: '',
      status: 'Active',
      enrolled: '2026-11-24',
    },
  ];
  Object.assign(state.settings, {
    name: 'Prepared school',
    motto: 'Learn every day',
    address: 'Test campus',
    phone: '0123456789',
    email: 'office@example.com',
    year: '2026/2027',
    vacation: '2026-12-18',
    reopening: '2027-01-11',
  });
  let revision = 1;
  const control = {
    deny: false,
    conflict: false,
    lostResponse: false,
    calls: 0,
    commits: 0,
    unavailableLoads: false,
    advanceRevision: () => {
      revision = 3;
      state.remarks['S1|1'] = 'Changed on another device';
    },
  };
  const receipts = new Map<string, unknown>();
  await page.addInitScript(
    ({ authKey, initial }) => {
      if (localStorage.getItem('offline-fixture-initialized')) return;
      localStorage.setItem('offline-fixture-initialized', 'yes');
      localStorage.setItem(authKey, JSON.stringify(initial));
    },
    { authKey, initial: session() },
  );
  await context.route('https://*.supabase.co/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/auth/v1/logout')) return route.fulfill({ status: 204 });
    if (url.pathname.endsWith('/auth/v1/token'))
      return route.fulfill({ json: { ...session(), expires_in: 3600 } });
    if (url.pathname !== '/functions/v1/workspace')
      return route.fulfill({ status: 503, json: { error: 'Not used by this isolated fixture' } });
    const body = route.request().postDataJSON();
    if (control.deny) return route.fulfill({ status: 403, json: { error: 'Account is inactive' } });
    if (body.action === 'load')
      return control.unavailableLoads
        ? route.fulfill({ status: 503, json: { error: 'Load temporarily unavailable' } })
        : route.fulfill({ json: { state, revision } });
    if (body.action === 'photo-urls') return route.fulfill({ json: { urls: {} } });
    expect(['save-pending', 'save-batch']).toContain(body.action);
    control.calls++;
    if (control.conflict)
      return route.fulfill({
        status: 409,
        json: {
          error:
            'Conflict: settings/singleton.name was also changed by another save. Your pending entry is retained for review.',
        },
      });
    const saves = body.saves || [body];
    const receiptKey = saves.map((save: any) => save.operationId).join(',');
    let receipt = receipts.get(receiptKey);
    if (!receipt) {
      const baseRevision = revision;
      for (const save of saves) state = overlayChanges(state, save.changes);
      revision++;
      control.commits++;
      receipt = {
        confirmed: true,
        baseRevision,
        revision,
        changes: saves.flatMap((save: any) => save.changes),
      };
      receipts.set(receiptKey, receipt);
    }
    if (control.lostResponse) {
      control.lostResponse = false;
      return route.abort('connectionfailed');
    }
    return route.fulfill({ json: receipt });
  });
  page.on('dialog', (dialog) => void dialog.accept());
  await page.goto('/#/settings');
  await expect(page.getByLabel('School name', { exact: true })).toHaveValue('Prepared school');
  await expect(page.locator('.offline-status summary')).toContainText('Ready for offline use', {
    timeout: 30000,
  });
  return control;
}

async function retained(page: Page) {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('aos-pending-saves', 2);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const result = await new Promise<{ saves: any[]; snapshots: any[] }>((resolve, reject) => {
      const tx = db.transaction(['saves', 'snapshots']);
      const saves = tx.objectStore('saves').getAll();
      const snapshots = tx.objectStore('snapshots').getAll();
      tx.oncomplete = () => resolve({ saves: saves.result, snapshots: snapshots.result });
      tx.onerror = () => reject(tx.error);
    });
    db.close();
    return result;
  });
}

async function editSchool(page: Page, name: string) {
  await page.getByLabel('School name', { exact: true }).fill(name);
  await page.getByRole('button', { name: 'Save all changes', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Save all changes', exact: true })).toBeEnabled();
}

test('expired-session offline reload retains edits, reconnect confirms once, and confirmed state reopens offline', async ({
  page,
  context,
}) => {
  const control = await prepare(page, context);
  await context.setOffline(true);
  await page.evaluate((authKey) => {
    const value = JSON.parse(localStorage.getItem(authKey)!);
    value.expires_at = Math.floor(Date.now() / 1000) - 86400;
    localStorage.setItem(authKey, JSON.stringify(value));
  }, authKey);
  await page.reload();
  await expect(page.getByLabel('School name', { exact: true })).toHaveValue('Prepared school');
  await expect(page.locator('.offline-status summary')).toContainText('Offline');
  await editSchool(page, 'Written without internet');
  await expect(page.getByRole('complementary', { name: 'Pending saves' })).toContainText(
    '1 pending save',
  );
  expect(control.calls).toBe(0);
  expect((await retained(page)).saves).toHaveLength(1);
  await page.reload();
  await expect(page.getByLabel('School name', { exact: true })).toHaveValue(
    'Written without internet',
  );
  control.lostResponse = true;
  await context.setOffline(false);
  await expect.poll(() => control.calls).toBeGreaterThan(0);
  await page
    .getByRole('complementary', { name: 'Pending saves' })
    .getByRole('button', { name: 'Show details' })
    .click();
  await page.getByRole('button', { name: 'Retry sync', exact: true }).click();
  await expect(page.getByRole('complementary', { name: 'Pending saves' })).toBeHidden();
  expect(control.commits).toBe(1);
  const stored = await retained(page);
  expect(stored.saves).toHaveLength(0);
  expect(stored.snapshots[0].state.settings.name).toBe('Written without internet');
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByLabel('School name', { exact: true })).toHaveValue(
    'Written without internet',
  );
});

test('conflicting offline edits stay retained across reload and do not retry automatically', async ({
  page,
  context,
}) => {
  const control = await prepare(page, context);
  await context.setOffline(true);
  await editSchool(page, 'Local conflicting school');
  control.conflict = true;
  await context.setOffline(false);
  const notice = page.getByRole('complementary', { name: 'Pending saves' });
  await expect(notice).toContainText('needs review');
  const attempts = control.calls;
  await page.reload();
  await expect(notice).toContainText('needs review');
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByLabel('School name', { exact: true })).toHaveValue(
    'Local conflicting school',
  );
  expect(control.calls).toBe(attempts);
  expect((await retained(page)).saves[0].conflict).toContain('Conflict:');
});

test('offline reports remain printable with a visible local draft label while edits are pending', async ({
  page,
  context,
}) => {
  await prepare(page, context);
  await context.setOffline(true);
  await editSchool(page, 'Offline report school');
  await expect(page.getByRole('complementary', { name: 'Pending saves' })).toContainText(
    '1 pending save',
  );
  await page.goto('/#/reports?student=S1');
  await expect(page.getByText('LOCAL DRAFT', { exact: false })).toBeVisible();
  await page.evaluate(() => {
    window.print = () => {
      (window as any).offlinePrintCalled = true;
    };
  });
  await page.getByRole('button', { name: 'Print / Save PDF', exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => Boolean((window as any).offlinePrintCalled)))
    .toBe(true);
  expect((await retained(page)).saves).toHaveLength(1);
});

test('offline sign-out hides private workspace, retains edits, and another uncached account cannot open it', async ({
  page,
  context,
}) => {
  await prepare(page, context);
  await context.setOffline(true);
  await editSchool(page, 'Private offline edit');
  await expect(page.getByRole('complementary', { name: 'Pending saves' })).toContainText(
    '1 pending save',
  );
  await page.locator('.profile-button').click();
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
  await expect.poll(async () => (await retained(page)).snapshots.length).toBe(0);
  expect((await retained(page)).saves).toHaveLength(1);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
  await page.evaluate(({ authKey, next }) => localStorage.setItem(authKey, JSON.stringify(next)), {
    authKey,
    next: session('00000000-0000-4000-8000-000000000002'),
  });
  await page.reload();
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
  await expect(page.locator('.app-shell')).toHaveCount(0);
  expect((await retained(page)).saves[0].owner).toBe(owner);
});

test('server denial invalidates the cached workspace instead of falling back to offline access', async ({
  page,
  context,
}) => {
  const control = await prepare(page, context);
  control.deny = true;
  await page.reload();
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
  await expect.poll(async () => (await retained(page)).snapshots.length).toBe(0);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
  await expect(page.locator('.app-shell')).toHaveCount(0);
});

test('local storage failure never accepts an offline edit or creates a pending save', async ({
  page,
  context,
}) => {
  await prepare(page, context);
  await context.setOffline(true);
  await page.evaluate(() => {
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args) {
      if (this.name === 'saves')
        throw new DOMException('Test storage is full', 'QuotaExceededError');
      return put.apply(this, args);
    };
  });
  await editSchool(page, 'Must not be accepted');
  await expect(page.getByRole('alert')).toContainText('Not saved:');
  expect((await retained(page)).saves).toHaveLength(0);
  await page.reload();
  await expect(page.getByLabel('School name', { exact: true })).toHaveValue('Prepared school');
});

test('a failed local confirmation transaction retains the receipt and recovers without a duplicate server commit', async ({
  page,
  context,
}) => {
  const control = await prepare(page, context);
  await context.setOffline(true);
  await editSchool(page, 'Confirmed after storage recovery');
  await expect(page.getByRole('complementary', { name: 'Pending saves' })).toContainText(
    '1 pending save',
  );
  const before = await retained(page);
  await page.evaluate(() => {
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (value, ...args) {
      if (this.name === 'snapshots' && value.revision > 1) {
        // Abort the actual transaction after its queue-delete request has been
        // scheduled. IndexedDB must roll both stores back together.
        this.transaction.abort();
        throw new DOMException('Test confirmation storage failure', 'QuotaExceededError');
      }
      return put.call(this, value, ...args);
    };
  });
  await context.setOffline(false);
  await expect.poll(() => control.commits).toBe(1);
  const notice = page.getByRole('complementary', { name: 'Pending saves' });
  await notice.getByRole('button', { name: 'Show details' }).click();
  await expect(notice).toContainText('Not synced:');
  const after = await retained(page);
  expect(after.saves.map((save) => save.id)).toEqual(before.saves.map((save) => save.id));
  expect(after.snapshots[0].revision).toBe(1);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByLabel('School name', { exact: true })).toHaveValue(
    'Confirmed after storage recovery',
  );
  await context.setOffline(false);
  await expect(notice).toBeHidden();
  expect(control.commits).toBe(1);
  expect((await retained(page)).snapshots[0].revision).toBe(2);
});

test('a stale tab keeps an acknowledged edit until the complete newer workspace is durable', async ({
  page,
  context,
}) => {
  const control = await prepare(page, context);
  await context.setOffline(true);
  await editSchool(page, 'Edit from an older tab');
  await expect(page.getByRole('complementary', { name: 'Pending saves' })).toBeVisible();
  control.advanceRevision();
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const request = indexedDB.open('aos-pending-saves', 2);
      request.onsuccess = () => resolve(request.result);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('snapshots', 'readwrite');
      const store = tx.objectStore('snapshots');
      const request = store.getAll();
      request.onsuccess = () => {
        const snapshot = request.result[0];
        snapshot.revision = 3;
        snapshot.state.remarks['S1|1'] = 'Changed on another device';
        store.put(snapshot);
      };
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error);
    });
    db.close();
  });
  control.unavailableLoads = true;
  await context.setOffline(false);
  await expect.poll(() => control.commits).toBe(1);
  const notice = page.getByRole('complementary', { name: 'Pending saves' });
  await notice.getByRole('button', { name: 'Show details' }).click();
  await expect(notice).toContainText('Load temporarily unavailable');
  expect((await retained(page)).saves).toHaveLength(1);
  control.unavailableLoads = false;
  await notice.getByRole('button', { name: 'Retry sync', exact: true }).click();
  await expect(notice).toBeHidden();
  const stored = await retained(page);
  expect(stored.snapshots[0].revision).toBe(4);
  expect(stored.snapshots[0].state.settings.name).toBe('Edit from an older tab');
  expect(stored.snapshots[0].state.remarks['S1|1']).toBe('Changed on another device');
  expect(control.commits).toBe(1);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByLabel('School name', { exact: true })).toHaveValue(
    'Edit from an older tab',
  );
});
