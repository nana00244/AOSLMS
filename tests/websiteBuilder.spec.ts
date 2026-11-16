import { expect, test, type Page, type Route } from '@playwright/test';
import { applyChanges } from '../src/backendAccess';
import { emptyState } from '../src/emptyState';
import { workspaceSchema } from '../src/validation';

async function openEditor(page: Page, rejectPublish = false) {
  const owner = {
    id: '00000000-0000-4000-8000-000000000001',
    email: 'webmaster@example.test',
    name: 'Test administrator',
    role: 'Administrator' as const,
    active: true,
    classes: [],
  };
  let state = emptyState();
  state.users = [owner];
  state.settings.publicSite = {
    headline: 'Published school homepage',
    intro: 'Welcome, families.',
    about: 'Learning together',
    contact: 'Visit our school',
    heroImage: '',
  };
  let revision = 1;
  let saves = 0;
  const backend = async (route: Route) => {
    const url = route.request().url();
    if (url.includes('/functions/v1/school-website')) {
      expect(route.request().postDataJSON().action).toBe('public-content');
      return route.fulfill({ json: { site: state.settings.publicSite } });
    }
    if (!url.includes('/functions/v1/workspace')) return route.fulfill({ json: {} });
    const body = route.request().postDataJSON();
    if (body.action !== 'load') {
      expect(['save-pending', 'save-batch']).toContain(body.action);
      saves++;
      if (rejectPublish) return route.fulfill({ status: 503, json: { error: 'Temporary outage' } });
      for (const save of body.saves || [body]) {
        state = workspaceSchema.parse(applyChanges(state, owner, save.changes)) as typeof state;
      }
      revision++;
    }
    return route.fulfill({ json: { state, revision } });
  };
  await page.addInitScript(({ id, email }) => {
    localStorage.setItem(
      'sb-itqfnzqksuacbeemrqok-auth-token',
      JSON.stringify({
        access_token: 'test-token',
        refresh_token: 'test-refresh',
        token_type: 'bearer',
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        user: { id, email, aud: 'authenticated', role: 'authenticated' },
      }),
    );
  }, owner);
  await page.routeWebSocket('**', (socket) => socket.close());
  await page.route('https://*.supabase.co/**', backend);
  await page.goto('/#/admin/website');
  await expect(page.getByRole('button', { name: 'Add section', exact: true })).toBeVisible();
  return { backend, saves: () => saves };
}

test('a school website draft can be composed, restored, previewed on mobile and published', async ({
  page,
  browser,
}) => {
  const fixture = await openEditor(page);
  const heading = 'Meet our reading club';
  await page.getByRole('button', { name: 'Add section', exact: true }).click();
  await page.getByRole('button', { name: 'Blank section', exact: true }).click();
  await page.getByLabel('Element type').selectOption('heading');
  await page.getByRole('button', { name: 'Add element', exact: true }).click();
  const elementText = page.getByRole('textbox', { name: 'Text', exact: true });
  await elementText.fill(heading);
  await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.getByRole('heading', { name: heading, exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Mobile preview', exact: true }).click();
  await page.getByRole('button', { name: 'Preview', exact: true }).click();
  await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Toggle navigation' })).toBeVisible();
  await page.getByRole('button', { name: 'Back to editor', exact: true }).click();
  expect(fixture.saves()).toBe(0);

  const visitor = await browser.newPage({ baseURL: new URL(page.url()).origin });
  try {
    await visitor.route('https://*.supabase.co/**', fixture.backend);
    await visitor.goto('/#/school');
    await expect(visitor.getByRole('heading', { name: 'Published school homepage' })).toBeVisible();
    await expect(visitor.getByRole('heading', { name: heading, exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Publish', exact: true }).click();
    await expect(page.getByText('Website published.', { exact: true })).toBeVisible();
    await visitor.reload();
    await expect(visitor.getByRole('heading', { name: heading, exact: true })).toBeVisible();
    expect(fixture.saves()).toBe(1);
  } finally {
    await visitor.close();
  }
});

test('a publish outage keeps the edited title recoverable and the visitor site unchanged', async ({
  page,
  browser,
}) => {
  const fixture = await openEditor(page, true);
  const title = 'Draft admissions announcement';
  await page.getByRole('button', { name: 'Page header', exact: true }).click();
  await page.getByRole('textbox', { name: 'Page title', exact: true }).fill(title);
  await page.getByRole('button', { name: 'Publish', exact: true }).click();
  await expect.poll(fixture.saves).toBeGreaterThan(0);
  await expect(page.getByRole('button', { name: 'Publish', exact: true })).toBeEnabled();
  await expect(page.getByText('Website published.', { exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  const visitor = await browser.newPage({ baseURL: new URL(page.url()).origin });
  try {
    await visitor.route('https://*.supabase.co/**', fixture.backend);
    await visitor.goto('/#/school');
    await expect(visitor.getByRole('heading', { name: 'Published school homepage' })).toBeVisible();
    await expect(visitor.getByRole('heading', { name: title, exact: true })).toHaveCount(0);
  } finally {
    await visitor.close();
  }
});

test('an administrator can select and drag a canvas element between sections on a new page', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openEditor(page);
  await page.screenshot({ path: testInfo.outputPath('website-studio.png') });
  await page.getByRole('button', { name: 'Add page', exact: true }).click();
  await page.getByLabel('New page name').fill('Reading club');
  await page.getByRole('button', { name: 'Create page' }).click();
  await page.getByRole('button', { name: 'Add section', exact: true }).click();
  await page.getByRole('button', { name: 'Blank section', exact: true }).click();
  await page.getByRole('button', { name: 'Add element', exact: true }).click();
  await page.getByRole('textbox', { name: 'Text', exact: true }).fill('Club events');
  await page.getByRole('button', { name: 'Add section', exact: true }).click();
  await page.getByRole('button', { name: 'Blank section', exact: true }).click();
  const sections = page.locator('.school-block-blank');
  const element = page.locator('[data-canvas-element]').filter({ hasText: 'Club events' });
  await element.getByRole('heading').click();
  await expect(page.getByRole('textbox', { name: 'Text', exact: true })).toBeFocused();
  await element.dragTo(
    sections.nth(1).getByRole('button', { name: 'Add elements to this section' }),
  );
  await expect(sections.nth(1).getByRole('heading', { name: 'Club events' })).toBeVisible();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(sections.nth(0).getByRole('heading', { name: 'Club events' })).toBeVisible();
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect(sections.nth(1).getByRole('heading', { name: 'Club events' })).toBeVisible();
});
