import { existsSync } from 'node:fs';
import { defineConfig } from '@playwright/test';
const port = Number(process.env.AOS_E2E_TEST_PORT || 5173);
export default defineConfig({
  testDir: './tests',
  testMatch: process.env.AOS_CLOUD_TESTS
    ? '**/cloud.spec.ts'
    : [
        '**/ui.spec.ts',
        '**/conflict.spec.ts',
        '**/reportAttitudes.spec.ts',
        '**/attendanceWeekdays.spec.ts',
        '**/learningHub.spec.ts',
        '**/websiteBuilder.spec.ts',
      ],
  fullyParallel: true,
  workers: process.env.AOS_CLOUD_TESTS ? 1 : 2,
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    headless: true,
    launchOptions: {
      executablePath:
        process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ||
        (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined),
      args: ['--no-sandbox'],
    },
    screenshot: 'only-on-failure',
    trace: process.env.AOS_CLOUD_TESTS ? 'off' : 'retain-on-failure',
  },
  webServer: {
    command: `node node_modules/vite/bin/vite.js --host 127.0.0.1 --port ${port} --strictPort`,
    env: process.env.AOS_CLOUD_TESTS ? { VITE_DEMO_MODE: 'false' } : { VITE_DEMO_MODE: 'true' },
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: !process.env.CI,
  },
  reporter: 'list',
});
