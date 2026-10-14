import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env.PORT ?? 3000);
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: '.',
  testMatch: '**/*.spec.ts',
  workers: 1,
  reporter: 'list',
  use: { ...devices['Desktop Chrome'], baseURL },
  webServer: process.env.PLAYWRIGHT_BASE_URL ? undefined : {
    command: `node node_modules/next/dist/bin/next dev -p ${port}`,
    url: `${baseURL}/sign-in`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
