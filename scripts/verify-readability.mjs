import { chromium } from '@playwright/test';
import fs from 'node:fs';
import { seed } from '../src/data.ts';
// UI fixture only: no live backend records or accounts are read or changed.
// Solid-background contrast is checked; gradients, images and alpha compositing
// still require visual review. Run with a local Vite server and Node >=22.18.
const baseURL = process.env.AOS_VISUAL_URL || 'http://127.0.0.1:5175';
fs.mkdirSync('.temp', { recursive: true });
const browser = await chromium.launch({
  executablePath:
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ||
    (process.platform === 'win32'
      ? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
      : undefined),
});
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const state = seed();
  const user = state.users.find((u) => u.role === 'Administrator');
  await page.route('https://*.supabase.co/**', (route) => {
    const url = route.request().url();
    if (url.includes('/functions/v1/workspace'))
      return route.fulfill({ json: { state, revision: 1 } });
    if (url.includes('/auth/v1/token'))
      return route.fulfill({
        json: {
          access_token: 'local-visual-fixture',
          refresh_token: 'local-fixture',
          expires_in: 3600,
          token_type: 'bearer',
          user: {
            id: user.id,
            email: 'visual@example.com',
            aud: 'authenticated',
            app_metadata: {},
            user_metadata: {},
            created_at: new Date().toISOString(),
          },
        },
      });
    return route.fulfill({ json: {} });
  });
  await page.goto(baseURL);
  await page.screenshot({ path: '.temp/login.png' });
  await page.getByLabel('Username or email').fill('visual@example.com');
  await page.getByLabel('Password', { exact: true }).fill('local-fixture');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.locator('.app-shell').waitFor();
  const results = [];
  const routes = [
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
  ];
  for (const theme of ['light', 'dark']) {
    await page.evaluate((t) => {
      document.documentElement.dataset.theme = t;
      document.documentElement.classList.toggle('dark', t === 'dark');
    }, theme);
    for (const route of routes) {
      await page.goto(baseURL + '/#/' + route);
      await page.waitForTimeout(250);
      const failures = await page.evaluate(() => {
        const rgb = (s) => (s.match(/[\d.]+/g) || []).map(Number);
        const lum = (c) =>
          c
            .slice(0, 3)
            .map((v) => {
              v /= 255;
              return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
            })
            .reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0);
        return [...document.querySelectorAll('body *')]
          .filter(
            (el) =>
              [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) &&
              el.getBoundingClientRect().width &&
              el.getBoundingClientRect().height &&
              !el.closest('[aria-hidden="true"],button:disabled'),
          )
          .flatMap((el) => {
            const s = getComputedStyle(el);
            let bg = [255, 255, 255],
              p = el;
            while (p) {
              const ps = getComputedStyle(p);
              if (ps.backgroundImage !== 'none') return [];
              const c = rgb(ps.backgroundColor);
              if (c[3] === undefined || c[3] === 1) {
                bg = c;
                break;
              }
              p = p.parentElement;
            }
            const l1 = lum(rgb(s.color)),
              l2 = lum(bg),
              ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
            const threshold =
              parseFloat(s.fontSize) >= 24 ||
              (parseFloat(s.fontSize) >= 18.66 && parseInt(s.fontWeight) >= 700)
                ? 3
                : 4.5;
            return ratio < threshold
              ? [
                  {
                    tag: el.tagName,
                    cls: el.className,
                    text: el.textContent.trim().slice(0, 55),
                    ratio: +ratio.toFixed(2),
                    color: s.color,
                    bg,
                  },
                ]
              : [];
          });
      });
      results.push({ theme, route, failures });
      if (!route) await page.screenshot({ path: '.temp/dashboard-' + theme + '.png' });
    }
  }
  for (const width of [1440, 820, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of routes) {
      await page.goto(baseURL + '/#/' + route);
      await page.locator('main h1').first().waitFor();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth + 1,
      );
      if (overflow)
        results.push({
          width,
          route,
          failures: [
            {
              error: 'Horizontal page overflow',
              elements: await page.evaluate(() =>
                [...document.querySelectorAll('main *')]
                  .filter((e) => e.getBoundingClientRect().right > innerWidth + 1)
                  .slice(0, 8)
                  .map((e) => ({
                    tag: e.tagName,
                    cls: e.className,
                    width: e.getBoundingClientRect().width,
                  })),
              ),
            },
          ],
        });
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(baseURL + '/#/');
  await page.screenshot({ path: '.temp/mobile-dark.png' });
  fs.writeFileSync('.temp/contrast-results.json', JSON.stringify(results, null, 2));
  const failed = results.filter((r) => r.failures.length);
  console.log(JSON.stringify({ contrastScreens: 28, responsiveScreens: 56, failed }, null, 2));
  if (failed.length) process.exitCode = 1;
} finally {
  await browser.close();
}
