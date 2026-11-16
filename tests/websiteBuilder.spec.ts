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
  const assets = new Map<string, { body: Buffer; contentType: string }>();
  const backend = async (route: Route) => {
    const url = route.request().url();
    if (url.includes('/auth/v1/user'))
      return route.fulfill({
        json: { id: owner.id, email: owner.email, aud: 'authenticated', role: 'authenticated' },
      });
    if (url.includes('/storage/v1/object/')) {
      const path = new URL(url).pathname
        .replace('/storage/v1/object/', '')
        .replace(/^public\//, '');
      if (route.request().method() === 'POST') {
        const type = route.request().headers()['content-type'];
        const bytes = route.request().postDataBuffer()!;
        if (type.includes('multipart/form-data')) {
          const form = await new Response(new Uint8Array(bytes), {
            headers: { 'Content-Type': type },
          }).formData();
          const file = [...form.values()].find((v) => typeof v !== 'string') as File;
          assets.set(path, { body: Buffer.from(await file.arrayBuffer()), contentType: file.type });
        } else assets.set(path, { body: bytes, contentType: type });
        return route.fulfill({ json: { Key: path, Id: path } });
      }
      const asset = assets.get(path);
      return asset ? route.fulfill(asset) : route.fulfill({ status: 404 });
    }
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

test('new pages publish with resized media, video playback and a rotating carousel', async ({
  page,
  browser,
}) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 1360, height: 900 });
  const fixture = await openEditor(page);
  // Academics already belongs to a built-in page. The duplicate title needs its own URL.
  await page.getByRole('button', { name: 'Add page', exact: true }).click();
  await page.getByLabel('New page name').fill('Academics');
  await page.getByLabel('New page name').press('Enter');
  await expect(page.getByLabel('Page', { exact: true })).toHaveValue('academics-2');
  await expect(page.getByText('Draft page', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Page', { exact: true })).toHaveValue('academics-2');
  await page.getByRole('button', { name: 'Add section', exact: true }).click();
  await page.getByRole('button', { name: 'Media carousel', exact: true }).click();
  const media = await page.evaluate(async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 96;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = 'teal';
    ctx.fillRect(0, 0, 96, 64);
    const png = canvas.toDataURL().split(',')[1];
    const stream = canvas.captureStream(0);
    const track = stream.getVideoTracks()[0] as CanvasCaptureMediaStreamTrack;
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8' });
    const result = new Promise<Blob>((resolve) => {
      const parts: Blob[] = [];
      recorder.ondataavailable = (e) => parts.push(e.data);
      recorder.onstop = () => resolve(new Blob(parts, { type: 'video/webm' }));
    });
    recorder.start();
    for (let n = 0; n < 10; n++) {
      await new Promise((resolve) => setTimeout(resolve, 85));
      ctx.fillStyle = n % 2 ? 'navy' : 'teal';
      ctx.fillRect(0, 0, 96, 64);
      track.requestFrame();
    }
    recorder.stop();
    const clip = await result;
    stream.getTracks().forEach((track) => track.stop());
    return { png, video: Array.from(new Uint8Array(await clip.arrayBuffer())) };
  });
  expect(media.video.length).toBeGreaterThan(250);
  await page.getByLabel('Import photos or videos').setInputFiles([
    { name: 'campus.png', mimeType: 'image/png', buffer: Buffer.from(media.png, 'base64') },
    { name: 'assembly.webm', mimeType: 'video/webm', buffer: Buffer.from(media.video) },
  ]);
  await expect(page.getByText('2 added.', { exact: true })).toBeVisible();
  await page.getByLabel('Seconds per slide').selectOption('2');
  const frame = page.locator('.carousel-window .website-media-box');
  await frame.scrollIntoViewIfNeeded();
  await frame.hover();
  const before = (await frame.boundingBox())!;
  const grip = (await frame
    .getByRole('button', { name: 'Resize media right', exact: true })
    .boundingBox())!;
  await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
  await page.mouse.down();
  await page.mouse.move(grip.x - 115, grip.y + grip.height / 2, { steps: 6 });
  await page.mouse.up();
  expect((await frame.boundingBox())!.width).toBeLessThan(before.width - 50);
  await frame
    .getByRole('button', { name: 'Resize media right', exact: true })
    .press('Shift+ArrowRight');
  const resizedWidth = await frame.evaluate((el) => el.style.width);
  await frame.hover();
  await frame.getByRole('button', { name: 'Page width', exact: true }).click();
  expect(
    Math.abs(
      (await frame.boundingBox())!.width -
        (await page.locator('.school-canvas').boundingBox())!.width,
    ),
  ).toBeLessThan(2);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await frame.hover();
  await frame.getByRole('button', { name: 'Fit entire image' }).click();
  await page.getByRole('button', { name: 'Publish', exact: true }).click();
  await expect(page.getByText('Website published.', { exact: true })).toBeVisible();
  const live = page.getByRole('link', { name: 'Live site' });
  await expect(live).toHaveAttribute('href', /#\/school\/academics-2$/);
  const visitor = await browser.newPage({ baseURL: new URL(page.url()).origin });
  try {
    await visitor.emulateMedia({ reducedMotion: 'no-preference' });
    await visitor.route('https://*.supabase.co/**', fixture.backend);
    await visitor.goto('/#/school');
    await visitor
      .getByRole('navigation', { name: 'School navigation' })
      .getByRole('link', { name: 'Academics', exact: true })
      .click();
    await expect(visitor.getByRole('heading', { name: 'Academics', exact: true })).toBeVisible();
    await visitor.reload();
    const carousel = visitor.getByRole('region', { name: 'School highlights' });
    await carousel.getByRole('button', { name: 'Pause slideshow' }).click();
    if (await carousel.locator('video').count())
      await carousel.getByRole('button', { name: 'Previous slide' }).click();
    await expect(carousel.locator('img')).toHaveCSS('object-fit', 'contain');
    expect(
      await carousel
        .locator('.website-media-box')
        .evaluate((el) => (el as HTMLElement).style.width),
    ).toBe(resizedWidth);
    await carousel.getByRole('button', { name: 'Play slideshow' }).click();
    await expect(carousel.locator('video')).toBeVisible({ timeout: 5000 });
    await carousel.getByRole('button', { name: 'Pause slideshow' }).click();
    await expect
      .poll(() => carousel.locator('video').evaluate((v: HTMLVideoElement) => v.videoWidth))
      .toBe(96);
    await carousel.locator('video').evaluate(async (v: HTMLVideoElement) => {
      v.muted = true;
      await v.play();
    });
    await expect
      .poll(() => carousel.locator('video').evaluate((v: HTMLVideoElement) => v.currentTime))
      .toBeGreaterThan(0);
    await visitor.setViewportSize({ width: 390, height: 844 });
    expect(await visitor.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      390,
    );
    await expect(visitor.getByRole('button', { name: 'Resize media right' })).toHaveCount(0);
  } finally {
    await visitor.close();
  }
});
