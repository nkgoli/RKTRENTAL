import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: '.',
  testMatch: 'overview-review.spec.ts',
  outputDir: '.runtime/test-results',
  timeout: 120000,
  expect: { timeout: 20000 },
  workers: 1,
  reporter: [['list'], ['json', { outputFile: '.runtime/chromium-results.json' }]],
  use: {
    browserName: 'chromium',
    headless: true,
    viewport: { width: 1280, height: 1000 },
    trace: 'retain-on-failure',
  },
});
