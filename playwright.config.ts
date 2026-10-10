import { existsSync } from 'node:fs';
import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests',
  testMatch: process.env.AOS_CLOUD_TESTS ? '**/cloud.spec.ts' : '**/ui.spec.ts',
  fullyParallel: true,
  workers: 2,
  use: {
    baseURL: 'http://127.0.0.1:5173',
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
    command: 'npm run dev -- --port 5173',
    env: process.env.AOS_CLOUD_TESTS ? { VITE_DEMO_MODE: 'false' } : { VITE_DEMO_MODE: 'true' },
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: !process.env.CI,
  },
  reporter: 'list',
});
