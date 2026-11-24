import { test, expect } from '@playwright/test';

test('production shell reopens offline with local content and never caches APIs', async ({
  page,
  context,
}) => {
  await page.goto('/');
  await expect(page.locator('.login-page')).toBeVisible();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller)
      await new Promise<void>((resolve) => {
        navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), {
          once: true,
        });
      });
  });
  const assets = await page.evaluate(async () => {
    const name = (await caches.keys()).find((name) => name.startsWith('aos-app-shell-'))!;
    return (await (await caches.open(name)).keys()).map((request) => new URL(request.url).pathname);
  });
  expect(assets).toContain('/index.html');
  expect(assets).toContain('/manifest.webmanifest');
  expect(assets).toContain('/crest.svg');
  expect(assets).toContain('/assets/wrong-answer-gameshow.mp3');
  expect(assets.some((path) => path.endsWith('.woff2'))).toBe(true);
  const lesson = assets.find(
    (path) => path.startsWith('/assets/aistudio/') && path.endsWith('.json'),
  )!;
  expect(lesson).toBeTruthy();
  await context.route('**/api/offline-probe', (route) =>
    route.fulfill({ json: { private: true } }),
  );
  expect(await page.evaluate(async () => (await fetch('/api/offline-probe')).json())).toEqual({
    private: true,
  });
  expect(await page.evaluate(async () => Boolean(await caches.match('/api/offline-probe')))).toBe(
    false,
  );

  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('.login-page')).toBeVisible();
  const content = await page.evaluate(async (lesson) => {
    const responses = await Promise.all([
      fetch(lesson),
      fetch('/crest.svg'),
      fetch('/assets/wrong-answer-gameshow.mp3'),
    ]);
    return Promise.all(
      responses.map(async (response) => ({
        ok: response.ok,
        bytes: (await response.arrayBuffer()).byteLength,
      })),
    );
  }, lesson);
  expect(content.every((item) => item.ok && item.bytes > 0)).toBe(true);
  const second = await context.newPage();
  await second.goto('/?offline-reopen=1#/school');
  await expect(second.locator('#root')).not.toBeEmpty();
  expect(
    await second.evaluate(async () => {
      const response = await fetch('/index.html');
      return response.ok;
    }),
  ).toBe(true);
  await second.close();
});

test('offline readiness detects missing cached assets', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  const inspect = () =>
    page.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready;
      return new Promise<boolean>((resolve) => {
        const channel = new MessageChannel();
        channel.port1.onmessage = (event) => {
          channel.port1.close();
          resolve(event.data.ready);
        };
        registration.active!.postMessage({ type: 'AOS_OFFLINE_STATUS' }, [channel.port2]);
      });
    });
  expect(await inspect()).toBe(true);
  await page.evaluate(async () => {
    const name = (await caches.keys()).find((name) => name.startsWith('aos-app-shell-'))!;
    await (await caches.open(name)).delete('/crest.svg');
  });
  expect(await inspect()).toBe(false);
});
