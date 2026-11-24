import { existsSync } from 'node:fs';
import { defineConfig } from '@playwright/test';

const port = Number(process.env.AOS_OFFLINE_TEST_PORT || 5187);

export default defineConfig({
  testDir: './tests',
  testMatch: ['**/offlineShell.spec.ts', '**/offlineWorkspace.spec.ts'],
  workers: 1,
  timeout: 60000,
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    headless: true,
    launchOptions: {
      executablePath:
        process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ||
        (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined),
    },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port ${port} --strictPort`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
  },
  reporter: 'list',
});
