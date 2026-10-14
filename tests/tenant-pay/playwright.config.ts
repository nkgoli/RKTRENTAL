import { defineConfig } from '@playwright/test';

const port = Number(process.env.PORT ?? 3000);
const externalBaseUrl = process.env.PLAYWRIGHT_BASE_URL;

export default defineConfig({
  testDir: '.',
  testMatch: 'pay.spec.ts',
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: externalBaseUrl ?? `http://127.0.0.1:${port}`,
    viewport: { width: 390, height: 844 },
  },
  ...(externalBaseUrl
    ? {}
    : {
        webServer: {
          command: 'npm.cmd run dev',
          url: `http://127.0.0.1:${port}/sign-in`,
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        },
      }),
});
