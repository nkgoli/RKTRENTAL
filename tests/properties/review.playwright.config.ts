import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: '.',
  testMatch: 'directory-review.spec.ts',
  outputDir: '.runtime/test-results',
  timeout: 90000,
  expect: { timeout: 15000 },
  workers: 1,
  reporter: [['list'], ['json', { outputFile: '.runtime/chromium-results.json' }]],
  use: {
    browserName: 'chromium',
    headless: true,
    baseURL: 'http://localhost:3232',
    viewport: { width: 1280, height: 1000 },
    trace: 'retain-on-failure',
  },
});
