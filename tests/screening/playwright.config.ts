import { defineConfig } from '@playwright/test';

const port = Number(process.env.PORT ?? 3141);
const externalBaseUrl = process.env.PLAYWRIGHT_BASE_URL;

export default defineConfig({
  testDir: '.',
  testMatch: 'applications.spec.ts',
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: externalBaseUrl ?? `http://127.0.0.1:${port}`,
    viewport: { width: 1280, height: 1000 },
  },
  ...(externalBaseUrl
    ? {}
    : {
        webServer: {
          command: 'npm.cmd run dev',
          url: `http://127.0.0.1:${port}/sign-in`,
          reuseExistingServer: false,
          timeout: 120_000,
        },
      }),
});
