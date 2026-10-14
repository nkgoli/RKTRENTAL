import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env.PORT ?? 3000);
const externalBaseUrl = process.env.PLAYWRIGHT_BASE_URL;

export default defineConfig({
  testDir: '.',
  testMatch: 'integrations.spec.ts',
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: externalBaseUrl ?? `http://localhost:${port}`,
  },
  ...(externalBaseUrl
    ? {}
    : {
        webServer: {
          command: 'npm.cmd run dev',
          url: `http://localhost:${port}`,
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        },
      }),
});
