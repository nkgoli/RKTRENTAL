import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: '.',
  testMatch: 'browser.spec.ts',
  workers: 1,
  retries: 0,
  timeout: 90_000,
  outputDir: '../../.playwright-mcp/template-test-results',
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:3147',
    headless: true,
    browserName: 'chromium',
    trace: 'retain-on-failure',
  },
});
